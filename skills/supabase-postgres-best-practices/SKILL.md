---
name: supabase-postgres-best-practices
description: >-
  Postgres performance optimization and best practices curated by Supabase.
  Trigger this skill when writing, reviewing, or optimizing Postgres queries,
  schema designs, or database configurations.
metadata:
  author: supabase
  version: 1.1.1
  organization: Supabase
  date: January 2026
  abstract: >-
    Full-coverage Postgres performance optimization guide for developers working
    with Supabase and Postgres. Organizes performance rules across 8 categories,
    ranked by impact from critical (query performance, connection management) to
    incremental (advanced features). Every rule provides detailed explanations,
    incorrect vs. correct SQL examples, query plan analysis, and concrete
    performance metrics to support automated optimization and code generation.
  category: data
  source:
    repository: 'https://github.com/supabase/agent-skills'
    path: skills/supabase-postgres-best-practices
    license_path: LICENSE
    commit: 1356046015476711a769601079262b5635929427
---

# Supabase Postgres Best Practices

A thorough Postgres performance optimization guide, maintained by Supabase. Organizes rules across 8 categories, ordered by impact to support automated query optimization and schema design.

## When to Apply

Consult these guidelines when:
- Authoring SQL queries or designing schemas
- Adding indexes or tuning query performance
- Investigating database performance problems
- Setting up connection pooling or scaling strategies
- Taking advantage of Postgres-specific features
- Implementing Row-Level Security (RLS)

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Query Performance | CRITICAL | `query-` |
| 2 | Connection Management | CRITICAL | `conn-` |
| 3 | Security & RLS | CRITICAL | `security-` |
| 4 | Schema Design | HIGH | `schema-` |
| 5 | Concurrency & Locking | MEDIUM-HIGH | `lock-` |
| 6 | Data Access Patterns | MEDIUM | `data-` |
| 7 | Monitoring & Diagnostics | LOW-MEDIUM | `monitor-` |
| 8 | Advanced Features | LOW | `advanced-` |

## How to Use

Open individual rule files to find detailed explanations and SQL examples:

```
references/query-missing-indexes.md
references/query-partial-indexes.md
references/_sections.md
```

Each rule file includes:
- A concise explanation of why the rule matters
- An incorrect SQL example with an explanation
- A correct SQL example with an explanation
- Optional EXPLAIN output or performance metrics
- Additional context and references
- Supabase-specific notes where applicable

## References

- https://www.postgresql.org/docs/current/
- https://supabase.com/docs
- https://wiki.postgresql.org/wiki/Performance_Optimization
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/auth/row-level-security
