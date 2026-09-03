# Topology Patterns Reference

A use-case-driven guide. Begin with the outcome the user wants to achieve, then select the appropriate Kafka Streams primitives.

**Docs:** [DSL API](https://docs.confluent.io/platform/current/streams/developer-guide/dsl-api.md) | [Tutorials](https://github.com/confluentinc/tutorials)

## Table of Contents
- [Stateless Patterns](#stateless-patterns) — filter, map, route, split, merge
- [Enrichment Patterns](#enrichment-patterns) — stream-table join, GlobalKTable, FK join
- [Joins Decision Tree](#joins-decision-tree) — choosing the right join type
- [Aggregation Patterns](#aggregation-patterns) — count, sum, reduce, cogroup
- [Windowing Decision Tree](#windowing-decision-tree) — tumbling, hopping, session, sliding
- [Suppression (Final Results)](#suppression) — emit only when window closes
- [Deduplication](#deduplication) — exactly-once and idempotent patterns
- [Stream Splitting and Routing](#stream-splitting) — modern split() API
- [Processor API](#processor-api) — when DSL isn't enough
- [Exactly-Once Semantics](#exactly-once) — decision tree, when you need it vs at-least-once, EOS config
- [Interactive Queries](#interactive-queries) — queryable state stores
- [Versioned KTables](#versioned-ktables) — temporal correctness for joins
- [Named Operator Rules](#named-operator-rules) — which operators accept Named.as()
- [Recovery Configuration](#recovery) — standby replicas, restoration tuning
- [Assignment Strategy](#assignment-strategy) — KIP-1071, static membership

---

## Stateless Patterns

For: filtering, transforming, and routing records without any state maintenance. These are the simplest patterns to operate.

```java
// Filter
orders.filter((key, order) -> order.getAmount() > 100.0, Named.as("filter-large"))
    .to("large-orders", Produced.with(...).withName("sink-large"));

// Map/Transform
orders.mapValues(order -> new OrderSummary(order.getId(), order.getTotal()), Named.as("map"))
    .to("summaries", Produced.with(...).withName("sink"));

// FlatMap (one-to-many)
orders.flatMapValues(order -> order.getLineItems(), Named.as("explode"))
    .to("items", Produced.with(...).withName("sink"));
```

### Stateless Config
```properties
num.stream.threads=4              # Match CPU cores — no state overhead
commit.interval.ms=1000           # Lower latency (no state store flush)
consumer.fetch.min.bytes=1048576  # 1MB — batch for throughput
producer.batch.size=65536         # 64KB batch
producer.linger.ms=20
producer.compression.type=lz4
```

---

## Enrichment Patterns

For: "I need to attach information from another topic to records in my stream."

**Pattern 1: Stream-Table Join (co-partitioned)**
Use when the lookup key equals the stream key and both topics share the same partition count.

```java
KStream<String, Order> orders = builder.stream("orders", Consumed.with(...).withName("source"));
KTable<String, Customer> customers = builder.table("customers", Consumed.with(...).withName("table"));
orders.leftJoin(customers, (order, customer) -> new EnrichedOrder(order, customer))
    .to("enriched", Produced.with(...).withName("sink"));
```
Requirements: co-partitioned (same key, same partitions). Stream-table joins do NOT accept `Named.as()`.

**Pattern 2: GlobalKTable Join (broadcast)**
Use when the lookup dataset is small, the join key differs from the stream key, or co-partitioning is not feasible.

```java
GlobalKTable<String, Product> products = builder.globalTable("products", Consumed.with(...));
orders.join(products,
    (orderId, order) -> order.getProductId(),  // extract FK
    (order, product) -> new EnrichedOrder(order, product));
```
The GlobalKTable is replicated to every instance (higher memory), co-partitioning is not required, and no changelog topic is created.

**Pattern 3: Foreign Key Table-Table Join**
Use when both inputs are KTables and the join key is a foreign key.

```java
purchases.join(albums,
    TrackPurchase::getAlbumId,  // FK extractor
    (purchase, album) -> new MusicInterest(purchase, album));
```
This creates repartition topics. Updates to the right table propagate to all matching left-table records.

---

## Joins Decision Tree

| Input Types | Same Key? | Solution |
|-------------|-----------|----------|
| Stream + Stream | Yes | Stream-Stream Join (requires JoinWindows, co-partitioned) |
| Stream + Table (lookup) | Yes | Stream-Table Join (co-partitioned) |
| Stream + Table (lookup) | No, table small | GlobalKTable Join |
| Stream + Table (lookup) | No, table large | `selectKey()` + Stream-Table Join |
| Table + Table | Yes | Table-Table Join |
| Table + Table | No (FK) | FK Table-Table Join |

### Stream-Stream Join
```java
KStream<String, OrderEvent> orders = builder.stream("orders", ...);
KStream<String, PaymentEvent> payments = builder.stream("payments", ...);

// Join orders with payments within a 5-minute window
KStream<String, OrderPayment> joined = orders.join(payments,
    (order, payment) -> new OrderPayment(order, payment),
    JoinWindows.ofTimeDifferenceWithNoGrace(Duration.ofMinutes(5)),
    StreamJoined.with(Serdes.String(), orderSerde, paymentSerde)
        .withName("order-payment-join"));
```

**Join types:**
| Method | Left record arrives, right not yet | Right arrives, left not yet |
|--------|-------|-------|
| `join()` | Waits | Waits |
| `leftJoin()` | Emits with null right | Waits |
| `outerJoin()` | Emits with null right | Emits with null left |

### Table-Table Join
```java
KTable<String, UserProfile> profiles = builder.table("profiles", ...);
KTable<String, UserPrefs> prefs = builder.table("preferences", ...);

KTable<String, UserFull> full = profiles.join(prefs,
    (profile, pref) -> new UserFull(profile, pref),
    Named.as("profile-prefs-join"));
```

---

## Aggregation Patterns

```java
// Simple count
orders.groupByKey(Grouped.with(...).withName("group"))
    .count(Named.as("count"), Materialized.as("counts-store"));

// Custom aggregation
transactions.groupByKey(Grouped.with(...).withName("group"))
    .aggregate(
        AccountSummary::new,
        (key, txn, agg) -> agg.add(txn),
        Named.as("aggregate"),
        Materialized.as("summary-store").withKeySerde(...).withValueSerde(...));

// Re-key before aggregation (triggers repartition)
orders.selectKey((k, order) -> order.getRegion(), Named.as("rekey"))
    .groupByKey(Grouped.with(...).withName("group"))
    .count(Named.as("count"), Materialized.as("region-counts"));
```

### Cogrouping (multiple inputs into one aggregation)
```java
// Aggregate login events from three different app streams into one rollup
KGroupedStream<String, LoginEvent> app1 = app1Stream.groupByKey(...);
KGroupedStream<String, LoginEvent> app2 = app2Stream.groupByKey(...);
KGroupedStream<String, LoginEvent> app3 = app3Stream.groupByKey(...);

Aggregator<String, LoginEvent, LoginRollup> aggregator =
    (key, event, rollup) -> rollup.add(event);

KTable<String, LoginRollup> rollup = app1.cogroup(aggregator)
    .cogroup(app2, aggregator)
    .cogroup(app3, aggregator)
    .aggregate(LoginRollup::new, Materialized.with(Serdes.String(), rollupSerde));
```

### Stateful Config
```properties
statestore.cache.max.bytes=52428800   # 50MB — deduplicates updates within cache
state.dir=/var/kafka-streams/state    # Fast local storage, NOT NFS
processing.guarantee=at_least_once    # Default. Use exactly_once_v2 if needed.
```

### RocksDB Memory

The authoritative memory formula and worked examples are in `architecture.md` § Memory (stateful apps). RocksDB uses OFF-HEAP memory — it is not governed by `-Xmx`.

### State Store TTL
```java
// For KTables that accumulate unbounded data, expire old entries
builder.table("input", Consumed.with(...).withName("source"),
    Materialized.<String, Value, KeyValueStore<Bytes, byte[]>>as("my-store")
        .withRetention(Duration.ofDays(30)));   // TTL
```

---

## Windowing Decision Tree

| Use Case | Window Type | API |
|----------|------------|-----|
| Fixed, non-overlapping (e.g., per hour) | Tumbling | `TimeWindows.ofSizeWithNoGrace(Duration)` |
| Fixed, overlapping (e.g., 5-min every 1-min) | Hopping | `TimeWindows...advanceBy(Duration)` |
| Continuous monitoring (fraud, rate limiting) | Sliding | `SlidingWindows.ofTimeDifferenceWithNoGrace(Duration)` |
| Activity gaps (session timeout) | Session | `SessionWindows.ofInactivityGapAndGrace(Duration, Duration)` |
| Stream-stream join | Join | `JoinWindows.ofTimeDifferenceWithNoGrace(Duration)` |

```java
// Tumbling (non-overlapping)
.windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
// With grace for late events:
.windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofMinutes(5), Duration.ofMinutes(1)))

// Hopping (overlapping)
.windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofMinutes(5), Duration.ofMinutes(1))
    .advanceBy(Duration.ofMinutes(1)))

// Sliding (continuous — fraud, rate limiting)
.windowedBy(SlidingWindows.ofTimeDifferenceWithNoGrace(Duration.ofMinutes(10)))

// Session (activity gaps)
.windowedBy(SessionWindows.ofInactivityGapAndGrace(Duration.ofMinutes(5), Duration.ofSeconds(30)))
```

**Session + suppression (final results only):**
```java
.windowedBy(SessionWindows.ofInactivityGapAndGrace(...))
.aggregate(initializer, aggregator, sessionMerger, Materialized.as("store"))
.suppress(Suppressed.untilWindowCloses(BufferConfig.maxRecords(10000).shutDownWhenFull()))
```

**Windowed key unwrapping:**
```java
windowedTable.toStream().map((windowed, count) -> KeyValue.pair(windowed.key(), count))
    .to("output", Produced.with(...));
```

**Retention:** `.withRetention(Duration.ofDays(7))` in `Materialized`.
**Changelog cleanup:** Windowed = `compact,delete`. Non-windowed = `compact`.

---

## Suppression

Emit only final window results (not intermediate updates):

```java
windowedCounts.suppress(Suppressed.untilWindowCloses(
    BufferConfig.maxRecords(10000).shutDownWhenFull()))  // Bounded for production
    .toStream().map((windowed, count) -> KeyValue.pair(windowed.key(), count))
    .to("final-counts", Produced.with(...));
```

Monitor: `suppression-buffer-size-avg`, `suppression-buffer-size-max`.

---

## Deduplication

Use `transform()` with windowed state store to track seen IDs:
```java
events.transform(() -> new DeduplicationTransformer<>(
    Duration.ofMinutes(10), event -> event.getId()), "dedup-store");
```

## Stream Splitting

```java
stream.split(Named.as("split-"))
    .branch((k, v) -> "drama".equals(v.getGenre()),
        Branched.withConsumer(ks -> ks.to("drama", Produced.with(...))))
    .branch((k, v) -> "fantasy".equals(v.getGenre()),
        Branched.withConsumer(ks -> ks.to("fantasy", Produced.with(...))))
    .defaultBranch(Branched.withConsumer(ks -> ks.to("other", Produced.with(...))));
```

---

## Processor API

Use the Processor API when the DSL falls short: for conditional forwarding, access to record metadata, scheduled operations, or custom state store interactions.

**FixedKeyProcessor** (key remains unchanged):
```java
public class EnrichmentProcessor implements FixedKeyProcessor<String, Order, EnrichedOrder> {
    private KeyValueStore<String, Customer> store;
    public void init(FixedKeyProcessorContext<String, EnrichedOrder> ctx) {
        this.store = ctx.getStateStore("customer-store");
    }
    public void process(FixedKeyRecord<String, Order> rec) {
        Customer c = store.get(rec.key());
        if (c != null) context.forward(rec.withValue(new EnrichedOrder(rec.value(), c)));
    }
}
stream.processValues(() -> new EnrichmentProcessor(), Named.as("enrich"), "customer-store");
```

**Processor** (key may change): Use `context.forward(record.withKey(newKey))`. Note: `forward(record)` passes a shared reference — use `record.withValue()` to produce a copy instead.

**Punctuators:**
```java
context.schedule(Duration.ofSeconds(5), PunctuationType.STREAM_TIME, ts -> flushBuffer());
context.schedule(Duration.ofSeconds(20), PunctuationType.WALL_CLOCK_TIME, ts -> heartbeat());
```
STREAM_TIME advances with data. WALL_CLOCK_TIME fires regardless.

**TimestampExtractor:** Built-ins: `FailOnInvalidTimestamp` (default), `LogAndSkipOnInvalidTimestamp`, `UsePartitionTimeOnInvalidTimestamp`, `WallclockTimestampExtractor`.

---

## Exactly-Once

### When EOS is Needed

| Use Case | Needs EOS? | Reason |
|----------|-----------|---------|
| Financial transactions, billing | Yes | Duplicate output = real money problems |
| Cross-topic atomic writes | Yes | All-or-nothing guarantees |
| Non-idempotent state mutations | Yes | Replay corrupts state |
| Aggregations (count, sum, max) | No | State converges, idempotent |
| Enrichment joins | No | Duplicate enriched records harmless |
| Filter/route | No | Duplicates filtered/routed identically |
| Output consumed by external DB | No* | EOS only helps Kafka side; DB needs idempotency |

*For external systems, pair at-least-once delivery with idempotent write patterns (upserts, deduplication keys).

### Cost of EOS

| Metric | At-Least-Once | EOS |
|--------|--------------|-----|
| Throughput | Baseline | 10-30% lower |
| Commit interval | 30s | 100ms (fixed) |
| Write amplification | 1.5x | 2x |
| Min brokers | 1 | 3 |
| Error impact | Replay | State wipe + restoration |

**CC-specific:** Transactional IDs expire after 7 days idle → `InvalidPidMappingException`.

**Configuration:** See `config-baseline.md` § EOS Configuration.
**Troubleshooting:** See `debugging.md` § EOS / Transaction Issues.

---

## Interactive Queries

Config: `application.server=localhost:8080` (unique per instance).

**Query local store:**
```java
ReadOnlyKeyValueStore<String, AccountSummary> store = streams.store(
    StoreQueryParameters.fromNameAndType("account-store", QueryableStoreTypes.keyValueStore()));
AccountSummary result = store.get("account-123");
```

**IQv2 (typed queries):**
```java
StateQueryRequest<...> request = StateQueryRequest.inStore("account-store")
    .withQuery(RangeQuery.withNoBounds()).withPartitions(Set.of(0, 1, 2));
StateQueryResult<...> result = streams.query(request);
```
Query types: `KeyQuery`, `RangeQuery`, `WindowKeyQuery`, `WindowRangeQuery`, `VersionedKeyQuery`, `MultiVersionedKeyQuery`.

**Multi-instance:** Use `streams.queryMetadataForKey(storeName, key, serializer)` to find the active host, proxy if needed.

**Test:** `driver.getKeyValueStore("store-name").get(key)`

---

## Versioned KTables

Use when temporal join correctness is required for frequently-updated tables. This ensures a join uses the table value as of the stream record's timestamp rather than the most recent value.

```java
VersionedBytesStoreSupplier supplier = Stores.persistentVersionedKeyValueStore(
    "versioned-store", Duration.ofMinutes(10));
KTable<String, String> table = builder.table("input", Consumed.with(...),
    Materialized.as(supplier).withKeySerde(...).withValueSerde(...));
```

## Named Operator Rules

| Operator Type | Naming Mechanism |
|--------------|------------------|
| `filter`, `map`, `flatMap`, `selectKey`, `peek`, `merge`, `split`, `aggregate`, `count`, `reduce`, `toStream` | `Named.as("name")` |
| `groupByKey`, `groupBy` | `Grouped.as("name")` |
| Stream-table join | NO naming (won't compile) |
| Stream-stream join | `StreamJoined.withName("name")` |
| Table-table join | `Named.as("name")` |

---

## Recovery {#recovery}

**Standby replicas:** NOT supported when `group.protocol=streams` (KIP-1071). Remove `group.protocol` to fall back to the classic protocol, then set `num.standby.replicas=1`.

**State restoration tuning:**
```properties
consumer.max.poll.interval.ms=600000  # Tolerate slow restoration
restore.consumer.fetch.max.bytes=52428800  # 50 MB — speed up
```
The root cause of restoration loops is: RocksDB compaction blocks the poll → `max.poll.interval.ms` is exceeded → the consumer is evicted → state is restored → the cycle repeats.

**Custom RocksDB:** Implement `RocksDBConfigSetter` and register it via the `rocksdb.config.setter` property.

---

## Assignment Strategy {#assignment-strategy}

**KIP-1071** (`group.protocol=streams`): This is the default. It requires AK 4.2+/CP 8.2+ and throws `UnsupportedVersionException` on older brokers.

**Unsupported features (as of AK 4.2):**

| Feature | Status | Workaround |
|---------|--------|-----------|
| Static membership (`group.instance.id`) | `ConfigException` | Remove `group.protocol` |
| Regex topic patterns | `UnsupportedOperationException` | Remove `group.protocol` |
| Standby replicas (`num.standby.replicas`) | Must be broker-side | Remove `group.protocol` |
| Warm-up replicas | Ignored | Remove `group.protocol` |
| Online protocol migration | Not supported | Stop all, wait, restart |
| Topology updates without new group | Not supported | New `application.id` |

Workaround: Remove `group.protocol=streams` to use the classic protocol. File an issue at [Apache Kafka GitHub](https://github.com/apache/kafka/issues) describing your use case.

**Static membership (classic protocol only):**
```properties
group.instance.id=${HOSTNAME}  # Unique, stable per instance
session.timeout.ms=60000
heartbeat.interval.ms=10000
```
Suitable for rolling deployments and stateful applications. Pair with standby replicas to minimize rebalance disruption.
