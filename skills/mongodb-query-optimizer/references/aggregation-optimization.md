# Principles

Aggregation pipelines pass documents through sequential stages. The key goals are:

- Cutting down the document set as early as possible in the pipeline
- Minimizing the data transferred between stages
- Using indexes wherever feasible
- Keeping memory consumption under control

## Memory limits and disk spilling

Blocking stages (such as in-memory `$sort` and `$group`) are subject to a 100MB per-stage memory limit. When this limit is reached, MongoDB defaults to spilling to disk automatically (`allowDiskUse` defaults to `true`).

**Better alternatives:**

- Apply more aggressive filters early in the pipeline
- Create indexes so `$sort` can leverage index order
- Place `$limit` immediately after `$sort` to shrink the dataset the sort must handle in memory for unindexed sorts
- Consider materialized views for aggregations that run repeatedly

# Optimization Examples

The examples below are not exhaustive but illustrate several common optimization patterns.

## Unindexed $lookup vs. Indexed $lookup

**Bad** — No index on the foreign collection's join field:

```javascript
db.orders.aggregate([
  { $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "sku",   // no index on products.sku!
      as: "product"
  }}
])
```

**Good** — Index on `foreignField` in the foreign collection:

```javascript
db.products.createIndex({ sku: 1 })

db.orders.aggregate([
  { $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "sku",
      as: "product"
  }}
])
```

**Why:** Each `$lookup` performs a find against the `from` collection. Without an index on `foreignField`, every join triggers a full collection scan. This is the single most impactful $lookup optimization.

## Early $project Defeating Optimization vs. Late $project

**Bad** — An early `$project` blocks the optimizer from pruning unused fields, omits exclusion of an unneeded `_id`, and pulls in `name` which is never referenced:

```javascript
db.collection.aggregate([
  { $project: { name: 1, status: 1, amount: 1 } },
  { $match: { status: "active" } },
  { $group: { _id: "$status", total: { $sum: "$amount" } } }
])
```

**Good** — Allow the optimizer to handle field pruning; reserve `$project` for the end of the pipeline where it reshapes output:

```javascript
db.collection.aggregate([
  { $match: { status: "active" } },
  { $group: { _id: "$status", total: { $sum: "$amount" } } },
  { $project: { _id: 0, status: "$_id", total: 1 } }  // reshape at the end
])
```

**Why:** MongoDB's pipeline optimizer automatically determines which fields are needed and skips fetching the rest. An early `$project` disables this optimization and can inadvertently include the wrong fields.

## $facet for Divergent Processing vs. $unionWith

**Bad** — `$facet` routes all documents into every branch, even when different branches need very different subsets:

```javascript
db.collection.aggregate([
  { $facet: {
      "top10": [{ $sort: { score: -1 } }, { $limit: 10 }],
      "totalCount": [{ $count: "n" }]  // gets ALL docs even though it's just counting
  }}
])
```

**Good** — Using `$unionWith` to run separate pipelines lets each branch optimize on its own:

```javascript
db.collection.aggregate([
  { $sort: { score: -1 } }, { $limit: 10 },
  { $unionWith: {
      coll: "collection",
      pipeline: [{ $count: "n" }]
  }}
])
```

**Why:** `$facet` channels every document through every branch. `$unionWith` runs independent pipelines, each able to leverage its own indexes and optimization paths.

## $sort \+ $limit as Separate Concerns vs. Top-N Sort

**Bad** — Sorting the full dataset first, then applying a limit (MongoDB may sort the entire collection):

```javascript
db.collection.aggregate([
  { $group: { _id: "$category", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  // ... many stages later ...
  { $limit: 10 }
])
```

**Good** — Place `$limit` immediately after `$sort`:

```javascript
db.collection.aggregate([
  { $group: { _id: "$category", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])
```

**Why:** When `$sort` is immediately followed by `$limit`, MongoDB executes a *top-N sort* — tracking only the top N values rather than sorting the entire dataset. This uses significantly less memory.

## $unwind Best Practices

**When $unwind is necessary**, apply a filter before unwinding so the $match stage can benefit from index usage:

```javascript
[
  { $match: { "items.category": "electronics" } },  // Reduce documents first
  { $unwind: "$items" },  // Then unwind
  { $match: { "items.category": "electronics" } }  // Filter unwound elements
]
```

**Never $unwind just to re-group by `_id`:** If you are using `$unwind` followed by `$group` on `_id:`, you can replace that pattern with an array operator such as `$filter`, `$map`, or `$reduce` to match or transform array elements without unwinding.

## Optimize $lookup operations

`$lookup` carries out collection joins and can be costly. Strategies to improve its performance:

1. **Filter before the lookup** to reduce the number of left-side documents
2. **Use indexed fields** for the lookup `localField`/`foreignField`
3. **Add $match inside the lookup pipeline** to narrow right-side documents early
4. **Add $project at the end of the lookup pipeline** to retain only the fields you need
5. **$unwind immediately after lookup** when you need the `as` result array flattened

```javascript
[
  { $match: { active: true } },  // Reduce left side
  { $lookup: {
      from: "inventory",
      localField: "product_id",
      foreignField: "_id",  // _id is always indexed
      pipeline: [
        { $match: { inStock: true } },  // Reduce right side
        { $project: { _id: 0, name: 1, price: 1 } }
      ],
      as: "product"
  }},
  { $unwind: "$product" }
]
```

**Schema consideration:** Frequent `$lookup` usage can be a sign of over-normalization. Consider embedding data that is joined together regularly.

## $group efficiency

Group operations accumulate result documents in memory, so efficiency matters:

1. **Reference only the fields you need within the $group stage** \- include only required fields in accumulators
2. **Watch for unbounded accumulators** \- `$push` and `$addToSet` grow with group size and can exhaust memory

**Bad** \- do not add $project before $group to "reduce fields":

```javascript
[
  { $match: { date: { $gte: ISODate("2024-01-01") } } },
  { $project: { category: 1, amount: 1 } },
  { $group: {
      _id: "$category",
      total: { $sum: "$amount" },
      count: { $sum: 1 }
  }}
]
```

**Good** \- reference only needed fields directly in $group:

```javascript
[
  { $match: { date: { $gte: ISODate("2024-01-01") } } },
  { $group: {
      _id: "$category",
      total: { $sum: "$amount" },
      count: { $sum: 1 }
  }}
]
```

**Why:** The $group stage only accesses the fields referenced in its expressions. Inserting a $project before it does not reduce memory usage.
