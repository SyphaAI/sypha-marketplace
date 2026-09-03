---
title: Use Archive Pattern for Historical Data
impact: MEDIUM
impactDescription: "Reduces active collection size, improves query performance, lowers storage costs"
tags: schema, patterns, archive, data-lifecycle, merge, ttl, online-archive
---

## Use Archive Pattern for Historical Data

**Mixing old and recent data in a single collection hurts performance.** As collections accumulate historical records that are rarely queried, reads slow down, indexes swell, and the working set outgrows available RAM. The archive pattern relocates old data to separate storage, preserving fast access to the active collection.

**Incorrect (all data in one collection):**

A sales collection spanning 5 years of data (50M documents) in which only the most recent 6 months are actively queried incurs several penalties: indexes must cover all 50M documents even though only ~1M are relevant, old data pages compete with recent ones in the working set, backups include infrequently accessed history, and hot-tier storage costs are paid for data that could live on cheaper cold storage.

**Correct (archive old data separately):**

```javascript
// Step 1: Define archive threshold (older than 6 months)
const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

// Step 2: Move old data to archive collection using $merge
db.sales.aggregate([
  { $match: { date: { $lt: sixMonthsAgo } } },
  { $merge: {
      into: "sales_archive",
      on: "_id",
      whenMatched: "keepExisting",  // Don't overwrite if re-run
      whenNotMatched: "insert"
    }
  }
])

// Step 3: Delete archived data from active collection
db.sales.deleteMany({ date: { $lt: sixMonthsAgo } })

// Result:
// - sales: Recent data, fast queries, small indexes
// - sales_archive: Historical data, rarely queried
```

**Archive storage options (best to worst on cost/performance):**

1. **External file storage (S3, cloud object storage)** — Best choice for compliance and long-term retention at the lowest cost. Export data to JSON/BSON, store in S3, and query via Atlas Data Federation when needed.
2. **Separate, lower-cost cluster** — Best when historical queries occur occasionally. Replicate data to a lower-tier Atlas cluster at reduced cost.
3. **Separate collection on the same cluster** — Best for straightforward implementation when historical data is accessed frequently. Works exactly like the `sales_archive` example above, though it remains on the same storage tier.
4. **Atlas Online Archive (Atlas only)** — MongoDB automatically moves data to managed cloud object storage; archived data is queried transparently through a Federated Database Instance.

**Design tips for archivable schemas:**

```javascript
// TIP 1: Use embedded data model for archives
// Archived data must be self-contained

// BAD: References that may be deleted
{
  _id: "order123",
  customerId: "cust456",  // Customer may be deleted
  productIds: ["prod1", "prod2"]  // Products may change
}

// GOOD: Embedded snapshot of related data
{
  _id: "order123",
  customer: {
    _id: "cust456",
    name: "Jane Doe",
    email: "jane@example.com"
  },
  products: [
    { _id: "prod1", name: "Widget", price: 29.99 },
    { _id: "prod2", name: "Gadget", price: 49.99 }
  ],
  date: ISODate("2020-01-15")
}

// TIP 2: Store age in a single, indexable field
// Makes archive queries efficient
{
  date: ISODate("2020-01-15"),  // Single field for age
  // NOT: { year: 2020, month: 1, day: 15 }
}

// TIP 3: Handle "never expire" documents
{
  date: ISODate("2025-01-15"),
  retentionPolicy: "permanent"  // Or use far-future date
}

// Archive query excludes permanent records:
db.sales.aggregate([
  { $match: {
      date: { $lt: fiveYearsAgo },
      retentionPolicy: { $ne: "permanent" }
    }
  },
  { $merge: { into: "sales_archive" } }
])
```

**Automated archival with scheduling:**

Implement a script (triggered via cron, Atlas Triggers, or an application scheduler) that:

1. Counts documents older than the cutoff date, excluding those marked `retentionPolicy: "permanent"`.
2. Works in batches (e.g. 10,000 IDs at a time) to prevent long-running operations: retrieve a batch of `_id` values, run an aggregation with `$match` and `$merge` to copy them into the archive collection, then call `deleteMany` to remove that batch from the active collection.
3. Logs progress at the end of each batch.

This follows the same `$merge`-based approach shown above while throttling throughput to avoid overloading the cluster.

**Atlas Online Archive (Atlas only):**

Atlas Online Archive automatically tiers data to MongoDB-managed cloud object storage according to a date-field rule (e.g. archive records older than 365 days). Archived data remains queryable through a Federated Database Instance — with slightly higher latency but significantly lower cost. No application code modifications are required.

**When NOT to use archive pattern:**

- **Small datasets**: When the entire dataset fits comfortably in RAM, archiving adds operational complexity with no meaningful benefit.
- **Uniform access patterns**: When old and new data are queried with similar frequency.
- **Compliance requires instant access**: When regulations mandate sub-second query times across all historical records.
- **Deletion is the intent**: If data should be discarded rather than preserved, use TTL indexes instead.

## Verify with

```javascript
// Analyze archive candidates
const cutoff = new Date()
cutoff.setFullYear(cutoff.getFullYear() - 5)

db.sales.aggregate([
  { $facet: {
      total: [{ $count: "count" }],
      old: [
        { $match: { date: { $lt: cutoff } } },
        { $count: "count" }
      ]
    }
  }
])
// When old documents exceed 30% of the total, archiving is likely to improve performance
```

Reference: [Archive Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/archive/)
