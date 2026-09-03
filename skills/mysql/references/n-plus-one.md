---
title: N+1 Query Detection and Fixes
description: N+1 query solutions
tags: mysql, n-plus-one, orm, query-optimization, performance
---

# N+1 Query Detection

## What Is N+1?
The N+1 pattern arises when you fetch N parent records and then issue N additional queries (one per parent) to retrieve related data.

Example: 1 query for users + N queries for posts.

## ORM Fixes (Quick Reference)

- **SQLAlchemy 1.x**: `session.query(User).options(joinedload(User.posts))`
- **SQLAlchemy 2.0**: `select(User).options(joinedload(User.posts))`
- **Django**: `select_related('fk_field')` for FK/O2O, `prefetch_related('m2m_field')` for M2M/reverse FK
- **ActiveRecord**: `User.includes(:orders)`
- **Prisma**: `findMany({ include: { orders: true } })`
- **Drizzle**: use `.leftJoin()` instead of loop queries

```typescript
// Drizzle example: avoid N+1 with a join
const rows = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId));
```

## Detecting in MySQL Production

```sql
-- High-frequency simple queries often indicate N+1
-- Requires performance_schema enabled (default in MySQL 5.7+)
SELECT digest_text, count_star, avg_timer_wait
FROM performance_schema.events_statements_summary_by_digest
ORDER BY count_star DESC LIMIT 20;
```

Also check the slow query log sorted by `count` for frequently repeated simple SELECTs.

## Batch Consolidation
Replace sequential queries with `WHERE id IN (...)`.

Practical limits:
- Total statement size is capped by `max_allowed_packet` (often 4MB by default).
- Very large IN lists increase parsing and planning overhead and can hurt performance.

Strategies:
- Up to ~1000–5000 ids: `IN (...)` is usually fine.
- Larger: chunk the list (e.g. batches of 500–1000) or use a temporary table and join.

```sql
-- Temporary table approach for large batches
CREATE TEMPORARY TABLE temp_user_ids (id BIGINT PRIMARY KEY);
INSERT INTO temp_user_ids VALUES (1), (2), (3);

SELECT p.*
FROM posts p
JOIN temp_user_ids t ON p.user_id = t.id;
```

## Joins vs Separate Queries
- Prefer **JOINs** when related data is needed for most or all parent rows and the result set stays manageable.
- Prefer **separate queries** (batched) when JOINs would multiply rows (one-to-many) or retrieve too much unnecessary data.

## Eager Loading Caveats
- **Over-fetching**: eager loading pulls *all* related rows unless explicitly filtered.
- **Memory**: loading large collections can exhaust memory.
- **Row multiplication**: JOIN-based eager loading can produce enormous result sets; in some ORMs, a "select-in" strategy is safer.

## Prepared Statements
Prepared statements reduce repeated parse/optimize overhead for repeated parameterized queries, but they do **not** eliminate N+1: you still execute N queries. Use batching or eager loading to reduce query count.

## Pagination Pitfalls
N+1 often reappears on each page. Make sure eager loading or batching is applied to the paginated query, not inside a per-row loop.
