---
title: Composite Index Design
description: Multi-column indexes
tags: mysql, indexes, composite, query-optimization, leftmost-prefix
---

# Composite Indexes

## Leftmost Prefix Rule
An index on `(a, b, c)` can be used for:
- `WHERE a` (uses column `a`)
- `WHERE a AND b` (uses columns `a`, `b`)
- `WHERE a AND b AND c` (uses all three columns)
- `WHERE a AND c` (uses only column `a`; `c` cannot be filtered without `b`)

It is NOT usable for `WHERE b` alone or `WHERE b AND c` — the index must be traversed from the leftmost column.

## Column Order: Equality First, Then Range/Sort

```sql
-- Query: WHERE tenant_id = ? AND status = ? AND created_at > ?
CREATE INDEX idx_orders_tenant_status_created ON orders (tenant_id, status, created_at);
```

**Critical**: Range predicates (`>`, `<`, `BETWEEN`, `LIKE 'prefix%'`, and in some cases large `IN (...)`) halt index usage for filtering any columns that follow. However, columns positioned after a range predicate can still contribute to:
- Covering index reads (eliminating table lookups)
- `ORDER BY`/`GROUP BY` in certain situations, when the ordering or grouping aligns with the usable index prefix

## Sort Order Must Match Index

```sql
-- Index: (status, created_at)
ORDER BY status ASC, created_at ASC   -- ✓ matches (optimal)
ORDER BY status DESC, created_at DESC -- ✓ full reverse OK (reverse scan)
ORDER BY status ASC, created_at DESC  -- ⚠️ mixed directions (may use filesort)

-- MySQL 8.0+: descending index components
CREATE INDEX idx_orders_status_created ON orders (status ASC, created_at DESC);
```

## Composite vs Multiple Single-Column Indexes
MySQL can combine single-column indexes via `index_merge` (union or intersection), but a composite index is generally faster. Index merge is worth considering when queries filter on column combinations that share no common prefix, though it carries overhead and may degrade under load.

## Selectivity Considerations
Among equality columns, put higher-cardinality (more selective) columns first where practical. That said, actual query patterns and access frequency typically have a greater impact than raw selectivity alone.

## GROUP BY and Composite Indexes
`GROUP BY` operations can take advantage of composite indexes when the grouping columns align with the index prefix, allowing MySQL to avoid a separate sort step.

## Design for Multiple Queries

```sql
-- One index covers: WHERE user_id=?, WHERE user_id=? AND status=?,
--   and WHERE user_id=? AND status=? ORDER BY created_at DESC
CREATE INDEX idx_orders_user_status_created ON orders (user_id, status, created_at DESC);
```

## InnoDB Secondary Index Behavior
InnoDB automatically stores the primary key value alongside each secondary index entry. As a result, a secondary index can sometimes satisfy primary key lookups without explicitly including the PK columns in its definition.
