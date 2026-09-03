---
title: Use Extended Reference Pattern
impact: MEDIUM
impactDescription: "Reduces repeated `$lookup` on hot paths by caching selected referenced fields"
tags: schema, patterns, extended-reference, denormalization, caching
---

## Use Extended Reference Pattern

**Duplicate frequently-needed fields from referenced documents into the parent document.** When author name is always displayed alongside articles, embed it there. This removes the need for `$lookup` on common queries while the full dataset remains normalized — combining the advantages of both approaches.

**Incorrect (always $lookup for display data):**

```javascript
// Order references customer by ID only
{
  _id: "order123",
  customerId: "cust456",  // Customer reference by ID only
  items: [...],
  total: 299.99
}

// Every order list/display requires $lookup
db.orders.aggregate([
  { $match: { status: "pending" } },
  { $lookup: {
    from: "customers",
    localField: "customerId",
    foreignField: "_id",
    as: "customer"
  }},
  { $unwind: "$customer" }
])
// Repeated joins add avoidable work for a common list view
```

**Correct (extended reference):**

Place commonly-needed customer fields directly inside the order document: include a `customer` subdocument containing `_id` (retained as a reference for full lookups), `name`, and `email`. Order list queries then return customer display data with no `$lookup` required. Complete customer data remains accessible through a direct read to the `customers` collection whenever necessary.

**Keeping cached data in sync:**

When a source field changes (e.g. customer name), update the source collection first, then propagate the change to cached copies in the orders collection using `updateMany` filtered by the embedded reference `_id`. This propagation can happen synchronously or asynchronously via Change Streams or background jobs. For data that changes more frequently, add a `cachedAt` timestamp to the embedded subdocument so the application can trigger a refresh on read when the cache has exceeded a staleness threshold.

**What to cache (extend):**

| Cache | Don't Cache |
|-------|-------------|
| Display name, avatar | Full bio, description |
| Status, type | Sensitive PII |
| Slowly-changing data | Real-time values (balance, inventory) |
| Fields used in sorting/filtering | Large binary data |

**Alternative: Hybrid pattern with cache expiry:**

Retain both a bare reference (`customerId`) and an optional cache subdocument (`customerCache`) containing `name`, `email`, and `cachedAt`. On read, if the cache is absent or older than a set threshold (e.g. one day), reload it from the `customers` collection and persist the refreshed cache back onto the order document.

**When NOT to use this pattern:**

- **Frequently-changing data**: If a customer name changes daily, the cost of maintaining cached copies exceeds the cost of a `$lookup`.
- **Large cached payloads**: Avoid embedding 50KB of author bio into every article.
- **Sensitive data segregation**: Do not copy PII into collections governed by different access controls.
- **Writes >> Reads**: When writes far outnumber reads, maintaining a cache introduces unnecessary overhead.

## Verify with

```javascript
// Find $lookup-heavy aggregations in profile
db.setProfilingLevel(1, { slowms: 20 }) // Disable afterwards
db.system.profile.find({
  "command.aggregate": { $exists: true },
  "command.pipeline.$lookup": {
    $exists: true
  }
}).sort({ millis: -1 }).limit(10)

// Check how often lookups hit same collections
db.system.profile.aggregate([
  { $match: { "command.pipeline.$lookup": { $exists: true } } },
  { $project: { pipeline: "$command.pipeline" } },
  { $unwind: "$pipeline" },
  { $project: { lookup: { $getField: { field: { $literal: '$lookup' }, input: '$pipeline' } } } },
  { $match: { "lookup": { $exists: true } } },
  { $group: { _id: "$lookup.from", count: { $sum: 1 } } }
])
// High count = candidate for extended reference
```

Reference: [Reduce $lookup Operations](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/reduce-lookup-operations/)
