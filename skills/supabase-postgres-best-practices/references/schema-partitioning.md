---
title: Partition Large Tables for Better Performance
impact: MEDIUM-HIGH
impactDescription: 5-20x faster queries and maintenance on large tables
tags: partitioning, large-tables, time-series, performance
---

## Partition Large Tables for Better Performance

Partitioning divides a large table into smaller, more manageable segments, which improves both query performance and routine maintenance tasks.

**Incorrect (single large table):**

```sql
create table events (
  id bigint generated always as identity,
  created_at timestamptz,
  data jsonb
);

-- 500M rows, queries scan everything
select * from events where created_at > '2024-01-01';  -- Slow
vacuum events;  -- Takes hours, locks table
```

**Correct (partitioned by time range):**

```sql
create table events (
  id bigint generated always as identity,
  created_at timestamptz not null,
  data jsonb
) partition by range (created_at);

-- Create partitions for each month
create table events_2024_01 partition of events
  for values from ('2024-01-01') to ('2024-02-01');

create table events_2024_02 partition of events
  for values from ('2024-02-01') to ('2024-03-01');

-- Queries only scan relevant partitions
select * from events where created_at > '2024-01-15';  -- Only scans events_2024_01+

-- Drop old data instantly
drop table events_2023_01;  -- Instant vs DELETE taking hours
```

Situations where partitioning is appropriate:

- Tables exceeding 100M rows
- Time-series data accessed with date-range queries
- Workloads that require efficiently purging historical data

Reference: [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
