---
title: Covering Indexes
description: Index-only scans
tags: mysql, indexes, covering-index, query-optimization, explain
---

# Covering Indexes

A covering index includes every column a query requires — InnoDB can satisfy the query entirely from the index without touching the table (`Using index` in EXPLAIN Extra).

```sql
-- Query: SELECT user_id, status, total FROM orders WHERE user_id = 42
-- Covering index (filter columns first, then included columns):
CREATE INDEX idx_orders_cover ON orders (user_id, status, total);
```

## InnoDB Implicit Covering
Since InnoDB secondary indexes carry the primary key value in each index entry, `INDEX(status)` already covers `SELECT id FROM t WHERE status = ?` (where `id` is the PK) without additional columns.

## ICP vs Covering Index
- **ICP (`Using index condition`)**: the storage engine applies filtering at the index level before retrieving table rows, but table lookups are still required.
- **Covering index (`Using index`)**: the query is resolved entirely within the index — no table lookups occur.

## EXPLAIN Signals
Look for `Using index` in the `Extra` column:

```sql
EXPLAIN SELECT user_id, status, total FROM orders WHERE user_id = 42;
-- Extra: Using index ✓
```

If `Using index condition` appears instead, the index is being used but the query is not fully covered — consider adding the remaining selected columns to the index.

## When to Use
- High-frequency reads that select a small number of columns from wide tables.
- Not worthwhile for: wide result sets involving TEXT/BLOB columns, write-heavy tables, or infrequently executed queries.

## Tradeoffs
- **Write amplification**: every INSERT, UPDATE, and DELETE must maintain all relevant indexes.
- **Index size**: wider indexes occupy more disk space and buffer pool memory.
- **Maintenance**: larger indexes take longer to rebuild when running `ALTER TABLE`.

## Guidelines
- Extend existing indexes by adding columns rather than creating new dedicated indexes.
- Column order: leading filter columns first, followed by any additional columns to be covered.
- Confirm that `Using index` appears in EXPLAIN output after creating the index.
- **Pitfall**: `SELECT *` prevents covering indexes from being effective — select only the columns the query actually needs.
