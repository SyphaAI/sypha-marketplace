---
title: Keep Documents Small
impact: CRITICAL
impactDescription: "Hard 16MB BSON limit; oversized documents fail writes and degrade performance long before that"
tags: schema, fundamentals, document-size, 16mb, bson-limit, arrays, anti-pattern, performance, indexing, subset-pattern, working-set, hot-data, cold-data, atlas-suggestion
---

## Keep Documents Small

**MongoDB documents may not exceed 16 megabytes.** This is a hard BSON limit, not a recommendation — writes fail as soon as a document hits that boundary.

In practice, documents should be **far smaller than 16MB**. A useful rule of thumb is to target **under 1MB**. Smaller documents deliver:

- **Better working-set efficiency** — more documents fit in the WiredTiger cache.
- **Faster reads and writes** — less data is copied, serialized, and transmitted per operation.
- **Lower replication overhead** — smaller oplog entries propagate to replicas more quickly.
- **Headroom for growth** — a document comfortably below the ceiling will not become a problem after a year of accumulated data.

The 16MB boundary is a hard stop, not a design objective.

### How documents grow too large

1. **Unbounded arrays** — e.g. an `activityLog` array that receives an entry on every user action: 100,000 events × ~150 bytes ≈ 15MB, continuing to grow until writes are rejected.
2. **Large bounded arrays** — even a nominally bounded comments array (5,000 items × ~500 bytes = 2.5MB) is costly: each `$push` rewrites the expanding document, and a multikey index fans out to one entry per element.
3. **Bloated documents with cold fields** — MongoDB loads full documents, even when queries reference only a few fields. A product document containing name and price (~18 bytes, accessed on every request) alongside description (~5KB), full specs (~10KB), base64 images (~500KB), reviews (~100KB), and price history (~50KB) can total ~665KB. Hot-path queries still pull the entire document into cache, degrading working-set density. Even a narrow projection (e.g. `db.products.find({}, {name: 1, price: 1})`) still reads the complete document from disk.
4. **Large embedded binaries** — a `BinData` PDF attachment of 10MB or more; additional attachments quickly push the document past the limit.
5. **Deeply nested objects** — a configuration document with 100+ levels of nesting where metadata and field keys alone approach 16MB.

### Solution 1: move unbounded or large data to a separate collection

Keep the parent document lean. Store child records in a dedicated collection with a reference field and a compound index to support efficient lookups.

```javascript
// Parent stays lean
{ _id: "user123", name: "Alice", activityCount: 48210, lastActivity: ISODate("...") }

// Children in separate collection with efficient index
// Index: { userId: 1, ts: -1 }
{ userId: "user123", action: "login", ts: ISODate("...") }
```

For large binary blobs, use GridFS for in-database storage, or — often the more practical choice — store them in external object storage and retain only a reference URL in MongoDB.

### Solution 2: split hot and cold fields (Subset Pattern)

Keep frequently accessed (hot) data in the main document and move rarely accessed (cold) data to a separate collection. This approach substantially improves cache density on hot query paths.

**Incorrect (all data in one document):** A movie document with all 10,000 reviews embedded (~1MB of cold data alongside ~1KB of hot data such as title, rating, and plot) causes every page load to pull ~1MB into RAM. Because most page views only need title, rating, and plot, this limits how many movies fit in cache simultaneously (e.g. with 1GB RAM, ~1,000 movies instead of ~1,000,000 if only hot data were loaded).

**Correct (subset pattern):** The movie document (~2KB) contains only hot fields: `title`, `year`, `rating`, `plot`, `reviewStats` (count, avgRating, distribution), and a bounded `featuredReviews` array (top 5 only, ~500 bytes). Complete reviews live in a separate `reviews` collection referenced by `movieId`, and are loaded only when the user explicitly requests them.

Likewise, a product document should carry only hot fields in the main record (~500 bytes): name, price, thumbnail URL, avgRating, reviewCount, and inStock. Cold data belongs in dedicated collections — `products_details` (description, fullSpecs), `products_images` (images array), and `products_reviews` (paginated reviews).

**How to identify hot vs cold data:**

| Hot Data (embed) | Cold Data (separate) |
|------------------|----------------------|
| Displayed on every page load | Only on user action (click, scroll) |
| Used for filtering/sorting | Historical/archival |
| Small relative size | Large relative size |
| Bounded small subsets | Large or unbounded sets |
| Changes rarely | Changes frequently |

**Maintaining an embedded subset:**

```javascript
// When a new review is added:
// 1. Insert full review into reviews collection
db.reviews.insertOne({ movieId: "movie123", user: "newUser", rating: 5, text: "Amazing!", date: new Date(), helpful: 0 })

// 2. Update movie stats
db.movies.updateOne(
  { _id: "movie123" },
  { $inc: { "reviewStats.count": 1, "reviewStats.distribution.5": 1 } }
)

// 3. Periodically refresh featured reviews (background job)
const topReviews = db.reviews.find({ movieId: "movie123" }).sort({ helpful: -1 }).limit(5).toArray()
db.movies.updateOne({ _id: "movie123" }, { $set: { featuredReviews: topReviews } })
```

For arrays, atomic `$slice` keeps the embedded subset bounded without a background job:

```javascript
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: {
      recentComments: {
        $each: [newComment],
        $slice: -20,
        $sort: { ts: -1 }
      }
    },
    $inc: { commentCount: 1 }
  }
)
// Also insert into overflow comments collection
db.comments.insertOne({ postId: "post123", ...newComment })
```

### Solution 3: projection (when refactoring is not feasible)

```javascript
// Only transfers ~500 bytes instead of 665KB over the network
db.products.find(
  { category: "electronics" },
  { name: 1, price: 1, thumbnail: 1 }
)
```

Projection cuts network transfer but still loads the full document into memory unless the query is entirely covered by an index. For genuine working-set reduction, splitting hot and cold data into separate collections is the correct approach.

### Prevention strategies

```javascript
// 1. Schema validation with array limits
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        addresses: { maxItems: 10 },
        tags: { maxItems: 100 }
      }
    }
  }
})
// (See fundamental-schema-validation.md for full validation guidance).

// 2. Application-level checks before write
const doc = await db.users.findOne({ _id: userId })
const currentSize = BSON.calculateObjectSize(doc)
if (currentSize > 200 * 1024) {  // 200KB warning — well before trouble
  logger.warn("Document size exceeding recommended threshold")
}

// 3. Use $slice to cap arrays
db.users.updateOne(
  { _id: userId },
  {
    $push: {
      activityLog: {
        $each: [newActivity],
        $slice: -1000  // Keep only last 1000
      }
    }
  }
)
```

### Workload signals

| Signal | Action |
|--------|--------|
| Array cardinality keeps growing | Cap with `$slice` or move to separate collection |
| Array field is heavily indexed | Review multikey fan-out; move cold data out |
| Reads only need recent subset | Embed recent N, reference full history |
| Updates slow as array grows | Switch to referenced write path |
| Documents routinely exceed ~200KB | Reassess schema — consider splitting hot/cold |
| WiredTiger cache pressure is high | Check for bloated documents; split candidates |

### When keeping data together is acceptable

- **Small, bounded arrays** — tags (max 20), roles (max 5), addresses (max 10) with an enforced upper limit.
- **Write-once arrays** — populated at creation and never modified; size still influences working-set efficiency.
- **Arrays of primitives** — `tags: ["a", "b", "c"]` is substantially cheaper than arrays of objects.
- **Small collections that fit in RAM** — when the entire collection is under 1GB, document size has less impact.
- **All data always needed** — if every access pattern genuinely requires the complete document, splitting introduces overhead without benefit.

## Verify with

```javascript
// Find largest documents in collection
db.collection.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $sort: { size: -1 } },
  { $limit: 10 }
])

// Check specific field sizes to find bloat
db.collection.aggregate([
  { $project: {
    total: { $bsonSize: "$$ROOT" },
    activitySize: { $bsonSize: { $ifNull: ["$activityLog", []] } },
    profileSize: { $bsonSize: { $ifNull: ["$profile", {}] } }
  }}
])

// Find documents with large arrays
db.collection.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    arrayLen: { $size: { $ifNull: ["$myArray", []] } }
  }},
  { $match: { arrayLen: { $gt: 100 } } },
  { $sort: { arrayLen: -1 } },
  { $limit: 10 }
])

// Find documents with hot/cold imbalance
db.collection.aggregate([
  { $project: {
    totalSize: { $bsonSize: "$$ROOT" },
    coldSize: { $bsonSize: { $ifNull: ["$reviews", []] } },
    hotSize: { $subtract: [
      { $bsonSize: "$$ROOT" },
      { $bsonSize: { $ifNull: ["$reviews", []] } }
    ]}
  }},
  { $match: {
    $expr: { $gt: ["$coldSize", { $multiply: ["$hotSize", 10] }] }
  }},
  { $limit: 10 }
])

// Check working set vs RAM
db.serverStatus().wiredTiger.cache
// "bytes currently in the cache" vs "maximum bytes configured"
```

Atlas Schema Suggestions flags: "Array field may grow without bound", "Document size exceeds recommended limit"

References:
- [BSON Document Size Limit](https://mongodb.com/docs/manual/reference/limits/#std-label-limit-bson-document-size)
- [Avoid Unbounded Arrays](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/)
- [Reduce Bloated Documents](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/bloated-documents/)
