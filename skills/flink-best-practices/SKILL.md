---
name: flink-best-practices
description: >-
  Apache Flink development best practices covering DataStream API, state
  management, checkpointing, event time processing, and deployment guidance
metadata:
  category: data
  source:
    repository: 'https://github.com/BigDataBoutique/skills'
    path: flink-best-practices
    license_path: LICENSE
    commit: 1831ce77355a610d52b3545a96f9779476ed0681
---

# Apache Flink Best Practices

## Core Principles

- Assign stable UIDs to every operator — required for savepoint compatibility
- Apply keyed state with TTL — unbounded state is the #1 cause of production failures
- Rely on event time with watermarks — processing time is non-deterministic on replay
- Adopt RocksDB state backend with incremental checkpoints for production
- Avoid blocking I/O in operators — use `AsyncDataStream` instead
- Name every operator to aid debuggability in the Flink Web UI
- Run production workloads in Application Mode

## Application Structure (HIGH)

### app-operator-uids

**Assign `.uid("stable-id")` to every operator. This is mandatory.**

Without UIDs, Flink is unable to map state across job restarts or savepoint-based upgrades. Absent UIDs result in state loss whenever a job is modified.

```java
DataStream<Event> events = env
    .addSource(kafkaSource)
    .name("kafka-source")
    .uid("kafka-source-uid")
    .map(new EventParser())
    .name("event-parser")
    .uid("event-parser-uid")
    .keyBy(Event::getUserId)
    .process(new UserSessionProcessor())
    .name("session-processor")
    .uid("session-processor-uid");
```

### app-job-design

**One job per pipeline. Keep `main()` clean.**

Construct the `StreamExecutionEnvironment`, define the DAG, then call `execute()`. Move business logic into dedicated `ProcessFunction` or `MapFunction` classes rather than using inline lambdas for anything complex.

Externalize all configuration (Kafka brokers, parallelism, checkpoint intervals) through `ParameterTool` or Flink's `Configuration` object. Never hardcode values.

### app-max-parallelism

**Set `env.setMaxParallelism()` explicitly (power of 2, e.g., 128, 256).**

The default max parallelism cannot be altered after the first savepoint without incurring state loss. Configure it from the start to accommodate future scaling.

---

## DataStream API (HIGH)

### datastream-operator-selection

**Select the appropriate operator abstraction.**

| Need | Use |
|------|-----|
| 1:1 transformation | `map` |
| 1:N transformation | `flatMap` |
| Predicate filtering | `filter` |
| Keyed state + timers | `KeyedProcessFunction` |
| Lifecycle hooks (`open`/`close`) | `RichMapFunction`, `RichFlatMapFunction` |

### datastream-type-system

**Use POJOs for optimal serialization performance.**

Flink's POJO serializer is considerably faster than Kryo. A valid POJO requires public fields or getters/setters, plus a no-arg constructor.

- Avoid `GenericTypeInfo` (Kryo fallback) — it is slow and blocks optimizations
- When "is being handled as a GenericType" appears in logs, resolve the type
- Register custom types via `env.getConfig().registerTypeWithKryoSerializer()` only as a last resort
- For generic types, use `TypeInformation.of(new TypeHint<Tuple2<String, Long>>(){})`

### datastream-operator-chaining

**Do not disable operator chaining globally.**

Chaining removes serialization overhead between operators that share a task. Break a chain with `.disableChaining()` on a specific operator only when debugging or resource isolation demands it.

Use `.slotSharingGroup("name")` to confine resource-intensive operators to their own dedicated slots.

### datastream-parallelism

**Set source parallelism equal to the input partition count.**

For Kafka sources, align parallelism with the number of topic partitions. Downstream operators may use a different parallelism level. Use `keyBy()` for logical partitioning — the key selection governs data distribution and state locality.

Avoid hot keys (those carrying disproportionate traffic). For skewed distributions, consider pre-aggregation or key salting.

---

## Table API and Flink SQL (HIGH)

### sql-prefer-for-etl

**Prefer Flink SQL for ETL, aggregations, and joins — it takes advantage of the query optimizer.**

Use `CREATE TABLE` DDL together with connector properties. Define watermarks directly in DDL:

```sql
CREATE TABLE orders (
    order_id STRING,
    user_id STRING,
    amount DECIMAL(10, 2),
    order_time TIMESTAMP(3),
    WATERMARK FOR order_time AS order_time - INTERVAL '10' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'orders',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json',
    'scan.startup.mode' = 'latest-offset'
);
```

### sql-state-ttl

**Always configure `table.exec.state.ttl` for streaming SQL — without it, state grows indefinitely.**

```sql
SET 'table.exec.state.ttl' = '24 h';

SELECT user_id, COUNT(*) as order_count, SUM(amount) as total
FROM orders
GROUP BY user_id;
```

Without TTL, streaming joins and group-by aggregations accumulate state without bound.

### sql-temporal-joins

**Prefer temporal joins for versioned lookups over regular stream-stream joins.**

```sql
SELECT o.order_id, o.amount, c.currency_rate
FROM orders AS o
JOIN currency_rates FOR SYSTEM_TIME AS OF o.order_time AS c
ON o.currency = c.currency;
```

Regular stream-stream joins retain state on both sides indefinitely unless TTL is configured. For streaming workloads, prefer `INTERVAL` joins or temporal joins.

---

## State Management (CRITICAL)

### state-keyed-state-types

**Select the correct state primitive for the job.**

| Type | Use When |
|------|----------|
| `ValueState<T>` | Single value per key |
| `ListState<T>` | List of values per key |
| `MapState<K,V>` | Key-value lookups per key |
| `ReducingState<T>` | Incrementally reduced aggregate |
| `AggregatingState<IN,OUT>` | Incrementally aggregated with different output type |

### state-mapstate-over-valuemap

**Use `MapState<K,V>` rather than `ValueState<Map<K,V>>`.**

Under RocksDB, `MapState` persists each entry as a distinct RocksDB key, allowing lazy deserialization. `ValueState<Map>` serializes and deserializes the entire map on every access — a severe bottleneck for large maps.

### state-ttl

**Apply state TTL to all keyed state to guard against unbounded growth.**

```java
StateTtlConfig ttlConfig = StateTtlConfig
    .newBuilder(Duration.ofHours(24))
    .setUpdateType(StateTtlConfig.UpdateType.OnCreateAndWrite)
    .setStateVisibility(StateTtlConfig.StateVisibility.NeverReturnExpired)
    .cleanupInRocksdbCompactFilter(1000)
    .build();

ValueStateDescriptor<MyState> descriptor =
    new ValueStateDescriptor<>("my-state", MyState.class);
descriptor.enableTimeToLive(ttlConfig);
```

Unbounded state is the leading cause of production failures — ultimately resulting in OOM errors or disk exhaustion.

### state-backend-rocksdb

**Use EmbeddedRocksDBStateBackend with incremental checkpoints in production.**

```java
env.setStateBackend(new EmbeddedRocksDBStateBackend(true)); // true = incremental
```

Reserve HashMapStateBackend for situations where state is guaranteed to be small and you require the lowest possible latency (development environments, small jobs).

| Backend | State Location | Incremental Checkpoints | Best For |
|---------|---------------|------------------------|----------|
| HashMapStateBackend | JVM heap | No | Small state, dev/test |
| EmbeddedRocksDBStateBackend | Local disk (off-heap) | Yes | Production, large state |

### state-rocksdb-tuning

**Tune RocksDB settings for production workloads.**

```yaml
state.backend.rocksdb.block.cache-size: 128m      # increase for read-heavy state access
state.backend.rocksdb.writebuffer.size: 64m
state.backend.rocksdb.writebuffer.count: 4
state.backend.rocksdb.bloom-filter.bits-per-key: 10
state.backend.rocksdb.predefined-options: FLASH_SSD_OPTIMIZED  # or SPINNING_DISK_OPTIMIZED_HIGH_MEM
```

Note: By default, Flink reserves a portion of managed memory for RocksDB block cache and write buffers. Explicit values set here override that managed memory allocation.

---

## Checkpointing (CRITICAL)

### checkpoint-configuration

**Set up checkpointing appropriately for production use.**

```java
CheckpointConfig config = env.getCheckpointConfig();
config.setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
config.setCheckpointInterval(60_000);              // 1 minute
config.setCheckpointTimeout(600_000);              // 10 minutes
config.setMinPauseBetweenCheckpoints(30_000);      // prevent checkpoint storms
config.setMaxConcurrentCheckpoints(1);
config.setTolerableCheckpointFailureNumber(3);
config.setExternalizedCheckpointRetention(
    ExternalizedCheckpointRetention.RETAIN_ON_CANCELLATION
);
```

**Checkpoint interval guidance:**
- Short (10–30s): quicker recovery, but higher I/O overhead
- Long (5–10min): lower overhead, but longer recovery time
- Begin at 1–3 minutes, then tune based on recovery requirements and checkpoint duration

### checkpoint-storage

**Store checkpoints on a distributed filesystem. Never rely on JobManager storage in production.**

```yaml
state.checkpoints.dir: s3://bucket/flink/checkpoints
state.savepoints.dir: s3://bucket/flink/savepoints
```

JobManager checkpoint storage resides on the JM heap and is lost whenever the JM fails.

### checkpoint-unaligned

**Enable unaligned checkpoints when backpressure is causing checkpoint barriers to stall.**

```java
config.enableUnalignedCheckpoints();
```

Unaligned checkpoints capture in-flight data alongside state, making checkpoint duration independent of backpressure. The trade-off is a larger checkpoint size.

### checkpoint-savepoints

**Always take a savepoint before stopping a job for upgrades.**

```bash
flink savepoint <jobId> [targetDir]
```

Savepoints depend on stable operator UIDs. For Flink version upgrades, use savepoints rather than checkpoints. Without UIDs, state restoration is impossible.

---

## Watermarks and Event Time (CRITICAL)

### watermark-strategy

**Assign watermarks as near to the source as possible.**

```java
WatermarkStrategy.<Event>forBoundedOutOfOrderness(Duration.ofSeconds(10))
    .withTimestampAssigner((event, timestamp) -> event.getEventTime())
    .withIdleness(Duration.ofMinutes(1));
```

### watermark-idleness

**Always configure `withIdleness()` when source partitions may become idle.**

Without this setting, an idle partition blocks the watermark from advancing across the entire job, stalling all downstream windows. This is among the most frequent production issues encountered.

### watermark-late-data

**Handle late-arriving data explicitly.**

Late events — those arriving after the watermark has passed the window end — are discarded by default. Available options:
- Use `allowedLateness()` on windows to accept late records
- Redirect late data to a side output for independent processing
- Track watermark lag through the `currentInputWatermark` metric

### watermark-alignment

**Apply watermark alignment when fast sources push watermarks far ahead of slower sources.**

```java
WatermarkStrategy.<Event>forBoundedOutOfOrderness(Duration.ofSeconds(5))
    .withWatermarkAlignment("alignment-group", Duration.ofSeconds(20), Duration.ofSeconds(2));
```

---

## Window Operations (HIGH)

### window-types

**Choose the appropriate window type for the use case.**

| Type | Use When | Caution |
|------|----------|---------|
| Tumbling | Fixed-size, non-overlapping (per-minute counts) | None |
| Sliding | Moving averages | Creates N instances per element (size/slide ratio) — state explosion if ratio > 10 |
| Session | User session analysis (gap-based) | Expensive due to window merging |
| Global | Custom triggers (count-based) | Requires explicit trigger |

### window-reduce-over-process

**Prefer `reduce()` / `aggregate()` over `ProcessWindowFunction`.**

- `ReduceFunction`: highest efficiency, incrementally reduces without buffering
- `AggregateFunction`: incremental aggregation using an accumulator
- `ProcessWindowFunction`: buffers all elements — use only when access to all elements or window metadata is necessary

Combine them to get the best of both approaches: `reduce(myReducer, myProcessWindowFunction)`.

```java
stream
    .keyBy(Event::getUserId)
    .window(TumblingEventTimeWindows.of(Duration.ofMinutes(5)))
    .allowedLateness(Duration.ofMinutes(1))
    .sideOutputLateData(lateOutputTag)
    .reduce(new MyReduceFunction())
    .name("5min-tumble")
    .uid("5min-tumble-uid");
```

---

## Connectors (HIGH)

### connector-kafka

**Configure the Kafka source and sink properly.**

```java
KafkaSource<Event> source = KafkaSource.<Event>builder()
    .setBootstrapServers("kafka:9092")
    .setTopics("events")
    .setGroupId("flink-consumer-group")
    .setStartingOffsets(OffsetsInitializer.committedOffsets(OffsetResetStrategy.LATEST))
    .setValueOnlyDeserializer(new EventDeserializationSchema())
    .build();

KafkaSink<Event> sink = KafkaSink.<Event>builder()
    .setBootstrapServers("kafka:9092")
    .setRecordSerializer(...)
    .setDeliveryGuarantee(DeliveryGuarantee.EXACTLY_ONCE)
    .setTransactionalIdPrefix("flink-kafka-sink")
    .build();
```

- Match source parallelism to the number of Kafka partitions
- For exactly-once sinks, Kafka `transaction.timeout.ms` must be greater than Flink's checkpoint interval plus the maximum checkpoint duration (configure to at least 15 minutes)
- Downstream consumers must configure `isolation.level=read_committed`

### connector-serialization

**Use schema-based serialization — do not use Kryo for connector records.**

- **Avro**: supports schema evolution, with native Flink support through `flink-avro`
- **Protobuf**: highest throughput, available via `flink-protobuf`
- **JSON**: human-readable but slower than binary formats
- For Flink SQL, use `'format' = 'json'`, `'format' = 'avro'`, or `'format' = 'protobuf'`

### connector-filesystem

**Set a rolling policy for filesystem sinks.**

```sql
CREATE TABLE output (
    user_id STRING,
    event_count BIGINT
) WITH (
    'connector' = 'filesystem',
    'path' = 's3://bucket/output/',
    'format' = 'parquet',
    'sink.rolling-policy.file-size' = '128MB',
    'sink.rolling-policy.rollover-interval' = '10 min',
    'sink.partition-commit.policy.kind' = 'success-file'
);
```

---

## Memory Management (HIGH)

### memory-configuration

**Configure total process memory rather than individual memory components.**

```yaml
taskmanager.memory.process.size: 4096m
taskmanager.memory.managed.fraction: 0.5    # increase for RocksDB-heavy jobs (0.5-0.7)
taskmanager.memory.network.fraction: 0.1    # increase if network buffer backpressure
taskmanager.numberOfTaskSlots: 2            # 2-4 slots per TM
taskmanager.memory.task.heap.size: 1024m    # for user code objects
```

- Opt for fewer slots with more memory each, rather than many slots with little memory
- For RocksDB, managed memory feeds the block cache and write buffers — more managed memory translates to better performance
- Watch GC pauses; when GC becomes a bottleneck, shrink the heap and migrate state to RocksDB (off-heap)

---

## Backpressure (HIGH)

### backpressure-diagnosis

**Use the Flink Web UI to pinpoint backpressure bottlenecks.**

Inspect the `busyTimeMsPerSecond` metric per operator — values approaching 1000 signal saturation. The bottleneck is the first operator showing high busyness alongside a low output rate. Backpressure then propagates upstream from that point.

### backpressure-solutions

**Address backpressure in this order of preference:**

1. **Optimize the slow operator** — reduce the computation performed per record
2. **Increase the parallelism** of the bottleneck operator only
3. **Use async I/O** for external lookups (database, API calls)
4. **Buffer and batch** external writes using `ProcessFunction` + timers

```java
AsyncDataStream.unorderedWait(
    stream,
    new AsyncDatabaseLookup(),
    30, TimeUnit.SECONDS,
    100  // max concurrent requests
).name("async-db-lookup").uid("async-db-lookup-uid");
```

**Never** perform blocking I/O inside `map()`/`flatMap()`/`processElement()`. Do not use `Thread.sleep()` within operators under any circumstances.

---

## Exactly-Once Semantics (HIGH)

### exactly-once-requirements

**End-to-end exactly-once delivery requires all three of the following components.**

1. **Source**: must be replayable (e.g., Kafka with offset tracking)
2. **Flink**: exactly-once checkpointing must be enabled
3. **Sink**: must be transactional (two-phase commit) or idempotent (upsert by key)

For Kafka end-to-end exactly-once: the source tracks offsets in checkpoint state, the sink uses Kafka transactions, and downstream consumers must set `isolation.level=read_committed`.

---

## Deployment (HIGH)

### deployment-application-mode

**Deploy production workloads in Application Mode.**

Each job receives its own dedicated JobManager, providing maximum isolation with no resource contention between jobs. Reserve Session Mode for development or scenarios involving many small, short-lived jobs.

### deployment-kubernetes

**Manage jobs declaratively with the Flink Kubernetes Operator.**

```yaml
apiVersion: flink.apache.org/v1beta1
kind: FlinkDeployment
metadata:
  name: my-flink-job
spec:
  image: ${FLINK_IMAGE_REF:?Set FLINK_IMAGE_REF to my-registry/my-flink-job@sha256:<reviewed-digest>}
  flinkVersion: v1_19
  flinkConfiguration:
    state.backend.type: rocksdb
    state.backend.incremental: "true"
    state.checkpoints.dir: s3://bucket/checkpoints
    state.savepoints.dir: s3://bucket/savepoints
    execution.checkpointing.interval: "60000"
    execution.checkpointing.min-pause: "30000"
    high-availability.type: kubernetes
    high-availability.storageDir: s3://bucket/ha
  jobManager:
    resource:
      memory: "2048m"
      cpu: 1
  taskManager:
    resource:
      memory: "4096m"
      cpu: 2
    taskSlots: 2
  job:
    jarURI: local:///opt/flink/usrlib/my-job.jar
    parallelism: 4
    upgradeMode: savepoint
    state: running
```

Set `upgradeMode: savepoint` for stateful upgrades — this takes a savepoint, stops the job, redeploys, and then restores from the savepoint.

---

## Testing (MEDIUM)

### testing-unit

**Test plain functions as ordinary Java objects. Validate stateful operators using test harnesses.**

```java
// Unit test: plain function
@Test
public void testEventParser() {
    EventParser parser = new EventParser();
    Event result = parser.map(rawInput);
    assertEquals("click", result.getType());
}

// Stateful operator test with harness
OneInputStreamOperatorTestHarness<Event, Result> harness =
    ProcessFunctionTestHarnesses.forKeyedProcessFunction(
        new MyKeyedProcessFunction(),
        Event::getKey,
        Types.STRING);

harness.processElement(new StreamRecord<>(event, timestamp));
harness.processWatermark(new Watermark(timestamp));
// Assert on harness.extractOutputStreamRecords()
harness.close();
```

### testing-integration

**Run integration tests with MiniCluster. For Kafka-based tests, use Testcontainers.**

```java
// JUnit 5 (recommended)
@RegisterExtension
static final MiniClusterExtension MINI_CLUSTER = new MiniClusterExtension(
    new MiniClusterResourceConfiguration.Builder()
        .setNumberSlotsPerTaskManager(2)
        .setNumberTaskManagers(1)
        .build());
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Solution |
|---|---|---|
| Missing operator UIDs | State lost on savepoint restore | Always set `.uid("stable-id")` |
| `ValueState<HashMap<K,V>>` with RocksDB | Full map serialized on every access | Use `MapState<K,V>` |
| Blocking I/O in operators | Backpressure, underutilization | Use `AsyncDataStream` |
| Unbounded state without TTL | OOM / disk exhaustion | Configure state TTL |
| Large sliding windows (size/slide > 10) | State explosion | Use smaller ratios or session windows |
| Processing time when event time is needed | Non-deterministic, incorrect on replay | Use event time with watermarks |
| Ignoring idle sources | Watermarks stall, windows never fire | Set `.withIdleness()` |
| Kryo fallback for state | Slow, no schema evolution | Use POJOs or Avro |
| No `minPauseBetweenCheckpoints` | Checkpoint storms under load | Set to 50%+ of checkpoint interval |
| Default max parallelism | Cannot scale up without losing state | Set explicitly (power of 2) |
| `print()` sink in production | Log I/O bottleneck | Replace with metrics |
| Catching/swallowing exceptions | Silent data loss | Fail fast or route to dead-letter side output |
