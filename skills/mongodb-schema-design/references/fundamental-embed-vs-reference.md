---
title: Embed vs Reference Decision Framework
impact: HIGH
impactDescription: "Determines long-term query and update paths in your application data model"
tags: schema, embedding, referencing, relationships, fundamentals, one-to-one, one-to-few, one-to-many, many-to-many, tree, hierarchy
---

## Embed vs Reference Decision Framework

**This is among the most consequential schema decisions you will make.** Base the choice on access patterns, not solely on how entities relate to one another.

**Embed when:**
- Data is always retrieved together (1:1 or 1:few relationships)
- Child data has no meaningful existence apart from the parent
- Both sides are updated atomically as a unit
- The child array has a clear upper bound imposed by business rules

**Reference when:**
- Data is queried independently of its parent
- Many-to-many relationships are present
- Child data is large relative to the parent, or array growth is unbounded
- The two sides are updated at different frequencies

**Decision Matrix:**

| Relationship | Cardinality | Access Pattern | Bounded? | Decision |
|--------------|-------------|----------------|----------|----------|
| User → Profile | 1:1 | Always together | Yes | **Embed** |
| User → Addresses | 1:few (1-5) | Usually together | Yes | **Embed array** |
| Order → Line Items | 1:few (1-50) | Always together | Yes | **Embed array** |
| Publisher → Books | 1:many (1000+) | Often separate | No | **Reference** |
| Post → Comments | 1:many (unbounded) | Separate adds | No | **Reference** |
| Students ↔ Classes | Many-to-many | Both directions | Moderate | **Reference both ways** |
| Product ↔ Category | Many-to-many | Either way | Moderate | **Embed refs in primary direction** |

---

### One-to-One: embed in the parent document

**Place one-to-one related data directly in the parent document when it is consistently read together.** Consolidating it into a single document eliminates a round-trip and ensures atomicity.

**Incorrect (separate collections for 1:1 data):** Keeping user accounts and profiles in separate collections when they are always loaded together requires two queries per lookup, two index scans, and introduces the risk of orphaned records.

**Correct (embedded):**

```javascript
{
  _id: "user123",
  email: "alice@example.com",
  createdAt: ISODate("2024-01-01"),
  profile: {
    name: "Alice Smith",
    avatar: "https://cdn.example.com/alice.jpg",
    bio: "Developer building cool things"
  }
}

// Single query, atomic updates
db.users.updateOne(
  { _id: "user123" },
  { $set: { "profile.name": "Alice Johnson" } }
)
```

Use subdocuments to organize related fields into logical groups — e.g. `auth` (passwordHash, lastLogin), `profile` (name, avatar), `settings` (theme, notifications) — keeping all 1:1 data tidy within a single document without resorting to separate collections.

**Common 1:1 relationships suited for embedding:** User/Profile, Country/Capital, Building/Address, Order/ShippingAddress, Product/Dimensions.

**When NOT to embed 1:1:**
- Data is accessed independently (e.g. the profile page operates separately from auth logic)
- The two sides have different security requirements (auth fields vs public profile fields)
- There is a significant size disparity (embedded doc >10KB, parent <1KB)
- Update frequencies differ substantially (profile updated hourly, auth data rarely)

---

### One-to-Few: embed bounded arrays

**Embed small, bounded arrays directly in the parent document.** When the number of children is limited and they are typically accessed alongside the parent, embedding consolidates everything into a single read path.

**Incorrect (separate collection for few items):**

```javascript
// Addresses in separate collection — user typically has 1-3
{ userId: "user123", type: "home", street: "123 Main", city: "Boston" }
// Requires $lookup for ~2 addresses, orphan risk on user delete
```

**Correct (embedded array):**

```javascript
{
  _id: "user123",
  name: "Alice Smith",
  addresses: [
    { type: "home", street: "123 Main St", city: "Boston", state: "MA", zip: "02101" },
    { type: "work", street: "456 Oak Ave", city: "Boston", state: "MA", zip: "02102" }
  ]
}

// Add address atomically
db.users.updateOne(
  { _id: "user123" },
  { $push: { addresses: { type: "vacation", street: "789 Beach", city: "Miami" } } }
)

// Update specific address
db.users.updateOne(
  { _id: "user123", "addresses.type": "home" },
  { $set: { "addresses.$.city": "Cambridge" } }
)
```

**Typical one-to-few scenarios:** User/Addresses (1-5), User/PhoneNumbers (1-3), Product/Variants (3-10), Author/PenNames (1-3), Order/LineItems (1-50).

**Enforce bounds with schema validation:**

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        addresses: {
          bsonType: "array",
          maxItems: 10,
          items: {
            bsonType: "object",
            required: ["city"],
            properties: {
              type: { enum: ["home", "work", "billing", "shipping"] },
              city: { bsonType: "string" }
            }
          }
        }
      }
    }
  }
})
```

(See fundamental-schema-validation.md for full validation guidance).

**When NOT to embed arrays:**
- Growth is unbounded (comments, orders, events) — use a separate collection instead
- Children are queried independently without the parent context
- Individual child documents are large relative to the parent
- The array grows steadily and shows no natural upper bound

---

### One-to-Many: reference in child documents

**Use references when the "many" side is unbounded or commonly accessed on its own.** Store the parent's ID in each child document and index that field.

**Incorrect (embedding unbounded arrays):** Embedding all 10,000+ books inside a publisher document means that inserting a single new book rewrites the entire oversized document, and the collection will eventually exceed the 16MB limit.

**Correct (reference in children):**

```javascript
// Publisher stays small and fixed-size
{ _id: "oreilly", name: "O'Reilly Media", founded: 1978, bookCount: 3500 }

// Each book references publisher; index on { publisherId: 1 }
{ _id: "book001", title: "New MongoDB Book", publisherId: "oreilly" }

// Efficient indexed queries
db.books.find({ publisherId: "oreilly" })

// $lookup when you need details from both sides
db.books.aggregate([
  { $match: { publisherId: "oreilly" } },
  { $lookup: {
    from: "publishers",
    localField: "publisherId",
    foreignField: "_id",
    as: "publisher"
  }},
  { $unwind: "$publisher" }
])
```

**Hybrid with subset:** Embed a bounded subset in the publisher (e.g. the top 5 featured books with `_id`, `title`, `isbn`) to support display without a `$lookup`. "View all books" queries the books collection directly.

**Keep denormalized counts in sync:**

```javascript
db.books.insertOne({ title: "New Book", publisherId: "oreilly" })
db.publishers.updateOne({ _id: "oreilly" }, { $inc: { bookCount: 1 } })
```

**When to reference:** Unbounded child sets (Publisher→Books), large child documents (User→Orders), independently queried children (Department→Employees), different data lifecycles (Author→Articles).

**When NOT to reference:** Small bounded arrays (a user's 3 addresses), data always accessed alongside the parent (Order→LineItems), children never queried in isolation.

---

### Many-to-Many: choose a primary query direction

**Many-to-many relationships call for identifying the dominant query direction.** Unlike SQL junction tables, MongoDB favors denormalization aligned with your most frequent access pattern.

**Incorrect (SQL-style junction table):**

```javascript
// 3 collections, always need joins
// students: { _id, name }  /  classes: { _id, name }  /  enrollments: { studentId, classId }
// Every query requires aggregation with $lookup
```

**Correct (embed in primary query direction):**

Place references on whichever side is queried most often. If the dominant query is "which classes does this student attend," embed class summaries in the student document. For the inverse query, embed student summaries in the class document.

**Bidirectional embedding (when both directions are common):**

```javascript
// Book with author summaries
{
  _id: "book001",
  title: "Cell Biology",
  authors: [
    { authorId: "author124", name: "Ellie Smith" },
    { authorId: "author381", name: "John Palmer" }
  ]
}

// Author with book summaries
{
  _id: "author124",
  name: "Ellie Smith",
  books: [
    { bookId: "book001", title: "Cell Biology" },
    { bookId: "book042", title: "Molecular Biology" }
  ]
}
// Trade-off: data duplication, but fast queries in both directions
```

**Reference-only (for high-cardinality relationships):**

```javascript
// Product stores category IDs (small array per product)
{ _id: "prod123", name: "Laptop", categoryIds: ["cat1", "cat2", "cat3"] }
// Category has no back-reference array (avoid huge arrays)
{ _id: "cat1", name: "Electronics" }
// Products in a category: db.products.find({ categoryIds: "cat1" })
```

**Selecting a strategy:**

| Query Pattern | Cardinality | Strategy |
|---------------|-------------|----------|
| Students → Classes | Few classes per student | Embed in student |
| Classes → Students | Many students per class | Reference only |
| Both directions common | Moderate both sides | Bidirectional embed |
| High cardinality both | Large/growing both sides | Reference-only + `$lookup` |

**Maintaining bidirectional data — use transactions for atomicity:**

```javascript
const session = client.startSession()
session.withTransaction(async () => {
  await db.students.updateOne(
    { _id: "student1" },
    { $push: { classes: { classId: "class101", name: "Database Systems" } } },
    { session }
  )
  await db.classes.updateOne(
    { _id: "class101" },
    { $push: { students: { studentId: "student1", name: "Alice Smith" } } },
    { session }
  )
})
```

---

### Tree and hierarchical data

**Hierarchical data requires selecting a tree pattern based on the primary operations your application needs.** MongoDB supports several patterns, each with distinct tradeoffs.

**Common forms of hierarchical data:** Category trees, organizational charts, file/folder structures, comment threads, geographic hierarchies.

#### Pattern 1: Parent References

**Best for:** Finding parent, updating parent, simple child listing.

```javascript
{ _id: "MongoDB", parent: "Databases" }
{ _id: "Databases", parent: "Programming" }
{ _id: "Programming", parent: null }

db.categories.createIndex({ parent: 1 })
db.categories.find({ parent: "Databases" })  // immediate children
```

Con: Retrieving all descendants requires recursive queries or `$graphLookup`.

#### Pattern 2: Child References

**Best for:** Listing children, graph-like traversal structures.

```javascript
{ _id: "Databases", children: ["MongoDB", "PostgreSQL", "MySQL"] }
```

Con: Locating ancestors requires recursion; the children array must be updated on every add or remove.

#### Pattern 3: Array of Ancestors

**Best for:** Breadcrumb navigation, fast ancestor and descendant lookups.

```javascript
{ _id: "MongoDB", parent: "Databases", ancestors: ["Programming", "Databases"] }
{ _id: "Atlas", parent: "MongoDB", ancestors: ["Programming", "Databases", "MongoDB"] }

db.categories.createIndex({ ancestors: 1 })
db.categories.find({ ancestors: "Databases" })  // all descendants
```

Adding a `parent` field allows `$graphLookup` traversal without application-side recursion.

#### Pattern 4: Materialized Paths

**Best for:** Subtree queries, regex-based lookups, sorting nodes in hierarchy order.

```javascript
{ _id: "MongoDB", path: ",Programming,Databases,MongoDB," }
{ _id: "Atlas", path: ",Programming,Databases,MongoDB,Atlas," }

db.categories.createIndex({ path: 1 })
db.categories.find({ path: /^,Programming,Databases,MongoDB,/ })  // all descendants
db.categories.find({}).sort({ path: 1 })  // hierarchy display order
```

#### Tree pattern comparison

| Pattern | Parent | Children | Descendants | Ancestors | Update Cost |
|---------|--------|----------|-------------|-----------|-------------|
| Parent Refs | Direct | Indexed | Recursive/`$graphLookup` | Recursive | Low |
| Child Refs | Membership query | Direct | Recursive/`$graphLookup` | Recursive | Low–moderate |
| Array of Ancestors | Via `parent` | Via `parent` | Fast (indexed) | Direct (stored) | Moderate |
| Materialized Paths | Via path/`parent` | Prefix query | Regex/prefix | From stored path | Moderate |

**Recommended pattern by use case:** Category breadcrumbs → Array of Ancestors. File browser → Parent References. Org chart reporting → Materialized Paths. Comment threads → Parent References.

---

### When NOT to embed (summary)

- **Unbounded growth**: Comments, logs, events — move these to a separate collection.
- **Large child documents**: When individual children are large relative to the parent, referencing is generally the safer choice.
- **Independent access**: If children are ever queried without the parent, use a reference.
- **Different data lifecycles**: When child data is archived or deleted on a different schedule from the parent.
- **Graph-like structures**: Nodes with multiple parents call for `$graphLookup` or a dedicated graph database.

## Verify with

```javascript
// Check document sizes for embedded collections
db.collection.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    arrayLen: { $size: { $ifNull: ["$items", []] } }
  }},
  { $match: { size: { $gt: 1000000 } } }
])
// Oversized documents may indicate embedded data that should instead be referenced

// Check embedded array sizes (one-to-few validation)
db.users.aggregate([
  { $project: { addressCount: { $size: { $ifNull: ["$addresses", []] } } } },
  { $group: { _id: null, avg: { $avg: "$addressCount" }, max: { $max: "$addressCount" } } }
])
// A continuously growing max suggests moving the data to a separate collection

// Check for orphaned references (1:1 that should be embedded)
db.profiles.aggregate([
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
  { $match: { user: { $size: 0 } } }
])
// Orphaned profiles are a sign that 1:1 data should be embedded instead

// Check for missing indexes on reference fields
db.books.getIndexes()
// An index on publisherId is required for efficient child lookups

// Verify bidirectional many-to-many consistency
db.students.aggregate([
  { $unwind: "$classes" },
  { $lookup: {
    from: "classes",
    let: { sid: "$_id", cid: "$classes.classId" },
    pipeline: [
      { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
      { $match: { $expr: { $in: ["$$sid", "$students.studentId"] } } }
    ],
    as: "match"
  }},
  { $match: { match: { $size: 0 } } }
])
// Any results indicate inconsistencies in the bidirectional data

// Check tree consistency (no orphaned nodes)
db.categories.aggregate([
  { $match: { parent: { $ne: null } } },
  { $lookup: { from: "categories", localField: "parent", foreignField: "_id", as: "parentDoc" } },
  { $match: { parentDoc: { $size: 0 } } },
  { $count: "orphanedNodes" }
])
```

References:
- [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
- [Model One-to-One Relationships](https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-one-relationships-between-documents/)
- [Model One-to-Many Relationships with Embedded Documents](https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/)
- [Model One-to-Many Relationships with References](https://mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/)
- [Model Many-to-Many Relationships](https://mongodb.com/docs/manual/tutorial/model-embedded-many-to-many-relationships-between-documents/)
- [Model Tree Structures](https://mongodb.com/docs/manual/applications/data-models-tree-structures/)
