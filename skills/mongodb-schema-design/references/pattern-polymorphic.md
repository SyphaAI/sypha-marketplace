---
title: Use Polymorphic Pattern for Heterogeneous Documents
impact: MEDIUM
impactDescription: "Keeps related entities in one collection while preserving type-specific fields"
tags: schema, patterns, polymorphic, discriminator, flexible-schema, indexing, single-collection
---

## Use Polymorphic Pattern for Heterogeneous Documents

**Keep related documents of varying shapes in a single collection, identified by a type discriminator.** Shared queries and indexes remain straightforward while each type can carry its own specific fields. Typical applications include product catalogs with multiple product types, content management systems, event stores, and domains modeled with inheritance.

**Incorrect (separate collections per subtype):**

With a dedicated collection per product type (e.g. `products_books`, `products_electronics`, `products_clothing`), querying across all products requires multiple calls or `$unionWith`, shared indexes must be maintained in each collection, adding a new type means creating a new collection, and application code must branch based on collection names.

**Correct (single collection using optional fields):**

Place all product types in a single `products` collection. Every document shares common fields (`name`, `price`, `inStock`), while each type contributes its own fields (books: `author`, `isbn`, `pages`; electronics: `brand`, `wattage`, `batteryHours`, `warranty`; clothing: `size`, `color`, `material`). When categories are always fully disjoint, use a `type` discriminator field (e.g. `"book"`, `"electronics"`, `"clothing"`). Cross-type queries operate on shared fields; type-specific queries add a filter on `type` alongside the relevant type-specific fields. Where overlap is possible (e.g. between different user categories), the discriminator field can be omitted and the distinction expressed purely through optional fields.

**Index strategies for polymorphic collections:**

```javascript
// Strategy 1: Compound index with type first
// Best for: Queries that always filter by type
db.products.createIndex({ type: 1, price: 1 })
db.products.createIndex({ type: 1, name: 1 })

// Query uses index efficiently:
db.products.find({ type: "book", price: { $lt: 50 } })

// Strategy 2: Compound index with type second
// Best for: Queries that rarely filter by type
db.products.createIndex({ price: 1, type: 1 })

// Query across all types uses index:
db.products.find({ price: { $lt: 50 } })

// Strategy 3: Partial indexes for type-specific fields
// Best for: Fields that only exist on some types
db.products.createIndex(
  { author: 1 },
  { partialFilterExpression: { type: "book" } }
)

db.products.createIndex(
  { brand: 1, wattage: 1 },
  { partialFilterExpression: { type: "electronics" } }
)

// Strategy 4: Wildcard index for varying fields
// Best for: Many type-specific fields, ad-hoc queries
db.products.createIndex({ "specs.$**": 1 })

// Documents store type-specific data in specs:
{ type: "book", specs: { author: "...", isbn: "..." } }
{ type: "electronics", specs: { brand: "...", wattage: 20 } }
```

**Query patterns across types:**

```javascript
// Pattern 1: Query all types with shared fields
db.products.find({ price: { $lt: 100 }, inStock: true })
  .sort({ price: 1 })

// Pattern 2: Query specific type with type-specific fields
db.products.find({
  type: "book",
  pages: { $gt: 300 },
  author: /bradshaw/i
})

// Pattern 3: Aggregation across types with type-specific handling
db.products.aggregate([
  { $match: { inStock: true } },
  { $group: {
      _id: "$type",
      count: { $sum: 1 },
      avgPrice: { $avg: "$price" }
    }
  }
])

// Pattern 4: Faceted search with type breakdown
db.products.aggregate([
  { $match: { price: { $lt: 100 } } },
  { $facet: {
      byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
      priceRanges: [
        { $bucket: {
            groupBy: "$price",
            boundaries: [0, 25, 50, 100],
            default: "100+"
          }
        }
      ]
    }
  }
])
```

**Validation per type:**

```javascript
// Use JSON Schema with discriminator-based validation
db.runCommand({
  collMod: "products",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type", "name", "price"],
      properties: {
        type: { enum: ["book", "electronics", "clothing"] },
        name: { bsonType: "string" },
        price: { bsonType: "number", minimum: 0 }
      },
      oneOf: [
        {
          properties: { type: { enum: ["book"] } },
          required: ["author", "isbn"]
        },
        {
          properties: { type: { enum: ["electronics"] } },
          required: ["brand"]
        },
        {
          properties: { type: { enum: ["clothing"] } },
          required: ["size", "color"]
        }
      ]
    }
  },
  validationLevel: "moderate"
})
```

**Adding new types:**

The polymorphic pattern makes adding new types uncomplicated — no schema migration is required. Simply insert documents carrying the new `type` value and any corresponding type-specific fields. Add partial indexes for type-specific query patterns as needed, and extend the schema validation rules to cover the new type if strict validation is in use.

**When NOT to use polymorphic pattern:**

- **Completely different access patterns**: When each type is queried in isolation with no cross-type queries, separate collections may be the cleaner choice.
- **Conflicting index requirements**: If types require many distinct indexes, the cumulative index overhead may negate the benefits.
- **Strict type separation required**: Regulatory or security constraints may require separate collections.
- **Vastly different document sizes**: When one type produces 100-byte documents and another produces 100KB documents, the shared working set is negatively affected.
- **Type-specific sharding needs**: Different types may call for different shard keys.

## Verify with

```javascript
// Get type distribution
db.products.aggregate([
  { $group: {
      _id: "$type",
      count: { $sum: 1 },
      avgSize: { $avg: { $bsonSize: "$$ROOT" } }
    }
  },
  { $sort: { count: -1 } }
])

// Check for missing type field
db.products.countDocuments({ type: { $exists: false } })
```

Reference: [Polymorphic Schema Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/polymorphic-data/polymorphic-schema-pattern/)
