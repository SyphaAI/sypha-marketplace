---
title: Query Optimization Pitfalls
description: Common anti-patterns that silently kill performance
tags: mysql, query-optimization, anti-patterns, performance, indexes
---

# Query Optimization Pitfalls

These patterns appear correct but bypass indexes or force full scans.

## Non-Sargable Predicates
A **sargable** predicate is one that can leverage an index. Common non-sargable patterns include:
- functions or arithmetic applied to indexed columns
- implicit type conversions
- leading wildcards (`LIKE '%x'`)
- some negations (`!=`, `NOT IN`, `NOT LIKE`) depending on shape and data distribution

## Functions on Indexed Columns
```sql
-- BAD: function prevents index use on created_at
WHERE YEAR(created_at) = 2024

-- GOOD: sargable range
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
```

MySQL 8.0+ can use expression (functional) indexes for some cases:

```sql
CREATE INDEX idx_users_upper_name ON users ((UPPER(name)));
-- Now this can use idx_users_upper_name:
WHERE UPPER(name) = 'SMITH'
```

## Implicit Type Conversions
Implicit casts can render indexes unusable:

```sql
-- If phone is VARCHAR, this may force CAST(phone AS UNSIGNED) and scan
WHERE phone = 1234567890

-- Better: match the column type
WHERE phone = '1234567890'
```

## LIKE Patterns
```sql
-- BAD: leading wildcard cannot use a B-Tree index
WHERE name LIKE '%smith'
WHERE name LIKE '%smith%'

-- GOOD: prefix match can use an index
WHERE name LIKE 'smith%'
```

For suffix searches, consider storing a reversed generated column and using a prefix search:

```sql
ALTER TABLE users
  ADD COLUMN name_reversed VARCHAR(255) AS (REVERSE(name)) STORED,
  ADD INDEX idx_users_name_reversed (name_reversed);

WHERE name_reversed LIKE CONCAT(REVERSE('smith'), '%');
```

For infix searches at scale, use `FULLTEXT` (when appropriate) or a dedicated search engine.

## `OR` Across Different Columns
`OR` spanning different columns often prevents efficient index use.

```sql
-- Often suboptimal
WHERE status = 'active' OR region = 'us-east'

-- Often better: two indexed queries
SELECT * FROM orders WHERE status = 'active'
UNION ALL
SELECT * FROM orders WHERE region = 'us-east';
```

MySQL can sometimes use `index_merge`, but it is frequently slower than a purpose-built composite index or a UNION rewrite.

## ORDER BY + LIMIT Without an Index
`LIMIT` does not automatically make sorting cheap. When no index supports the ordering, MySQL may sort a large number of rows (`Using filesort`) before applying LIMIT.

```sql
-- Needs an index on created_at (or it will filesort)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- For WHERE + ORDER BY, you usually need a composite index:
-- (status, created_at DESC)
SELECT * FROM orders
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;
```

## DISTINCT / GROUP BY
`DISTINCT` and `GROUP BY` can trigger temp tables and sorts (`Using temporary`, `Using filesort`) when indexes do not align with the query.

```sql
-- Often improved by an index on (status)
SELECT DISTINCT status FROM orders;

-- Often improved by an index on (status)
SELECT status, COUNT(*) FROM orders GROUP BY status;
```

## Derived Tables / CTE Materialization
Derived tables and CTEs may be materialized into temporary tables, which can be slower than a flattened query. If performance is surprising, inspect `EXPLAIN` and consider rewriting the query or adding supporting indexes.

## Other Quick Rules
- **`OFFSET` pagination**: `OFFSET N` scans and discards N rows. Use cursor-based pagination.
- **`SELECT *`** defeats covering indexes. Select only the columns you need.
- **`NOT IN` with NULLs**: `NOT IN (subquery)` returns no rows if the subquery contains any NULL. Use `NOT EXISTS`.
- **`COUNT(*)` vs `COUNT(col)`**: `COUNT(*)` counts all rows; `COUNT(col)` skips NULLs.
- **Arithmetic on indexed columns**: `WHERE price * 1.1 > 100` prevents index use. Rewrite to keep the column bare: `WHERE price > 100 / 1.1`.
