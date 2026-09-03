---
name: mongodb-schema-design
description: >-
  MongoDB schema design patterns and anti-patterns. Apply when modeling data,
  auditing schemas, migrating from SQL, or diagnosing performance problems
  rooted in schema choices. Triggers on "design schema", "embed vs
  reference", "MongoDB data model", "schema review", "unbounded arrays",
  "one-to-many", "tree structure", "16MB limit", "schema validation", "JSON
  Schema", "time series", "schema migration", "polymorphic", "TTL", "data
  lifecycle", "archive", "index explosion", "unnecessary indexes",
  "approximation pattern", "document versioning".
metadata:
  version: 1.0.0
  category: data
  source:
    repository: 'https://github.com/mongodb/agent-skills'
    path: skills/mongodb-schema-design
    license_path: LICENSE
    commit: 9ea7387c7a1638604542c6efd52e5efc6a7fc393
---

# MongoDB Schema Design

MongoDB data-modeling patterns and anti-patterns, maintained by MongoDB. Poor schema design underlies most MongoDB performance and cost problems—no query tuning or indexing strategy can compensate for a fundamentally flawed model.

## When to Apply

Consult these guidelines when:
- Building a new MongoDB schema from the ground up
- Porting data from SQL/relational databases to MongoDB
- Auditing existing data models for performance bottlenecks
- Diagnosing slow queries or unexpectedly large document sizes
- Choosing between embedding and referencing
- Modeling entity relationships (one-to-one, one-to-many, many-to-many)
- Designing tree or hierarchical structures
- Responding to Atlas Schema Suggestions or Performance Advisor alerts
- Encountering the 16MB document limit
- Applying schema validation to collections that already contain data

## Quick Reference

### 1. Schema Anti-Patterns - 3 rules

- [antipattern-unnecessary-collections](references/antipattern-unnecessary-collections.md) - Partitioning homogeneous data across multiple collections is frequently an anti-pattern; use this reference to determine whether that applies to your situation.
- [antipattern-excessive-lookups](references/antipattern-excessive-lookups.md) - When collections are over-normalized and reference one another, or when $lookup operations are frequent and potentially slow, consult this reference to assess the problem and find remedies.
- [antipattern-unnecessary-indexes](references/antipattern-unnecessary-indexes.md) - When indexes overlap or go unused by queries, consult this reference to locate and eliminate unnecessary indexes that impose overhead with no query benefit.

### 2. Schema Fundamentals - 4 rules

- [fundamental-embed-vs-reference](references/fundamental-embed-vs-reference.md) - Consult this reference for strategies to model various relationship types (1:1, 1:few, 1:many, many:many, tree/hierarchical data) and guidance on choosing between embedding and referencing based on access patterns.
- [fundamental-document-model](references/fundamental-document-model.md) - Core concepts of the document model. Consult this reference when moving from SQL or other normalized data sources to a document database such as MongoDB.
- [fundamental-schema-validation](references/fundamental-schema-validation.md) - Consult this reference when defining new collections or retrofitting validation onto existing ones, for example after discovering inconsistent document shapes or data quality problems.
- [fundamental-document-size](references/fundamental-document-size.md) - Consult this reference when documents reach the hard 16MB ceiling, or when read performance is worse than expected due to large document sizes.

### 3. Design Patterns - 11 rules

- [pattern-approximation](references/pattern-approximation.md) - Use approximate values for high-frequency counters
- [pattern-archive](references/pattern-archive.md) - Move historical data to separate/cold storage for performance
- [pattern-attribute](references/pattern-attribute.md) - Collapse many optional fields into key-value attributes
- [pattern-bucket](references/pattern-bucket.md) - Group time-series or IoT data into buckets
- [pattern-computed](references/pattern-computed.md) - Pre-calculate expensive aggregations
- [pattern-document-versioning](references/pattern-document-versioning.md) - Track document changes to enable historical queries and audit trails
- [pattern-extended-reference](references/pattern-extended-reference.md) - Cache frequently-accessed data from related entities
- [pattern-outlier](references/pattern-outlier.md) - Handle collections in which a small subset of documents are much larger than the rest, to prevent outliers from dominating memory and index costs
- [pattern-polymorphic](references/pattern-polymorphic.md) - Store different types of entities in the same collection, often when they are different types of the same base entity (e.g. different types of users or different types of products)
- [pattern-schema-versioning](references/pattern-schema-versioning.md) - Schema evolution, preventing drift, and safe online migrations. Consult when encountering inconsistent document structures, or when planning a schema change that cannot be applied atomically.
- [pattern-time-series-collections](references/pattern-time-series-collections.md) - Use native time series collections for high-frequency time series data

## Key Principle

> **"Data that is accessed together should be stored together."**

This is MongoDB's core design philosophy. Embedding related data removes the need for joins, cuts down on round trips, and makes atomic updates possible. Use references only when necessary.

A fundamental enabler of this philosophy is that MongoDB provides **flexible schemas**. Documents in the same collection can have different fields and even different structures, letting you model data in the way that best matches your access patterns rather than being locked into a rigid layout. If documents vary in their field sets, that is perfectly acceptable as long as it serves your application's requirements. Schema validation can be layered on to enforce specific rules while still preserving that flexibility.

A further consequence of the key principle is that knowledge of the expected read and write workload is directly relevant to schema design. When data from multiple entities is frequently queried or updated together, co-locating it within a single document can yield substantial performance gains. Conversely, data that is seldom accessed in combination may be better kept separate to avoid fetching more information than any given operation actually needs.

#### Schema Fundamentals Summary

- **Embed vs Reference**: Base the embed-or-reference decision on access patterns: embed when data is always retrieved together (1:1, 1:few, bounded arrays, atomic updates required); reference when data is accessed on its own, relationships are many-to-many, or arrays can grow without a natural upper bound.
- **Data accessed together stored together**: MongoDB's core principle: model schemas around queries, not around entities. Embed related data to avoid cross-collection joins and minimize round trips. Map out your API endpoints or pages, enumerate the data each one needs, then shape documents to serve those queries directly.
- **Embrace the document model**: Avoid mirroring SQL tables 1:1 as MongoDB collections. Instead, denormalize joined tables into rich documents that support single-query reads and atomic updates. When porting from SQL, identify which tables are always joined and consolidate them into unified documents.
- **Schema validation**: Use MongoDB's built-in `$jsonSchema` validator to reject invalid data at the database layer (type checks, required fields, enum constraints, array size limits). Begin with `validationLevel: "moderate"` and `validationAction: "warn"` on existing collections, then tighten to `strict`/`error`.
- **16MB document limit**: MongoDB documents may not exceed 16MB — this is a hard limit, not a soft recommendation. Typical culprits include unbounded arrays, large embedded binaries, and deeply nested objects. Mitigate by relocating unbounded data to separate collections and tracking document sizes with `$bsonSize`.

## Embed/Reference Decision Framework

| Relationship | Cardinality | Access Pattern | Recommendation |
|-------------|-------------|----------------|----------------|
| One-to-One | 1:1 | Always together | Embed |
| One-to-Few | 1:N (N < 100) | Usually together | Embed array |
| One-to-Many | 1:N (N > 100) | Often separate | Reference |
| Many-to-Many | M:N | Varies | Two-way reference |

This is a **rough** guideline. The right choice between embedding and referencing depends on your specific access patterns, data volume, and read/write ratios. Always validate against your real workload.

## How to Use

Each reference file listed above provides detailed explanations and code examples. Use the descriptions in the Quick Reference section to identify which files are applicable to the task at hand.

Each reference file includes:
- A concise explanation of why the topic matters
- An incorrect code example with commentary
- A correct code example with commentary
- "When NOT to use" exceptions
- Performance impact and metrics
- Verification diagnostics

---

## How These Rules Work

### MongoDB MCP Integration

For automated verification, connect the [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server).

When the MCP server is running and connected, verification commands can be executed automatically to inspect your live schema, document sizes, array lengths, index usage, and more — enabling recommendations grounded in your actual data rather than generic code patterns.

**⚠️ Security**: Use `--readOnly` for safety. Remove that flag only when write operations are required.

When connected, the following checks run automatically:
- Schema inference via `mcp__mongodb__collection-schema`
- Document and array size measurement via `mcp__mongodb__aggregate`
- Collection statistics via `mcp__mongodb__db-stats`

### ⚠️ Action Policy

**Write operations will NEVER be executed without your explicit approval.**

Before any write or destructive operation via MCP: (1) the exact operation will be summarized (collection, index/validator, estimated documents affected), and (2) explicit confirmation (yes/no) will be requested. Execution will not proceed on partial or ambiguous approvals.

| Operation Type | MCP Tools | Action |
|---------------|-----------|--------|
| **Read (Safe)** | `find`, `aggregate`, `collection-schema`, `db-stats`, `count` | I may run automatically to verify |
| **Write (Requires Approval)** | `update-many`, `insert-many`, `create-collection` | I will show the command and wait for your "yes" |
| **Destructive (Requires Approval)** | `delete-many`, `drop-collection`, `drop-database` | I will warn you and require explicit confirmation |

When schema changes or data modifications are recommended:
1. An explanation of **what** will be done and **why** will be provided
2. The **exact command** will be shown
3. Execution will be **held until you approve**
4. Only after a clear "go ahead" or "yes" will the command run

**Your database, your decision.** The role here is to advise, not to act without your authorization.

### Working Together

If you are uncertain about a recommendation:
1. Run the verification commands provided
2. Share the output
3. The recommendation will be refined based on your real data

This is a collaborative process — the goal is to get it right together.
