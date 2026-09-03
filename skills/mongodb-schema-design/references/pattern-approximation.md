---
title: "Approximation Pattern"
impact: MEDIUM
impactDescription: "Reduces write load by storing approximate values when exact real-time counts are not required"
tags: schema, patterns, approximation, computed, write-optimization
---

## Approximation Pattern

**Deliberately persist approximate values to lower write load when exact real-time accuracy is not required.** High-frequency counters — page views, trending scores, social media engagement metrics — that increment by +1 on every event generate costly per-event writes. The approximation pattern batches those increments, accepting some staleness in exchange for a dramatically reduced write volume.

**Incorrect (write to database on every event):**

```javascript
// Page view counter - writes to MongoDB on every single view
function recordPageView(articleId) {
  db.articles.updateOne(
    { _id: articleId },
    {
      $inc: { viewCount: 1 },
      $set: { lastViewedAt: new Date() }
    }
  )
}
// 1M page views/day = 1M database writes/day
// High write load for a counter that doesn't need real-time accuracy
```

**Correct (batch writes with threshold):**

The document stores an approximate count together with a sync timestamp. The application accumulates counts in local memory (e.g. a `Map` keyed by article ID) and flushes to the database only when the local counter crosses a threshold (e.g. every 100 views). At threshold=100 this produces ~100× fewer database writes.

The document carries `viewCount` (approximate — may lag by up to one threshold interval) and `lastSyncedAt`. When the local counter reaches the threshold, the application issues a single `$inc` by the threshold amount and refreshes `lastSyncedAt`. Any increments not yet synced are discarded on application restart.

**Tradeoffs:**

| Concern | Impact |
|---------|--------|
| Write reduction | ~100x fewer DB writes (at threshold=100) |
| Staleness | Up to `threshold` events behind |
| Accuracy | Approximate — never exact real-time |
| Crash safety | Unsynced local increments lost on restart |

**Distinction from the Computed Pattern:**

- **Computed Pattern**: pre-calculates expensive aggregations and stores precise results
- **Approximation Pattern**: deliberately stores inexact values to decrease write frequency

Choose Approximation when some staleness is tolerable. Choose Computed when precision is required but recalculating on every read is prohibitively expensive.

**When NOT to use this pattern:**

- **Financial amounts or inventory counts**: These demand exact values — approximation is not acceptable.
- **Low-frequency counters**: If the counter changes rarely, the batching logic adds complexity without meaningful benefit.
- **Regulatory or audit requirements**: When exact counts are legally or operationally mandated.

## Verify with

```javascript
// Check write frequency on counter fields
db.setProfilingLevel(1, { slowms: 0 })
db.system.profile.find({
  "command.update": "articles",
  "command.updates.u.$inc.viewCount": { $exists: true }
}).count()
// A high write count relative to reads suggests the approximation pattern would help

// Compare counter staleness
db.articles.aggregate([
  { $project: {
    title: 1,
    viewCount: 1,
    lastSyncedAt: 1,
    staleness: { $subtract: ["$$NOW", "$lastSyncedAt"] }
  }},
  { $sort: { staleness: -1 } },
  { $limit: 10 }
])
// Confirm that staleness falls within acceptable bounds for your use case
```

Reference: [Use the Approximation Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/computed-values/approximation-schema-pattern/)
