---
title: Reduce Unnecessary Collections
impact: CRITICAL
impactDescription: "Reduces avoidable joins when related data is repeatedly queried together"
tags: schema, collections, anti-pattern, embedding, normalization, atlas-suggestion
---

## Reduce Unnecessary Collections

**A high collection count is not, by itself, the anti-pattern.** The actual anti-pattern is treating collections as a replacement for indexes — creating one collection per category, time period, or partition key rather than indexing a single unified collection. Every collection carries a default `_id` index that consumes storage and puts pressure on the replica set, and cross-collection queries must use `$lookup` or `$unionWith`, which adds both complexity and execution overhead.

**Incorrect (one collection per day as partitioning strategy):**

Splitting data by time period into separate collections (e.g. `temperatures_2024_05_10`, `temperatures_2024_05_11`, …) means each collection carries its own default `_id` index (365 collections/year = 365 extra indexes), cross-day queries require `$unionWith` across many collections, schema validation / indexes / TTL rules must be reproduced on every collection, and application code must dynamically construct the collection name for each query.

**Correct (single collection with an index):**

```javascript
// All readings in one collection — the index does the partitioning work
{ _id: ObjectId(), timestamp: ISODate("2024-05-10T10:00:00Z"), temperature: 60 }
{ _id: ObjectId(), timestamp: ISODate("2024-05-10T11:00:00Z"), temperature: 61 }
{ _id: ObjectId(), timestamp: ISODate("2024-05-11T10:00:00Z"), temperature: 68 }

db.temperatures.createIndex({ timestamp: 1 })

// Efficient range query — one collection, one index
db.temperatures.find({
  timestamp: { $gte: ISODate("2024-05-10"), $lt: ISODate("2024-05-11") }
})

// Optional TTL for automatic expiry (e.g. 90 days)
db.temperatures.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 })
```

**Even better (bucket pattern or time series collection):**

For high-volume timestamped data, consolidate readings into buckets or use a native time series collection, which is purpose-built for this workload:

```javascript
// Bucket pattern — one document per day
{
  _id: ISODate("2024-05-10T00:00:00Z"),
  readings: [
    { timestamp: ISODate("2024-05-10T10:00:00Z"), temperature: 60 },
    { timestamp: ISODate("2024-05-10T11:00:00Z"), temperature: 61 },
    { timestamp: ISODate("2024-05-10T12:00:00Z"), temperature: 64 }
  ]
}

// In this particular case, a native time series collection
// is also a good option to consider
db.createCollection("temperatures", {
  timeseries: { timeField: "timestamp", granularity: "hours" }
})
```

**When to use separate collections:**

| Scenario | Separate Collection | Why |
|----------|--------------------|----|
| Data accessed independently | Yes | Different query patterns |
| Unbounded relationships | Yes | Prevents document growth |
| Many-to-many | Yes | Students ↔ Courses |
| 1:1 always together | No (embed) | User and profile |

**When NOT to use this pattern:**

- **Data is genuinely independent**: Products and orders have separate lifecycles; do not embed the full product catalog inside every order.
- **Frequent independent updates**: A customer email change should not cascade across all historical orders — and in practice it should not.
- **Data serves multiple distinct contexts**: An address entity used for shipping, billing, and user profiles should stay in its own collection.
- **Regulatory requirements**: Certain industries mandate normalized data to support audit trails.

## Verify with

```javascript
// Count your collections
for (const d of db.adminCommand({ listDatabases: 1 }).databases) {
  const colls = db.getSiblingDB(d.name).getCollectionNames().length
  print(`${d.name}: ${colls} collections`)
}
// Count alone is not sufficient: combine with access, index, and storage evidence

// Check if collections are always accessed together
// If orders always needs customer, items, addresses
// → they should be embedded
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: { _id: "$ns", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
// Collections with closely matching access patterns are candidates for consolidation
```

Atlas Schema Suggestions flags: "Reduce number of collections"

Reference: [Reduce the Number of Collections](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/reduce-collections/)
