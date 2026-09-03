# WarpStream Client Optimization

WarpStream is Kafka-protocol-compatible but architecturally distinct from Apache Kafka: stateless Agents write directly to object storage (e.g., S3) rather than broker-local disks. This removes replication overhead, disk management, and inter-broker traffic — but alters the performance characteristics. **A small set of client configuration adjustments can yield 10-20x higher throughput.**

Consult this reference whenever the user's target environment is WarpStream. Layer these overrides on top of the standard config baseline for the relevant skill.

**Reference docs:** [WarpStream configuration recommendations](https://docs.warpstream.com/warpstream/kafka/configure-kafka-client/tuning-for-performance.md)

---

## Why Defaults Must Change

| Kafka assumption | WarpStream reality |
|---|---|
| Produce latency is single-digit ms | Produce latency is ~250ms p50 / ~500ms p99 (data must flush to object storage) |
| Each broker owns specific partitions | Any Agent can serve any partition — Agents are stateless and interchangeable |
| `fetch.min.bytes` controls batching | `fetch.min.bytes` is **not supported** by WarpStream |
| Replication factor controls durability | Durability comes from object storage (11 nines); `replication.factor` is cosmetic (hard-coded to 3) |
| Idempotent producers have minimal overhead | Idempotent producers reduce throughput (see [Idempotent Producers and EOS](#idempotent-producers-and-eos)) |

---

## Java Client Overrides (Kafka Streams, Kafka Clients)

Apply these settings on top of the standard config baseline. Any property not listed here remains unchanged.

### Producer

```properties
# Disable idempotence for throughput (see warning above)
enable.idempotence=false

# With idempotence disabled, increase in-flight requests dramatically
max.in.flight.requests.per.connection=1000

# Larger batches amortize object-storage write latency
batch.size=100000
linger.ms=100

# Larger buffer to sustain high in-flight request count
buffer.memory=128000000

# Allow large requests
max.request.size=64000000

# LZ4 compression (WarpStream decompresses and recompresses for storage)
compression.type=lz4

# Higher request timeout for object-storage flush
request.timeout.ms=30000

# Reduce unnecessary metadata refreshes
metadata.max.age.ms=60000

# Rebootstrap on metadata errors (useful when Agents scale)
metadata.recovery.strategy=rebootstrap
```

### Consumer

```properties
# Large fetch sizes — WarpStream appears as a single broker,
# so per-partition limits are the effective bottleneck
fetch.max.bytes=50242880
max.partition.fetch.bytes=50242880

# Long wait — fetch.min.bytes is NOT supported by WarpStream,
# so fetch.max.wait.ms controls how long the Agent waits before responding
fetch.max.wait.ms=10000
```

### Kafka Streams Specific

```properties
# Override the producer/consumer defaults within Streams
producer.batch.size=100000
producer.linger.ms=100
producer.enable.idempotence=false
producer.max.in.flight.requests.per.connection=1000
producer.buffer.memory=128000000
producer.max.request.size=64000000
producer.request.timeout.ms=30000

consumer.fetch.max.bytes=50242880
consumer.max.partition.fetch.bytes=50242880
consumer.fetch.max.wait.ms=10000

# Do NOT set consumer.fetch.min.bytes — unsupported by WarpStream

# Metadata
metadata.max.age.ms=60000
metadata.recovery.strategy=rebootstrap
```

**EOS note for Kafka Streams:** If the user's existing app uses `processing.guarantee=exactly_once_v2`, inform them of the tradeoff:

> EOS enables idempotent producers internally (max 5 in-flight requests). On WarpStream, this reduces throughput and may produce `KAFKA_STORAGE_ERROR` retries. Consider whether `at_least_once` with downstream deduplication would work for your use case. If EOS is required, it will work — plan for additional capacity.

---

## librdkafka / confluent-kafka-python Overrides

These settings apply to any client built on librdkafka, including `confluent-kafka-python`, `confluent-kafka-go`, and `node-rdkafka`.

### Producer

```properties
queue.buffering.max.kbytes=1048576
queue.buffering.max.messages=1000000
message.max.bytes=64000000
batch.size=16000000
batch.num.messages=100000
linger.ms=100
sticky.partitioning.linger.ms=25
enable.idempotence=false
max.in.flight.requests.per.connection=1000000
partitioner=consistent_random
request.timeout.ms=30000
```

### Consumer

```properties
fetch.max.bytes=50242880
max.partition.fetch.bytes=50242880
fetch.wait.max.ms=10000
```

### librdkafka Version Notes

- **librdkafka < 2.8:** Leader epoch mismatch errors occur because WarpStream returns epoch 0 while librdkafka 2.4+ expects monotonically increasing epochs. Workaround: append `ws_sle=true` to the `client.id` (e.g., `client.id=my-app,ws_sle=true`). The proper fix is to upgrade to librdkafka 2.8+.
- **librdkafka < 2.10:** Stale Agent IP addresses are cached during rolling restarts. Upgrade to 2.10.0+.

---

## Kafka Connect Overrides (CDC / Connectors)

When operating Kafka Connect against WarpStream, configure these worker-level overrides through environment variables:

```bash
# Consumer overrides
CONNECT_CONSUMER_FETCH_MAX_BYTES=50242880
CONNECT_CONSUMER_MAX_PARTITION_FETCH_BYTES=50242880
CONNECT_CONSUMER_FETCH_MAX_WAIT_MS=10000

# Producer overrides
CONNECT_PRODUCER_ENABLE_IDEMPOTENCE=false
CONNECT_PRODUCER_MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION=1000
CONNECT_PRODUCER_LINGER_MS=100
CONNECT_PRODUCER_BATCH_SIZE=100000
CONNECT_PRODUCER_BUFFER_MEMORY=128000000
CONNECT_PRODUCER_MAX_REQUEST_SIZE=64000000
CONNECT_PRODUCER_COMPRESSION_TYPE=lz4
CONNECT_PRODUCER_METADATA_MAX_AGE_MS=60000
CONNECT_PRODUCER_METADATA_RECOVERY_STRATEGY=rebootstrap
```

**Note:** CDC pipelines that target WarpStream will incur approximately 250–500ms of additional latency per hop relative to standard Kafka. This may be relevant for near-real-time use cases.

---

## Idempotent Producers and EOS

Enabling idempotent producers (`enable.idempotence=true`) or Exactly-Once Semantics (`processing.guarantee=exactly_once_v2`) degrades throughput on WarpStream. Idempotence caps `max.in.flight.requests.per.connection` at 5, and WarpStream's higher produce latency keeps those slots occupied for longer. The Java client may also encounter retriable `KAFKA_STORAGE_ERROR` errors caused by frequent partition ownership transfers between Agents.

The client configuration overrides above already include `enable.idempotence=false`, which is the recommended default. EOS will function if required, but plan for extra capacity to offset the lower concurrency.

For Kafka Streams specifically: `processing.guarantee=at_least_once` (the default) combined with downstream deduplication is preferred wherever possible.

---

## Zone-Aware Routing

WarpStream bills for cross-AZ network traffic. To eliminate this cost, append `ws_az=<availability-zone>` to the Kafka `client.id`:

```properties
client.id=my-app,ws_az=us-east-1a
```

This instructs WarpStream's service discovery to direct the client to an Agent within the same availability zone. Without this annotation, clients may be routed cross-AZ, adding approximately $0.05/GB on AWS.

**Do NOT enable Kafka's `client.rack` or rack-aware consumer assignment** — these trigger unnecessary rebalances on WarpStream because Agents are stateless and interchangeable.

For Kafka Streams, configure `client.id` in the Streams config (not in `application.id`) — Streams derives producer and consumer client IDs from `client.id`.

---

## Sticky Partitioning

WarpStream Agents combine records from multiple topics and partitions into shared object-storage files. Larger batches mean fewer S3 PUTs, translating directly to lower cost and higher throughput.

To maximize batch sizes:
- **Use null message keys** when ordering across records is not required. This activates sticky partitioning, where the client accumulates records for one partition before rotating to the next.
- **Avoid explicit partition assignment** (`partition=N` in produce calls).
- Only assign message keys when entity-based ordering is a genuine requirement (e.g., all events sharing the same `order_id` must land on the same partition).

---

## Latency Expectations and Tuning

WarpStream prioritizes maximum throughput and minimum cost, accepting higher latency compared to standard Kafka.

| Configuration | p50 Produce | p99 Produce |
|---|---|---|
| Default (S3 Standard) | ~250ms | ~500ms |
| Reduced linger + batch timeout | ~150ms | ~300ms |
| S3 Express One Zone | <80ms | <150ms |
| S3 Express + Lightning Topics | <35ms | <50ms |

**Strategies to reduce latency** (these are cumulative):
1. Lower client `linger.ms` from 100 to 10–25ms (no cost impact).
2. Reduce Agent `WARPSTREAM_BATCH_TIMEOUT` from 250ms to 25ms (increases S3 API costs).
3. Move to a higher WarpStream virtual cluster tier (Pro and Enterprise tiers batch fewer metadata operations).
4. Enable **Lightning Topics** — this skips the synchronous control-plane commit on produce (relaxed consistency trade-off).
5. Switch to the **S3 Express One Zone** storage class (~20% cost increase).

Surface these options whenever the user raises latency concerns. The majority of users should begin with the throughput-optimized defaults.

---

## Things That Don't Apply on WarpStream

The following standard Kafka configurations are either irrelevant or cosmetic on WarpStream — do not set or tune them:

| Config | Why irrelevant |
|---|---|
| `replication.factor` | Always returns 3 (cosmetic). Durability is from object storage. |
| `min.insync.replicas` | Always returns 1. |
| `num.io.threads` / `num.network.threads` | Java broker tunables. WarpStream Agents are written in Go. |
| `log.dirs` / `broker.id` | No local disks, no static broker identities. |
| `log.retention.bytes` | Not supported (hard-coded to -1). Use `log.retention.ms` instead. |
| `fetch.min.bytes` | Not supported. Use `fetch.max.wait.ms` instead. |
| Replica management APIs | `AlterReplicaLogDirs`, `ElectLeaders`, etc. are unsupported. |

---

## Known Client-Specific Issues

### Sarama (Go)
- **Not recommended.** Sarama exhibits liveness and correctness problems with WarpStream, including message ordering failures and data loss risks.
- Use **franz-go** as an alternative.

### Java Client
- When idempotent producers are enabled, expect retriable `KAFKA_STORAGE_ERROR` errors caused by frequent partition ownership transfers between Agents.
- `metadata.recovery.strategy=rebootstrap` aids recovery from stale metadata following Agent scaling events.

### librdkafka
- Refer to the version notes above (epoch mismatch in versions before 2.8; stale IPs in versions before 2.10).
- WarpStream's fetch-size auto-tuning (`WARPSTREAM_AUTO_TUNE_FETCH_LIMITS=true`, enabled by default) treats fetch limits as **uncompressed** bytes rather than compressed. If this results in excessive memory consumption, disable it per-client by adding `ws_dfat=true` to the client ID.

---

## Compacted Topics

WarpStream supports `cleanup.policy=compact` but with the following constraints:
- The cleanup policy cannot be changed between `delete` and `compact` after topic creation.
- The deduplication buffer is limited to 128 MB per partition (~3.27M distinct keys). Records beyond this limit may not be deduplicated.
- Partitions with more than 128 GiB of uncompressed data may retain duplicate records.
- Compaction is scheduled automatically and is not tunable (unlike Kafka's `log.cleaner.min.cleanable.ratio`).

---

## Quick Checklist

When producing code or configurations for a WarpStream target, verify:

- [ ] `enable.idempotence=false` (unless user requires EOS — inform them of the throughput tradeoff)
- [ ] `max.in.flight.requests.per.connection` raised (1000 Java, 1000000 librdkafka)
- [ ] `linger.ms=100` (or 10-25 for low-latency)
- [ ] `batch.size` increased (100KB+ Java, 16MB librdkafka)
- [ ] `fetch.max.bytes` and `max.partition.fetch.bytes` set to ~50MB
- [ ] `fetch.max.wait.ms=10000`
- [ ] `fetch.min.bytes` NOT set (unsupported)
- [ ] `metadata.max.age.ms=60000`
- [ ] `client.id` includes `ws_az=<az>` for zone-aware routing
- [ ] `compression.type=lz4`
- [ ] No `replication.factor` tuning (cosmetic on WarpStream)
- [ ] Kafka Streams: `processing.guarantee=at_least_once` preferred (if user needs `exactly_once_v2`, inform them of throughput tradeoff)
