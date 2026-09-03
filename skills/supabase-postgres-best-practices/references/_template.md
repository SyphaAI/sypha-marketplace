---
title: Clear, Action-Oriented Title (e.g., "Use Partial Indexes for Filtered Queries")
impact: MEDIUM
impactDescription: 5-20x query speedup for filtered queries
tags: indexes, query-optimization, performance
---

## [Rule Title]

[1-2 sentences describing the problem and its significance. Emphasize the performance consequences.]

**Incorrect (describe the problem):**

```sql
-- Comment explaining what makes this slow/problematic
CREATE INDEX users_email_idx ON users(email);

SELECT * FROM users WHERE email = 'user@example.com' AND deleted_at IS NULL;
-- This scans deleted records unnecessarily
```

**Correct (describe the solution):**

```sql
-- Comment explaining why this is better
CREATE INDEX users_active_email_idx ON users(email) WHERE deleted_at IS NULL;

SELECT * FROM users WHERE email = 'user@example.com' AND deleted_at IS NULL;
-- Only indexes active users, 10x smaller index, faster queries
```

[Optional: Further context, edge cases, or notable trade-offs]

Reference: [Postgres Docs](https://www.postgresql.org/docs/current/)
