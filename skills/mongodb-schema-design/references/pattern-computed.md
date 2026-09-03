---
title: Use Computed Pattern for Expensive Calculations
impact: MEDIUM
impactDescription: "Improves read latency by pre-computing frequently-requested aggregations"
tags: schema, patterns, computed, aggregation, performance, denormalization
---

## Use Computed Pattern for Expensive Calculations

**Pre-calculate and persist frequently-accessed computed values.** Executing the same aggregation on every page load wastes CPU cycles. Store the result directly in the document and refresh it on write or through a background job — this trades additional write complexity for faster read performance.

**Incorrect (calculate on every read):**

```javascript
// Movie with all screenings in separate collection
{ _id: "movie1", title: "The Matrix" }

// Screenings collection - thousands of records
{ movieId: "movie1", date: ISODate("..."), viewers: 344, revenue: 3440 }
{ movieId: "movie1", date: ISODate("..."), viewers: 256, revenue: 2560 }
// ... 10,000 screenings

// Movie page aggregates every time
db.screenings.aggregate([
  { $match: { movieId: "movie1" } },
  { $group: {
    _id: "$movieId",
    totalViewers: { $sum: "$viewers" },
    totalRevenue: { $sum: "$revenue" },
    screeningCount: { $sum: 1 }
  }}
])
// Repeated scans can add substantial read latency and CPU overhead
// 1M page views/day = 1M expensive aggregations
```

**Correct (pre-computed values):**

Embed computed statistics directly in the movie document: `stats.totalViewers`, `stats.totalRevenue`, `stats.screeningCount`, `stats.avgViewersPerScreening`, and `stats.computedAt`. The movie page then retrieves a single document with no aggregation required on the hot path.

**Update strategies:**

```javascript
// Strategy 1: Update on write (low write volume)
// When new screening is added
db.screenings.insertOne({
  movieId: "movie1",
  viewers: 400,
  revenue: 4000
})

// Immediately update computed values
db.movies.updateOne(
  { _id: "movie1" },
  {
    $inc: {
      "stats.totalViewers": 400,
      "stats.totalRevenue": 4000,
      "stats.screeningCount": 1
    },
    $set: { "stats.computedAt": new Date() }
  }
)

// Strategy 2: Background job (high write volume)
// Run hourly/daily aggregation job
db.screenings.aggregate([
  { $group: {
    _id: "$movieId",
    totalViewers: { $sum: "$viewers" },
    totalRevenue: { $sum: "$revenue" },
    count: { $sum: 1 }
  }},
  { $merge: {
    into: "movies",
    on: "_id",
    whenMatched: [{
      $set: {
        "stats.totalViewers": "$$new.totalViewers",
        "stats.totalRevenue": "$$new.totalRevenue",
        "stats.screeningCount": "$$new.count",
        "stats.computedAt": "$$NOW"
      }
    }]
  }}
])
```

**Common computed values:**

| Source Data | Computed Value | Update Strategy |
|-------------|----------------|-----------------|
| Order line items | Order total | On write (single doc) |
| Product reviews | Avg rating, review count | Background job |
| User activity | Engagement score | Background job |
| Transaction history | Account balance | On write |
| Page views | View count, trending score | Batched updates |

**Handling staleness:**

Store a `computedAt` timestamp next to the stats. Application code checks this timestamp against a freshness threshold (e.g. one hour) and initiates a refresh when the values are stale. You can also expose the timestamp to users (e.g. “1,840,000 viewers — updated 1 hour ago”).

**Windowed computations:**

```javascript
// Compute for time windows (rolling 30 days)
{
  _id: "movie1",
  stats: {
    allTime: { viewers: 1840000, revenue: 25880000 },
    last30Days: { viewers: 45000, revenue: 630000 },
    last7Days: { viewers: 12000, revenue: 168000 }
  }
}

// Background job updates rolling windows
db.screenings.aggregate([
  { $match: {
    movieId: "movie1",
    date: { $gte: thirtyDaysAgo }
  }},
  { $group: {
    _id: null,
    viewers: { $sum: "$viewers" },
    revenue: { $sum: "$revenue" }
  }}
])
// Then update movie.stats.last30Days
```

**Consider on-demand materialized views:**

When computed results are better suited to a standalone collection rather than being embedded in source documents, MongoDB's [on-demand materialized views](https://www.mongodb.com/docs/manual/core/materialized-views/) provide a formal structure for this. An on-demand materialized view is an aggregation pipeline that writes its output to a separate collection via `$merge` or `$out` — the same mechanism used in Strategy 2 above. The distinction is conceptual: rather than updating a field on existing documents, you maintain a dedicated read-optimized collection that can be indexed independently. This approach works especially well when:

- The computed data has a different shape or granularity from the source (e.g. monthly summaries derived from daily records).
- Multiple consumers require the pre-aggregated data, and a shared collection is tidier than duplicating fields across documents.
- The computed results need indexes that are independent of the source collection.

On-demand materialized views do not refresh automatically — you decide when to re-execute the pipeline, which carries the same staleness trade-offs discussed above.

**When NOT to use this pattern:**

- **Rarely accessed calculations**: If a stat is viewed only once per day, compute it on demand instead.
- **High write frequency**: If source data is updated every second, the overhead of maintaining the computed value may outweigh the read savings.
- **Complex multi-collection joins**: Some computations are too intricate to keep up to date incrementally.
- **Strong consistency required**: Computed values may lag slightly behind the source data.

## Verify with

```javascript
// Find expensive aggregations that should be pre-computed
db.setProfilingLevel(1, { slowms: 100 }) // Disable afterwards
db.system.profile.find({
  "command.aggregate": { $exists: true },
  millis: { $gt: 100 }
}).sort({ millis: -1 })

// Check if same aggregation runs repeatedly
db.system.profile.aggregate([
  { $match: { "command.aggregate": { $exists: true } } },
  { $group: {
    _id: "$command.pipeline",
    count: { $sum: 1 },
    avgMs: { $avg: "$millis" }
  }},
  { $match: { count: { $gt: 100 } } }  // Repeated 100+ times
])
// High count + high avgMs = candidate for computed pattern
```

Reference: [Computed Schema Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/computed-values/computed-schema-pattern/)
