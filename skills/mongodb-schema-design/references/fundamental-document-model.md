---
title: Embrace the Document Model
impact: HIGH
impactDescription: "Aligns schema to aggregate access patterns and minimizes avoidable cross-collection joins"
tags: schema, document-model, fundamentals, sql-migration
---

## Embrace the Document Model

**Avoid mirroring SQL tables one-to-one in MongoDB.** The document model is built to store related data together when that data is read and updated together. Blindly replicating relational boundaries tends to multiply application-side joins and coordination logic.

**Incorrect (SQL patterns in MongoDB):**

Reproducing a relational schema 1:1 — e.g. maintaining separate `customers`, `addresses`, `phones`, and `preferences` collections all linked by `customerId` — demands four queries and four index lookups to load a single customer profile, plus application-side assembly. Updates may further require cross-collection coordination or multi-document transactions.

**Correct (rich document model):**

```javascript
// Customer document contains everything about the customer
// All data retrieved in single read, updated atomically
{
  _id: "cust123",
  name: "Alice Smith",
  email: "alice@example.com",
  addresses: [
    { type: "home", street: "123 Main", city: "Boston", zip: "02101" },
    { type: "work", street: "456 Oak", city: "Boston", zip: "02102" }
  ],
  phones: [
    { type: "mobile", number: "555-1234" },
    { type: "work", number: "555-5678" }
  ],
  preferences: {
    newsletter: true,
    theme: "dark",
    language: "en"
  },
  createdAt: ISODate("2024-01-01")
}

// Single query loads complete customer - 1 round-trip
db.customers.findOne({ _id: "cust123" })

// Atomic update - no transaction needed
db.customers.updateOne(
  { _id: "cust123" },
  { $push: { addresses: newAddress }, $set: { "preferences.theme": "light" } }
)
```

**Common tradeoffs:**

| Aspect | SQL-style mapping in MongoDB | Document-first mapping |
|--------|----------------------------|------------------------|
| Queries per aggregate view | Often multiple collection reads or `$lookup` | Often one collection read for hot paths |
| Atomicity for related fields | May require multi-document transaction | Single-document writes are atomic |
| Schema evolution | More migration/coordination between collections | Often localized changes per document shape |
| Application logic | More join/merge logic in app | Simpler read model for common operations |

**When migrating from SQL:**

1. Avoid converting tables 1:1 to collections
2. Identify which tables are invariably joined together
3. Denormalize those joined tables into unified documents
4. Keep only data that is accessed independently in its own collection

**When NOT to use this pattern:**

- **Genuinely independent data**: If addresses are shared across multiple users or queried on their own, keep them in a separate collection.
- **Unbounded relationships**: A user with 10,000 orders should NOT have all orders embedded in the user document.
- **Regulatory requirements**: Certain compliance mandates require normalized, auditable data structures.

## Verify with

```javascript
// Count your collections vs expected entities
for (const d of db.adminCommand({ listDatabases: 1 }).databases) {
  const colls = db.getSiblingDB(d.name).getCollectionNames().length
  print(`${d.name}: ${colls} collections`)
}
// Collection count alone is insufficient evidence; also examine query and access patterns

// Check for SQL-style foreign key patterns
db.addresses.aggregate([
  { $group: { _id: "$customerId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 0 } } }
]).itcount()
// If addresses always belong to a single customer, they should be embedded
```

Reference: [Schema Design Process](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)
