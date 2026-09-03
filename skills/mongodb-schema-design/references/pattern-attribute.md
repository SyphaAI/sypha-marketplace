---
title: Use Attribute Pattern for Sparse or Variable Fields
impact: MEDIUM
impactDescription: "Reduces sparse indexes and enables efficient search across many optional fields"
tags: schema, patterns, attribute, sparse-fields, indexing, flexible-schema
---

## Use Attribute Pattern for Sparse or Variable Fields

**When documents carry many optional fields, consolidate them into a key-value array.** Doing so eliminates the need for dozens of sparse indexes and allows queries across all attributes through a single multikey index.

**Incorrect (separate field and index per optional attribute):**

```javascript
// Many optional fields - most are missing on any given document
{
  _id: 1,
  name: "Bottle",
  color: "red",
  size: "M",
  material: "glass",
  // 20+ other optional fields, varying per document
}

// One partial index per optional field — correct use of partialFilterExpression,
// but you end up maintaining dozens of indexes as attributes grow
db.items.createIndex({ color: 1 }, { partialFilterExpression: { color: { $exists: true } } })
db.items.createIndex({ size: 1 }, { partialFilterExpression: { size: { $exists: true } } })
db.items.createIndex({ material: 1 }, { partialFilterExpression: { material: { $exists: true } } })
// … repeated for every new attribute
```

**Correct (attribute pattern):**

```javascript
// Store optional fields as key-value pairs
{
  _id: 1,
  name: "Bottle",
  attributes: [
    { k: "color", v: "red" },
    { k: "size", v: "M" },
    { k: "material", v: "glass" }
  ]
}

// Single multikey index for all attributes

db.items.createIndex({ "attributes.k": 1, "attributes.v": 1 })

// Query for color = red

db.items.find({
  attributes: { $elemMatch: { k: "color", v: "red" } }
})
```

**When NOT to use this pattern:**

- **Fixed schemas**: When fields are stable and always present across documents.
- **Type-specific validation**: When each field requires its own strict schema rules.
- **Single-field queries only**: A plain field is simpler and faster in this case.
- **Atlas Search workloads**: The `{ k, v }` key-value structure cannot be mapped as
  named fields in Atlas Search indexes. When full-text search on attribute values by key
  name is needed, use static named fields instead.

## Verify with

```javascript
// Ensure queries use the multikey index

db.items.find({
  attributes: { $elemMatch: { k: "material", v: "glass" } }
}).explain("executionStats")
```

Reference: [Attribute Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/group-data/attribute-pattern/)
