# Core Index Principles

### Compound Index Guidelines

The leading field of the index should appear in the query's filter or sort condition.

**Equality → Sort → Range** ordering is most commonly preferred:

- **Equality** fields first (e.g. `{field: value}`, `{$in: [...]}` with \<= 200 elements, `{field: {$eq: value}}`)
- **Sort** fields next
- **Range** fields last (e.g. `$gt`, `$lt`, `$gte`, `$lte`, `{$in: [...]}` with \> 200 elements in the array, `$ne`, anchored case-sensitive `$regex`)

When the equality condition has low selectivity and the range condition has high selectivity, ERS ordering may outperform ESR.

### Sort direction

Index `{a:1, b:1}` supports `sort({a:1, b:1})` and its reverse `sort({a:-1, b:-1})`, but NOT mixed directions such as `sort({a:1, b:-1})`. For mixed-direction sorts, create an index that exactly matches the desired sort pattern.

### Collation Match

**Before** — Query collation differs from index collation, so the index cannot be used:

```javascript
db.users.createIndex({ name: 1 })
db.users.find({ name: "José" }).collation({ locale: "es", strength: 2 })
// Index cannot be used for query
```

**After** — Create the index with the same collation the query uses:

```javascript
db.users.createIndex({ name: 1 }, { collation: { locale: "es", strength: 2 } })
db.users.find({ name: "José" }).collation({ locale: "es", strength: 2 })
// Index can be used for query
```

**Why:** The collation on the index and the query must match for the index to be usable.

# Covered Queries

A covered query retrieves data straight from the index without ever accessing the underlying documents. This is extremely fast and should be used whenever practical.

## Requirements

1. **All query fields** must be present in the index
2. **All returned fields** must be present in the index (this includes sort fields)
3. **Inclusion projection required** \- you must supply an inclusion projection (e.g., `{ field: 1 }`) that requests only indexed fields, plus `_id: 0` when `_id` is not part of the index. Exclusion projections cannot yield covered queries.
4. **No `$exists` or null equality checks** \- queries that use `$exists` or test for null/missing values generally cannot be covered by an index
5. **Multikey index constraints** \- multikey indexes can cover queries under certain conditions, such as when the array field itself is omitted from the projection and operators like `$elemMatch` are not used. If the array field must be projected, covering is not achievable.

## Building a covered query

**Step 1:** Identify your query pattern

```javascript
db.products.find(
  { category: "electronics", inStock: true },
  { category: 1, inStock: 1, price: 1, _id: 0 }
).sort({ price: 1 })
```

**Step 2:** Create index with all accessed fields

Following ESR (Equality-Sort-Range):

```javascript
db.products.createIndex({
  category: 1,    // Equality
  inStock: 1,     // Equality
  price: 1        // Sort
})
```

**Step 3:** Project only indexed fields

- Include the indexed fields in the projection
- **Exclude \_id** unless \_id is part of the index (use `_id: 0`)
- Do not request any fields that are not in the index

## Common mistakes

### Forgetting to explicitly exclude  \_id

```javascript
// NOT COVERED - _id not in index but included in result
db.products.find(
  { category: "electronics" },
  { category: 1, price: 1 }  // _id included by default!
)
```

**Fix:** Explicitly exclude \_id

```javascript
db.products.find(
  { category: "electronics" },
  { category: 1, price: 1, _id: 0 }  // Now covered
)
```

### Requesting non-indexed fields

```javascript
// NOT COVERED - description not in index
db.products.find(
  { category: "electronics" },
  { category: 1, price: 1, description: 1, _id: 0 }
)
```

**Fix:** Project only indexed fields, or add description to the index

### Array fields (multikey indexes)

```javascript
// NOT COVERED - tags is an array field and is included in projection
db.products.createIndex({ tags: 1, price: 1 })
db.products.find(
  { tags: "sale" },
  { tags: 1, price: 1, _id: 0 }
)
```

**Fix:** When the array field is not required in the result, omit it from the projection:

```javascript
// COVERED - array field (tags) used in query but not projected
db.products.find(
  { tags: "sale" },
  { price: 1, _id: 0 }
)
```

Multikey indexes can cover queries as long as the array field itself is excluded from the projection and operators like `$elemMatch` are not used. If the array field must appear in the output, the query cannot be covered.
