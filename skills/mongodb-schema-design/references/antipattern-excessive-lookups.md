---
title: Reduce Excessive $lookup Usage
impact: CRITICAL
impactDescription: "Can reduce query cost on hot paths by avoiding repeated cross-collection joins"
tags: schema, lookup, anti-pattern, joins, denormalization, atlas-suggestion
---

## Reduce Excessive $lookup Usage

**Repeated $lookup operations on hot paths are often a sign of over-normalization.** `$lookup` has legitimate uses, but chained joins can be slower and more resource-intensive than targeting a single collection, particularly when supporting indexes are absent or match selectivity is low. If the same related fields are consistently read together, embedding or extended references are worth considering.

**Incorrect (constant $lookup for common operations):**

```javascript
// Every product page requires repeated joins across collections
db.products.aggregate([
  { $match: { _id: productId } },
  { $lookup: {
      from: "categories",          // Collection scan #2
      localField: "categoryId",
      foreignField: "_id",
      as: "category"
  }},
  { $lookup: {
      from: "brands",              // Collection scan #3
      localField: "brandId",
      foreignField: "_id",
      as: "brand"
  }},
  { $unwind: "$category" },
  { $unwind: "$brand" }
])
// Multiple join stages add planning/execution overhead on hot paths
```

Join cost varies with cardinality, stage order, index availability, and result size. Always measure before committing to embedding.

**Correct (denormalize frequently-joined data):**

Move data that is always displayed alongside the product directly into the product document: store category fields (`_id`, `name`, `path`) and brand fields (`_id`, `name`, `logo`) as embedded subdocuments. A single indexed query then returns the full product record without any `$lookup`. Listing queries (e.g. filtering by category) also resolve against a single collection.

**Managing denormalized data updates:**

When category data changes (an infrequent event), run `updateMany` to propagate the new values to all products sharing that category’s `_id`. For data that changes more often, maintain both a reference ID (`brandId`) and a cache subdocument (`brandCache`) with a `cachedAt` timestamp; refresh the cache whenever it exceeds an acceptable staleness threshold.

**When NOT to use this pattern:**

- **Data changes frequently and independently**: If brand logos are updated daily, denormalization introduces significant update overhead.
- **Rarely-accessed data**: Avoid embedding review details when only a small share of product views actually load reviews.
- **Many-to-many with high cardinality**: Do not embed large or rapidly growing relationship sets.
- **Analytics queries**: Batch jobs can tolerate $lookup latency; real-time queries generally cannot.

## Verify with

```javascript
// Find pipelines with multiple $lookup stages
db.setProfilingLevel(1, { slowms: 50 }) // Disable afterwards
db.system.profile.find({
  "command.aggregate": { $exists: true },
  "command.pipeline.$lookup": {
    $exists: true
  }
}).sort({ millis: -1 })

// Check if $lookup foreign fields are indexed
db.reviews.aggregate([
  { $indexStats: {} }
])
// Look for index supporting the query in result

// Measure $lookup impact
db.products.aggregate([
  { $match: { category: "electronics" } },
  { $lookup: { from: "brands", localField: "brandId", foreignField: "_id", as: "brand" } }
]).explain("executionStats")
// Check totalDocsExamined in $lookup stage
```

Atlas Schema Suggestions flags: "Reduce $lookup operations"

Reference: [Reduce Lookup Operations](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/reduce-lookup-operations/)
