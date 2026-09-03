---
title: Use Bucket Pattern to Group Related Data
impact: MEDIUM
impactDescription: "Reduces document count and can align storage with application access patterns like pagination"
tags: schema, patterns, bucket, grouping, pagination, arrays
---

## Use Bucket Pattern to Group Related Data

**Accumulate a series of related items into bounded arrays inside a single document.** The bucket pattern partitions long data series into discrete objects, lowering document count and aligning storage with how data is actually consumed. It is particularly effective when an application reads data in fixed-size chunks such as pages.

> **For time-series data**, prefer [Time Series Collections](https://www.mongodb.com/docs/manual/core/timeseries-collections/), which handle bucketing automatically with built-in compression and indexing optimizations.

**Incorrect (one document per event):**

Persisting one document per stock trade (e.g. `{ ticker, customerId, type, quantity, date }`) requires the application to paginate through trades with skip/limit, a strategy that degrades as the offset increases. Each trade occupies its own document and index entry.

**Correct (bucket pattern - group by customer, bounded per page):**

Each document holds up to N trades for a single customer (e.g. 10 trades = one page). The `_id` encodes the customer ID and the epoch-seconds timestamp of the first trade (e.g. `"123_1698349623"`), alongside a `count` field and a `history` array of trade objects. One bucket equals one page of data — a regex match on `_id` leverages the default `_id` index with no additional index required, and total document count falls by a factor equal to the bucket size.

**Inserting with an atomic upsert:**

```javascript
// Insert a new trade into the correct bucket
db.trades.findOneAndUpdate(
  {
    "_id": /^123_/,            // Match buckets for this customer
    "count": { $lt: 10 }       // Only if bucket isn't full
  },
  {
    $push: {
      history: {
        type: "buy",
        ticker: "MSFT",
        qty: 42,
        date: ISODate("2023-11-02T11:43:10Z")
      }
    },
    $inc: { count: 1 },
    $setOnInsert: {
      _id: "123_1698939791",   // New bucket ID if upsert fires
      customerId: 123
    }
  },
  { upsert: true, sort: { _id: -1 } }
)
// If a bucket with room exists, the trade is pushed into it
// Otherwise a new bucket document is created
// Array is bounded — never exceeds 10 elements
```

**Query patterns:**

```javascript
// Page 1 of trades for customer 123
db.trades.find({ _id: /^123_/ }).sort({ _id: 1 }).limit(1)

// Page N (e.g. page 10)
db.trades.find({ _id: /^123_/ }).sort({ _id: 1 }).skip(9).limit(1)

// Each returned document IS a page — no per-trade skip/limit needed
```

**Choosing bucket boundaries:**

| Bucketing Strategy | Good For | Example |
|-------------------|----------|---------|
| Fixed count (N items) | Pagination, evenly-sized pages | 10 trades per bucket |
| Time window | Log/event grouping (when not using Time Series Collections) | 1 hour of events per bucket |
| Logical grouping | Domain-driven partitioning | All line items in one order |

**When NOT to use this pattern:**

- **Time-series workloads**: Use [Time Series Collections](https://www.mongodb.com/docs/manual/core/timeseries-collections/) instead — they manage bucketing, compression, and indexing automatically.
- **Random single-item access**: When individual items are frequently queried by their own ID, buckets add unneeded indirection.
- **Low data volumes**: When the total series per entity is small, the additional complexity outweighs any benefit.
- **Highly variable item sizes**: Bucketing is most effective when items are roughly uniform in size, keeping bucket documents predictably sized.

## Verify with

```javascript
// Check that bucket size matches expectations
db.trades.aggregate([
  { $group: {
    _id: null,
    avgCount: { $avg: "$count" },
    maxCount: { $max: "$count" },
    totalBuckets: { $sum: 1 }
  }}
])
// avgCount should be close to your target bucket size
// maxCount should never exceed it

// Check average document size
db.trades.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: { _id: null, avgSize: { $avg: "$size" } } }
])
```

Reference: [Group Data with the Bucket Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/group-data/bucket-pattern/)
