# Debugging Kafka Streams Applications

Symptom-organized diagnostic guide. Begin with what the user observes, then trace back to the root cause.

**Docs:** [Monitoring](https://docs.confluent.io/platform/current/streams/monitoring.md) | [Troubleshooting](https://docs.confluent.io/platform/current/streams/developer-guide/running-app.md)

## Table of Contents
- [Startup Failures](#startup-failures)
- [Processing Stalls](#processing-stalls)
- [Rebalancing Issues](#rebalancing-issues)
- [Performance](#performance)
- [Deserialization Errors](#deserialization-errors)
- [State Store Issues](#state-store-issues)
- [Thread Failures](#thread-failures)
- [Memory Issues](#memory-issues)
- [Key Metrics to Monitor](#key-metrics)
- [Confluent Cloud Gotchas](#confluent-cloud-gotchas)
- [Security / ACL Issues](#security--acl-issues)
- [EOS / Transaction Issues](#eos--transaction-issues)
- [Additional Failure Patterns](#additional-failure-patterns)
- [Common Error Messages](#common-error-messages)

---

## Startup Failures

### UnsupportedVersionException on startup
**Cause:** `group.protocol=streams` (KIP-1071) requires AK 4.2+ / CP 8.2+. The broker version is too old.
**Fix:** Remove `group.protocol=streams` from the config. Upgrade the broker when possible.

### TopologyException: Invalid topology
**Cause:** The topology is malformed — typically due to missing source topics, duplicate store names, or circular dependencies.
**Fix:** Inspect `TopologyBuilder.build()` — confirm all source topics exist and all store names are unique.

### StreamsException: Could not find state directory
**Cause:** `state.dir` references a directory that does not exist or is not writable.
**Fix:** Create the directory or update `state.dir`. In containers, verify the directory is mounted and has write permissions.

### Schema Registry connection timeout / serde hang
**Cause:** Confluent SR serdes contact the Schema Registry during `configure()`. When SR is unreachable, the app hangs.
**Diagnosis:**
1. Verify SR URL is reachable: `curl <SR_URL>/subjects`
2. Ask user: SR API key/secret correct? NEVER read the actual credentials whether in a .env file or a properties file
3. Enable DEBUG logging: `io.confluent.kafka.serializers=DEBUG`
4. Check version compatibility: Confluent serde version should match SR version
**Fix:** Correct the SR URL, authentication, or network path. The serde will initialize once SR becomes reachable.

### ConfigException: Missing required config
**Commonly absent configs:**
- `application.id` — always required
- `bootstrap.servers` — always required
- `default.key.serde` / `default.value.serde` — required whenever an internal topic is created (groupBy, selectKey, join)

---

## Processing Stalls

### App runs but produces no output

**Diagnostic steps:**
1. **Check consumer lag:** Are new records arriving on the input topics?
   ```bash
   # CC
   confluent kafka consumer-group describe <application.id>
   # Local
   kafka-consumer-groups --bootstrap-server localhost:9092 --group <application.id> --describe
   ```
2. **Check state:** Is the app in RUNNING state? Check `/health/ready` or inspect logs for state transitions.
3. **Check for exceptions:** Look for `LogAndContinueExceptionHandler` messages — the app may be silently dropping all records due to deserialization errors.
4. **Check filter predicates:** If `.filter()` is used, verify the predicate is not excluding every record.
5. **Check join windows:** For stream-stream joins, records that fall outside the join window are silently discarded.

### App processes slowly then stops

**Likely cause:** `max.poll.interval.ms` is exceeded → consumer is evicted → rebalance occurs → state restoration begins → restoration exceeds the timeout → evicted again (loop).
**Fix:** Increase `consumer.max.poll.interval.ms` or decrease `consumer.max.poll.records`.

### Stream-table join produces nulls

**Causes:**
1. **Table not yet populated:** The KTable reads from a compacted topic. When stream records arrive before the table is populated, joins return null.
   - Fix: Pre-populate the table topic before starting the stream, or switch to `leftJoin()` and handle nulls explicitly.
2. **Co-partitioning violation:** The stream and table must have identical partition counts and use the same partitioning strategy.
   - Fix: Confirm both topics have the same partition count and are keyed identically.
3. **Key mismatch:** The stream key must match the table key exactly in both type and serialization format.

---

## Rebalancing Issues

### Constant rebalancing / rebalance storm

The most common P1 pattern in production Kafka Streams deployments. The failure cascade: processing exceeds `max.poll.interval.ms` → consumer is evicted → rebalance is triggered → state restoration begins → restoration exceeds `max.poll.interval.ms` → evicted again → loop repeats.

**Diagnostic runbook:**
1. **Check `max.poll.interval.ms` violation:**
   - Look for: `Member consumer-<id> has exceeded max.poll.interval.ms`
   - Fix: Increase `consumer.max.poll.interval.ms` (default: 300000 = 5 min)
2. **Check whether state restoration is the bottleneck:**
   - Look for: `Restoration in progress for N partitions`
   - If present, restoration itself exceeds the poll timeout. See "State Restoration Cascade" below.
3. **Check processing time:**
   - Monitor `process-latency-max` and `punctuate-latency-max`
   - Common culprits: blocking external calls (REST, DB), full state store scans in punctuators, slow RocksDB operations
4. **Check instance stability:** Are instances crashing and restarting? (K8s OOM kills, health check failures). For stateful apps, **also compute expected RocksDB off-heap memory** using `architecture.md` § Memory — container OOMs from undersized memory allocations are a frequent rebalance root cause.
5. **Check for CPU throttling:** K8s CPU limits introduce poll delays that trigger rebalances. Never set CPU limits on KS containers.

**Config relationship rules (all must hold):**
- `session.timeout.ms` <= `max.poll.interval.ms` (with cooperative protocol)
- `request.timeout.ms` >= `max.poll.interval.ms`
- For EOS: `transaction.timeout.ms` <= `max.poll.interval.ms`

### 10-Minute Rebalance Loop (Probing Rebalance)

**Symptom:** The app stabilizes, runs for exactly 10 minutes, then rebalances again. The pattern repeats indefinitely.

**Root cause:** `probing.rebalance.interval.ms` defaults to 600000 (10 min). When standby replicas never fully catch up, the probing rebalance fires to redistribute tasks, but the outcome is unchanged and the cycle repeats.

**Diagnosis:**
1. Confirm whether rebalances occur at a consistent interval (~10 min)
2. Check standby replica lag — are they keeping pace?
3. Review changelog topic compaction — is there more data to replay than expected?

**Fix:**
- Raise `acceptable.recovery.lag` to give standbys more time to recover
- Increase `probing.rebalance.interval.ms` (e.g., to 86400000 = 24h) when probing is not needed
- Verify that changelog topic compaction is configured correctly

### Broker Failover Causing Streams Disconnect

**Symptom:** All streams disconnect simultaneously after a broker failure. Errors include `COORDINATOR_NOT_AVAILABLE` or `DisconnectException`.

**Root cause:** The consumer group coordinator was hosted on the failed broker. Reconnection takes longer than `session.timeout.ms`, causing all consumers to be evicted.

**Fix:**
- Set `session.timeout.ms` >= 60000ms in production
- Increase `reconnect.backoff.max.ms` to handle transient reconnections
- Add `num.standby.replicas=1` for faster task failover

### Stuck After Partial Shutdown

**Symptom:** After a partial restart (some pods remain in the group while others restart), new instances repeatedly encounter "group is already rebalancing" and cannot join.

**Root cause:** Zombie members retain the group generation, blocking a clean rejoin.

**Fix:**
1. Bring down ALL instances of the application
2. Wait for `session.timeout.ms` to elapse
3. Restart instances incrementally
4. Implement proper shutdown hooks: `streams.close(Duration.ofSeconds(30))` with `Runtime.getRuntime().addShutdownHook()`
5. In K8s, set `terminationGracePeriodSeconds` >= the `close()` timeout

### Rebalance takes a long time

**With KIP-1071 (`group.protocol=streams`):** Rebalances should complete in seconds. If they are slow, inspect broker logs.
**Without KIP-1071:** Cooperative-sticky rebalancing is the default (since KS 2.4). Prolonged rebalances usually indicate state restoration is underway.

---

## Performance

### High consumer lag

1. **Insufficient parallelism:** Threads × instances < input partitions leaves some partitions unprocessed.
   - Fix: Add more instances or increase `num.stream.threads`
2. **Slow processing:** Topology operations are taking too long.
   - Check `active-process-ratio` — it should exceed 0.5. A value below 0.5 indicates the app spends more time polling than processing.
   - Look for blocking calls inside the topology (REST APIs, DB writes)
3. **Producer backpressure:** The output topic is accepting writes too slowly.
   - Review `producer.batch.size`, `producer.linger.ms`, `producer.compression.type`
4. **State store bottleneck:** RocksDB writes are slow.
   - Check RocksDB metrics; consider increasing `statestore.cache.max.bytes`

### High latency (records take a long time from input to output)

1. **Commit interval too large:** `commit.interval.ms=30000` means records may not be committed and visible downstream for up to 30s.
   - Fix: Reduce `commit.interval.ms` (tradeoff: more frequent commits increase overhead)
2. **Cache deduplication:** `statestore.cache.max.bytes` merges multiple updates to the same key. A larger cache reduces downstream update frequency but increases end-to-end latency.
   - Fix: Reduce cache size, or set to 0 for minimum latency (tradeoff: increased downstream traffic)
3. **Suppression:** When `Suppressed.untilWindowCloses()` is in use, output is held until the window closes plus the grace period.
4. **Producer batching:** `producer.linger.ms` introduces deliberate delay to allow records to accumulate into larger batches.

---

## Deserialization Errors

### "Unknown magic byte!"
**Cause:** The record was produced without Schema Registry (via plain `kafka-console-producer`). SR serdes require a 5-byte header (magic byte + schema ID).
**Fix:** Reproduce the data using schema-aware producers (`kafka-avro-console-producer`, etc.).

### ClassCastException: LinkedHashMap cannot be cast to MyPojo
**Cause:** The JSON Schema serde is missing the `json.value.type` config. Without it, Jackson deserializes the payload as a `LinkedHashMap`.
**Fix:** Set `json.value.type=com.example.MyPojo` on the serde.

### "Cannot construct instance of MyPojo (no Creators)"
**Cause:** The JSON Schema POJO is missing a no-arg constructor, which Jackson requires.
**Fix:** Add `public MyPojo() {}` to the class.

### DynamicMessage instead of typed Protobuf message
**Cause:** The Protobuf serde is missing the `specific.protobuf.value.type` config.
**Fix:** Set `specific.protobuf.value.type=com.example.proto.MyMessage` on the serde.

### Schema incompatibility errors
**Cause:** A schema evolution change broke compatibility — the new schema cannot read old data (or vice versa).
**Fix:** Review SR compatibility settings and reset if necessary — see `references/verification.md` § Resetting Application State.

---

## State Store Issues

### State store growing without bound
**Cause:** A KTable or state store accumulates all unique keys with no expiration policy.
**Fix:** Enforce a TTL via `Materialized.withRetention(Duration.ofDays(30))`, or produce tombstones (null values) for keys that should be expired.

### State Restoration Cascade

After a pod or instance restart, state stores are rebuilt from their changelog topics. For large stores (tens to hundreds of GB), this process takes minutes to hours. During restoration the consumer cannot process records, exceeds `max.poll.interval.ms`, gets evicted, triggers a new rebalance, which cancels and restarts restoration — a death spiral.

**Diagnosis:**
1. Search logs for `Restoration in progress for N partitions`
2. Compare `max.poll.interval.ms` against the estimated restoration time
3. Verify whether persistent volumes (PVCs) are in use — ephemeral storage forces a full restoration on every restart
4. **Calculate expected RocksDB memory for the user's topology** using the per-store formula in `architecture.md` § Memory (block_cache 50MB + write_buffers 16MB × 3 ≈ 98MB per store-partition; multiply by partitions/instance × stores × segments for windowed stores). Container OOMs and oversized JVM heap that starves RocksDB are common rebalance triggers.

**Fix:**
1. **Use persistent volumes (PVCs) in K8s** — this prevents full restoration on pod restart and is critical for stateful apps
2. Increase `consumer.max.poll.interval.ms` to at least 2x the expected restoration time
3. Increase `restore.consumer.fetch.max.bytes` to 50MB or more to accelerate restoration
4. Add `num.standby.replicas=1` to maintain a warm standby
5. Use `acceptable.recovery.lag` to define when tasks are considered sufficiently caught up

### Large State Store Pathology

Applications with very large state stores (100GB+ per partition) exhibit progressively increasing latency on state store operations. This is one of the most frequent causes of extended production outages.

**Root cause:** Full-scan operations (`store.all()`, `seekToFirst()`) executed inside punctuators on large RocksDB stores. The stream thread can spend minutes inside RocksDB, blocking commits and heartbeats, leading to `DisconnectException`, rebalances, and cascading failures.

**Contributing factors:**
- **Tombstone accumulation:** Delete-heavy workloads (queue-like patterns) generate tombstones that `all()` scans must iterate through. Tombstones build up at the head of the keyspace until compaction removes them.
- **Iterator lifecycle:** Long-lived or leaked iterators hold RocksDB resources open. Monitor `num-open-iterators` and `oldest-iterator-open-since-ms`.

**Diagnosis:**
1. Thread dumps reveal the streams thread stuck in RocksDB `seekToFirst()` (RUNNABLE state)
2. Punctuator callbacks taking minutes (e.g., a 30s commit interval expanding to ~10 minutes)
3. `live-sst-files-size` growing unexpectedly
4. `compaction-pending` remaining persistently elevated

**Fix:**
1. **Replace `store.all()` with `store.range(lastProcessedKey, null)`** — process records in batches and avoid full table scans
2. Tune RocksDB compaction for delete-heavy workloads (`CompactionStyle.UNIVERSAL`)
3. Increase background compaction thread count
4. Instrument punctuators to log time per operation and records processed

**RocksDB metrics to monitor:**
- `compaction-pending`, `num-running-compactions`
- `mem-table-flush-pending`, `num-running-flushes`
- `block-cache-usage` / `block-cache-capacity` / `block-cache-pinned-usage`
- `live-sst-files-size`, `total-sst-files-size`
- `cur-size-all-mem-tables`
- `num-open-iterators`, `oldest-iterator-open-since-ms`

### State restoration takes too long
**Causes and remedies:**
1. **Large state:** Reduce state size by applying TTL or writing tombstones
2. **Slow network:** Increase `restore.consumer.fetch.max.bytes` (default 1MB → 50MB)
3. **No standbys:** Add `num.standby.replicas=1` — standbys stay warm and can take over without requiring a full restoration
4. **Compaction lag:** The changelog topic has not been compacted — more data is being replayed than necessary. Trigger compaction on the broker.

### "Error restoring store from changelog" / corruption
**Fix:** Perform a full reset:
1. Stop the app
2. Delete local state: `rm -rf <state.dir>/<application.id>`
3. Run `kafka-streams-application-reset`
4. Restart the app

See `references/verification.md` § Resetting Application State for the complete procedure.

---

## Thread Failures

### StreamThread dies and isn't replaced
**Cause:** No `UncaughtExceptionHandler` is configured — the default behavior is to shut down the entire application on any thread failure.
**Fix:** Install `MaxFailuresUncaughtExceptionHandler` (see SKILL.md § Invariant 4).

### Thread replaced but same error repeats
**Cause:** The problematic record is retried after thread replacement, triggering the same exception.
**Fix:**
1. Add defensive null checks and input validation in topology lambdas
2. Use `ProcessingExceptionHandler` (KIP-1034) to route bad records to a DLQ
3. If the error originates in the deserialization layer, use `LogAndContinueExceptionHandler`

### "ProducerFencedException"
**Causes:**
1. **EOS with slow operations:** The transaction timeout (10s default) has been exceeded.
   - Fix: Increase `transaction.timeout.ms`
2. **Zombie instance:** An old instance is still running with the same `application.id`.
   - Fix: Terminate the old instance. Only one instance per task should be active when EOS is enabled.
3. **Transactional.id expired:** App was idle for more than 7 days on CC.
   - Fix: Restart with a new `application.id`, or handle `InvalidPidMappingException` in the UncaughtExceptionHandler

---

## Memory Issues

### OutOfMemoryError (JVM heap)
1. **Reduce `statestore.cache.max.bytes`** — this allocation is on-heap (default 10MB per thread)
2. **Reduce `num.stream.threads`** — each thread carries its own cache allocation
3. **Increase JVM heap** — but leave sufficient headroom for RocksDB off-heap usage

### Container OOM killed (but JVM heap is fine)
**Cause:** RocksDB off-heap memory consumption exceeds the container memory limit.
**Fix:**
1. Calculate RocksDB memory usage: `(block_cache + write_buffers) × instances` — see architecture.md
2. Set `MaxRAMPercentage=75` to reserve 25% for RocksDB
3. Lower RocksDB memory by implementing a custom `RocksDBConfigSetter` (smaller block cache, fewer write buffers)

### Memory keeps growing
1. **Unbounded state store:** A KTable is accumulating data without a TTL. Fix: add `.withRetention()`.
2. **Unbounded suppression buffer:** `Suppressed.BufferConfig.unbounded()` is in use in production. Fix: switch to `maxRecords(N).shutDownWhenFull()`.
3. **Memory leak in topology lambda:** Custom objects are being held across invocations. Fix: avoid stateful lambdas.

---

## Confluent Cloud Gotchas

### Topics must be pre-created
CC enforces `auto.create.topics.enable=false` at all times. Source, output, and DLQ topics must be created before the app starts. KS internal topics (changelog, repartition) are auto-created provided the service account holds a `CREATE` ACL with a prefix pattern matching `application.id`.

### ACLs required for Kafka Streams on CC
KS apps require broader permissions than a standard consumer/producer:

| Resource | Operation | Pattern |
|----------|-----------|---------|
| Consumer Group | `READ` | `application.id` |
| Source topics | `READ` | Exact topic name |
| Output topics | `WRITE` | Exact topic name |
| Internal topics | `READ`, `WRITE`, `CREATE` | Prefixed with `application.id` |
| Transactional ID (EOS) | `WRITE` | Prefixed with `application.id` |
| Cluster (EOS) | `IDEMPOTENT_WRITE` | Cluster resource |

Any missing ACL results in `TopicAuthorizationException`, `GroupAuthorizationException`, or silent failures.

### CKU throughput limits
When a KS app exceeds CKU produce/consume byte limits, requests are throttled, causing `TimeoutException` and potential rebalances. Monitor `received_bytes` and `sent_bytes` in the CC Console. Fix: increase CKU allocation or spread writes across additional partitions.

### Broker logs not available
On CC, broker logs are not accessible to customers. All troubleshooting must rely exclusively on client-side logs. Enable DEBUG logging for `org.apache.kafka.streams` and `org.apache.kafka.clients.consumer`.

### Audit log growth from KS
KS apps issue frequent `DeleteRecords` calls on repartition topics, each generating an audit log entry. At scale, `confluent-audit-log-events` can accumulate at hundreds of records per second. Fix: configure audit log routing to exclude `kafka.DeleteRecords` events on internal topics.

---

## Security / ACL Issues

### TopicAuthorizationException on internal topics
**Error:** `TopicAuthorizationException` on changelog or repartition topics.
**Cause:** ACLs cover source/output topics but not KS internal topics. Internal topics follow the naming pattern `<application.id>-<operator-name>-<suffix>`.
**Fix:** Grant `READ`, `WRITE`, and `CREATE` using a prefix ACL that matches `application.id`:
```bash
kafka-acls --bootstrap-server <broker> --add \
  --allow-principal User:<service-account> \
  --operation READ --operation WRITE --operation CREATE \
  --topic <application.id> --resource-pattern-type prefixed
```

### mTLS certificate rotation
After a certificate rotation, every KS instance must be restarted with the updated keystore and truststore. Symptoms include `SSL handshake failed`, consumers disappearing from the group, and uneven connectivity across instances.
**Fix:** Update certs → perform a rolling restart of brokers → perform a rolling restart of KS instances. Verify connectivity with: `openssl s_client -connect <broker>:<port>`.

---

## Key Metrics

### Thread-level
| Metric | What it means | Healthy range |
|--------|--------------|---------------|
| `alive-stream-threads` | Currently active threads | Should equal `num.stream.threads` |
| `failed-stream-threads` | Threads that terminated abnormally | Should be 0 |
| `process-rate` | Records processed per second | Depends on workload |
| `commit-rate` | Commits per second | ~1/commit.interval.ms |
| `active-process-ratio` | Fraction of time spent processing vs. polling | > 0.5 |

### Task-level
| Metric | What it means | Healthy range |
|--------|--------------|---------------|
| `process-latency-avg` | Average time to process a single record | Depends on topology |
| `enforced-processing` | Whether KS is forcing record processing | Should be rare |

### State store
| Metric | What it means | Healthy range |
|--------|--------------|---------------|
| `put-latency-avg` | Average state store write latency | < 1ms for local SSD |
| `get-latency-avg` | Average state store read latency | < 1ms for local SSD |
| `suppression-buffer-size-avg` | Current suppression buffer size | Within configured bounds |

### How to access metrics
```java
for (Metric metric : streams.metrics().values()) {
    if (metric.metricName().group().equals("stream-thread-metrics")) {
        System.out.printf("%s = %s%n", metric.metricName().name(), metric.metricValue());
    }
}
```

Alternatively, expose metrics via JMX for consumption by Prometheus/Grafana.

---

## EOS / Transaction Issues

### Transaction timeout cascade

**Symptoms:** Growing consumer lag on specific partitions, `ProducerFencedException` or `InvalidProducerEpochException` in client logs, and broker logs containing `Completed rollback of ongoing transaction for transactionalId ... due to timeout`.

**Root cause:** Processing or state restoration takes longer than `transaction.timeout.ms` (default 10s). The transaction coordinator aborts the transaction, the producer is fenced, a rebalance fires, state must be restored, and the cycle begins again.

**Diagnosis:**
1. Check broker logs: `Completed rollback of ongoing transaction for transactionalId <app-id>-<uuid>-<thread> due to timeout`
2. Check client logs: `InvalidProducerEpochException: Producer attempted to produce with an old epoch`
3. Check client logs: `Detected that the thread is being fenced`
4. Determine whether the issue is partition-specific — data skew can cause certain partitions to lag behind
5. Check whether state restoration is currently in progress

**Fix:**
1. Increase `transaction.timeout.ms` — begin with 60s and raise further if needed (some production apps require 900s)
2. Reduce `consumer.max.poll.records` to limit the number of records processed per transaction
3. Set `consumer.max.poll.interval.ms` >= `transaction.timeout.ms`
4. Add `num.standby.replicas=1` to minimize restoration time

### EOS error amplification (state wipe on unhandled exceptions)

**Symptoms:** With EOS enabled, an application bug (NPE, ClassCastException) triggers a multi-hour outage caused by repeated state wipes and restorations.

**Root cause:** EOS enforces transactional atomicity. When an unhandled exception occurs, KS aborts the transaction, erases local state, and rebuilds from the changelog. For large state stores, each error cycle consumes 40+ minutes of restoration.

**Emergency procedure:**
1. **Immediately** switch to `processing.guarantee=at_least_once` to halt the state-wipe loop
2. Fix the application bug responsible for the crash
3. Add a `ProcessingExceptionHandler` (KIP-1034) to divert bad records to a DLQ
4. Re-enable EOS once the fix is verified

### InvalidPidMappingException (CC-specific)

**Symptoms:** `InvalidPidMappingException: The producer attempted to use a producer id which is not currently assigned to its transactional id`, accompanied by growing consumer lag.

**Root cause:** On Confluent Cloud, transactional ID-to-PID mappings expire after 7 days of inactivity (this timeout is not configurable). Restarting the app after 7+ days of idleness triggers this error.

**Fix:**
1. Restart the application to re-register the transactional ID
2. If the error persists, switch to a new `application.id`
3. Preventive measure: ensure the app executes at least once per week on CC

### TxnOffsetCommitResponse disconnect (KIP-890 bug)

**Symptoms:** `Unexpected error in TxnOffsetCommitResponse: The server disconnected`, followed by `Transiting to fatal error state`. The app shuts down.

**Root cause:** KIP-890 transaction verification bug. During broker rolling restarts, the verification request receives a `DisconnectException` that is treated as fatal. Resolved by Apache Kafka PR #15559.

**Fix:**
1. Upgrade Kafka client libraries to a version that includes the fix
2. Contact support to temporarily disable `transaction.partition.verification.enable` as a workaround

### COORDINATOR_NOT_AVAILABLE after broker failure

**Symptoms:** The app stops processing but does not shut down. After broker recovery, some instances auto-reconnect while others remain stuck with `IllegalStateException: Cannot attempt operation sendOffsetsToTransaction because the previous call to commitTransaction timed out`.

**Root cause:** The transaction coordinator broker is unavailable — `__transaction_state` partition leaders were on the failed broker. Following recovery, some apps enter an unrecoverable state.

**Fix:**
1. Set `transaction.state.log.replication.factor=3` and maintain at least 3 healthy brokers
2. Set `replication.factor=3` for all internal topics
3. Manually restart any app instance that remains stuck after broker recovery
4. Track `alive-stream-threads` and `failed-stream-threads` metrics for early detection

---

## Additional Failure Patterns

### Cloud Load Balancer Idle Connection Drop

**Symptoms:** `DisconnectException` during extended RocksDB operations on Azure/AWS/GCP. The load balancer drops connections that have been idle beyond the configured timeout (typically 4-30 minutes).

**Root cause:** When the stream thread is busy inside RocksDB, no network traffic is sent, causing the load balancer to classify the connection as idle and drop it.

**Fix:**
- Configure OS-level TCP keepalive below the cloud LB idle timeout
- Set `connections.max.idle.ms` below the cloud LB idle timeout
- Address the root cause of long-running operations (see Large State Store Pathology)

### Topology Change Breaking State Stores

**Symptoms:** After deploying a new version with a modified topology, the app fails to start or enters restart/restore loops.

**Root cause:** KS auto-generates names for internal topics and stores based on topology structure. Modifying the topology alters these names, breaking backward compatibility.

**Fix:**
1. Run `kafka-streams-application-reset` to clear state
2. Deploy with a new `application.id` for breaking topology changes
3. Roll back to the previous topology version when possible

**Prevention:**
- Apply `Named.as()` to all operators to pin internal topic names
- Set `ensure.explicit.internal.resource.naming=true`
- Validate topology changes in a non-production environment with state compatibility checks

### Schema Registry Throttling (429 Errors)

**Symptoms:** Schema Registry returns HTTP 429 during startup, causing `SerializationException` or app hangs.

**Root cause:** All instances simultaneously register and look up schemas at startup. CC environments enforce rate limits.

**Fix:**
- Enable schema caching on the client (the default cache is usually adequate)
- Stagger application startup to lower the volume of concurrent SR requests
- Pre-register schemas as part of the CI/CD pipeline
- Set `auto.register.schemas=false` in production

### SSL/TLS Certificate Rotation Breaking Streams

**Symptoms:** Following an SSL certificate rotation, socket timeouts and disconnections destabilize the consumer group and cause lag to grow.

**Fix:**
- Perform a rolling restart of all KS instances after the certificate rotation
- Confirm that new certificates are present in the trust store before initiating rotation
- Increase `reconnect.backoff.max.ms` to tolerate transient reconnection failures

### Post-Upgrade / Migration Issues

**Symptoms:** After upgrading client libraries or migrating to a new cluster, unexpected behavior appears: topology incompatibilities, changed defaults, or protocol mismatches.

**Common breaking changes to examine:**
- Cooperative rebalancing becoming the default (replacing eager rebalancing)
- `exactly_once` deprecated in favor of `exactly_once_v2`
- Internal topic naming changes
- `group.protocol=streams` (KIP-1071) requiring AK 4.2+ / CP 8.2+

**Fix:**
- Validate upgrades in a non-production environment before rolling out
- Consult release notes for breaking changes
- Set `ensure.explicit.internal.resource.naming=true` to lock internal topic names
- Plan for a cooperative rebalancing migration when upgrading from older versions

---

## Quick Error Lookup

- `UnsupportedVersionException` → [§ Startup Failures](#startup-failures)
- `Unknown magic byte!` → [§ Deserialization Errors](#deserialization-errors)
- `ClassCastException: LinkedHashMap` → [§ Deserialization Errors](#deserialization-errors)
- `InvalidPidMappingException` → [§ EOS / Transaction Issues](#eos--transaction-issues)
- `ProducerFencedException` → [§ Thread Failures](#thread-failures) or [§ EOS](#eos--transaction-issues)
- `Member has exceeded max.poll.interval.ms` → [§ Rebalancing Issues](#rebalancing-issues)
- `TopicAuthorizationException` → [§ Security / ACL Issues](#security--acl-issues)
- `NO-SOURCE` in Avro build → `schema-patterns.md` (wrong directory)
- Transaction rollback due to timeout → [§ EOS / Transaction Issues](#eos--transaction-issues)
