# Index Strategy — Oracle Index Types and Usage

## Overview

Indexes are Oracle's main tool for locating rows efficiently without scanning entire tables. Selecting the appropriate index type, structure, and column ordering is essential for query performance. A weak index strategy results in either too many full table scans (from too few indexes) or degraded DML throughput and wasted storage (from too many or misdesigned indexes).

This guide addresses B-tree indexes, bitmap indexes, function-based indexes, composite index design, invisible indexes, usage monitoring, and maintenance.

---

## B-Tree Indexes

The B-tree (Balanced Tree) is Oracle's default index type and the most broadly applicable. It maintains indexed values in sorted order within a balanced tree, enabling O(log n) lookups.

### When to Use

- High-cardinality columns with many distinct values: primary keys, unique identifiers, timestamps
- Columns that appear frequently in `WHERE` clauses with equality or range predicates
- Foreign key columns (avoids a full table lock on the child during parent DELETE operations)
- Columns referenced in `ORDER BY` or `GROUP BY` where pre-sorted access provides a benefit

### When NOT to Use

- Very low cardinality columns (e.g., Y/N flags, gender codes) — a bitmap index is more appropriate
- Columns that are nearly always accessed through a full table scan
- Heavily updated columns where the index maintenance cost outweighs the query benefit

```sql
-- Simple B-tree index
CREATE INDEX emp_salary_ix ON employees (salary);

-- Unique B-tree index (enforces uniqueness and enables UNIQUE SCAN)
CREATE UNIQUE INDEX emp_email_uk ON employees (email);

-- Verify index was created
SELECT index_name, index_type, uniqueness, status
FROM   user_indexes
WHERE  table_name = 'EMPLOYEES';

-- See indexed columns
SELECT index_name, column_position, column_name, descend
FROM   user_ind_columns
WHERE  table_name = 'EMPLOYEES'
ORDER  BY index_name, column_position;
```

---

## Bitmap Indexes

Bitmap indexes store one bit per row for each distinct value. They are extremely space-efficient for low-cardinality columns and highly effective for ad-hoc analytical queries that combine multiple predicates.

### When to Use

- **Data warehouse** or reporting environments with heavy read activity and infrequent `INSERT/UPDATE/DELETE` operations
- Queries that combine multiple low-cardinality filters using `AND`/`OR` — Oracle can merge bitmaps with bitwise operations for efficient evaluation

### When to Avoid

- **OLTP environments** — bitmap indexes escalate row-level locks to bitmap-level during DML, causing severe contention
- Frequently updated columns — any DML operation locks the bitmaps for all rows sharing the same value

```sql
-- Bitmap index on a low-cardinality status column
CREATE BITMAP INDEX orders_status_bix ON orders (status);

-- Bitmap indexes shine for multi-column filter queries
-- Oracle combines bitmaps with bitwise AND/OR before table access
SELECT COUNT(*) FROM sales
WHERE  region  = 'WEST'
  AND  quarter = 'Q1'
  AND  channel = 'ONLINE';
-- With bitmap indexes on region, quarter, channel:
-- 3 bitmap scans → bitmap AND → COUNT (may not even need table access)

-- Check for bitmap indexes
SELECT index_name, index_type
FROM   user_indexes
WHERE  table_name = 'SALES'
  AND  index_type = 'BITMAP';
```

### Bitmap vs B-Tree Comparison

| Characteristic | B-Tree | Bitmap |
|---|---|---|
| Best cardinality | High | Low |
| DML performance | Moderate overhead per row | Heavy contention; row-level lock escalates |
| Storage | Per-value entries | Very compact for low cardinality |
| Combined predicates | Separate index lookups | Bitwise operations; very efficient |
| Best workload | OLTP + OLAP | Data warehouse / read-heavy OLAP |
| NULL storage | Not stored (allows IS NULL to miss index) | NULL has its own bitmap |

---

## Function-Based Indexes (FBI)

A function-based index pre-evaluates a function or expression and stores the result in the index. This enables index access when a function is applied to a column — a situation that would otherwise prevent index usage.

```sql
-- Without FBI: index on LAST_NAME is NOT used
SELECT * FROM employees WHERE UPPER(last_name) = 'SMITH';

-- Create FBI on the expression
CREATE INDEX emp_upper_lname_fix ON employees (UPPER(last_name));

-- Now Oracle can use the index
SELECT * FROM employees WHERE UPPER(last_name) = 'SMITH';

-- FBI for case-insensitive email lookup
CREATE INDEX emp_lower_email_fix ON employees (LOWER(email));
SELECT * FROM employees WHERE LOWER(email) = 'john.doe@example.com';

-- FBI for date truncation (report queries that filter on date portion)
CREATE INDEX orders_order_date_trunc ON orders (TRUNC(order_date));
SELECT * FROM orders WHERE TRUNC(order_date) = DATE '2026-03-01';

-- FBI for expression combining columns
CREATE INDEX emp_annual_sal_ix ON employees (salary * 12);
SELECT * FROM employees WHERE salary * 12 > 120000;
```

### Important Notes

- The function must be **deterministic** (identical input must always produce identical output)
- User-defined functions referenced in FBIs must carry the `DETERMINISTIC` declaration
- `QUERY_REWRITE_ENABLED` must be `TRUE` (the default) for Oracle to consider FBIs during optimization

```sql
-- Verify QUERY_REWRITE_ENABLED
SELECT name, value FROM v$parameter WHERE name = 'query_rewrite_enabled';
```

---

## Composite (Multi-Column) Indexes

A composite index spans two or more columns. Column ordering is critical and must align with actual query access patterns.

### Column Order Rules

**Rule 1: The leading column must appear in the query predicate** for the index to be used for an access scan (range or equality). A query that omits the leading column can only trigger an Index Skip Scan, which is efficient only when the leading column has very low cardinality.

**Rule 2: Columns with equality predicates should precede those with range predicates.**

```sql
-- Index on (DEPT_ID, SALARY)
CREATE INDEX emp_dept_sal_ix ON employees (department_id, salary);

-- Uses the index (leading column in predicate)
SELECT * FROM employees WHERE department_id = 50 AND salary > 5000;
-- Access: INDEX RANGE SCAN on department_id=50, filter salary>5000

-- Uses the index (leading column only)
SELECT * FROM employees WHERE department_id = 50;
-- Access: INDEX RANGE SCAN

-- Does NOT use the index efficiently (leading column absent)
SELECT * FROM employees WHERE salary > 5000;
-- Access: INDEX SKIP SCAN or TABLE ACCESS FULL (depends on cardinality)

-- Column order matters for range predicates:
-- Index (DEPT_ID, HIRE_DATE) — good for: WHERE dept=X AND hire_date BETWEEN...
-- Index (HIRE_DATE, DEPT_ID) — good for: WHERE hire_date=X AND dept=Y
--   but cannot efficiently range-scan HIRE_DATE if DEPT_ID is not equality
```

### When Composite Beats Two Separate Indexes

- Query filters on both columns: one index range scan vs. two separate scans followed by a bitmap merge
- Index covers all columns the query needs: enables an **index-only scan** with no table access required
- The index ordering can satisfy an `ORDER BY` or `GROUP BY` without a sort step

### Covering Index (Index-Only Scan)

```sql
-- Without covering index: index scan + table row fetch (two I/Os per row)
-- With covering index: index scan only (one I/O per row)

-- Query: SELECT last_name, salary FROM employees WHERE department_id = 60
-- Covering index includes all selected + filtered columns:
CREATE INDEX emp_dept_cover_ix ON employees (department_id, last_name, salary);

-- Verify with EXPLAIN PLAN — look for "INDEX FAST FULL SCAN" or no TABLE ACCESS step
EXPLAIN PLAN FOR
SELECT last_name, salary FROM employees WHERE department_id = 60;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());
```

---

## Invisible Indexes

An invisible index is kept current by DML operations but is **ignored by the optimizer** by default. This enables safe testing of a new index without affecting production query plans, or a controlled wind-down period before the index is dropped.

```sql
-- Create an invisible index
CREATE INDEX emp_job_id_ix ON employees (job_id) INVISIBLE;

-- Make an existing index invisible
ALTER INDEX emp_job_id_ix INVISIBLE;

-- Test whether it helps: enable invisible index use for your session only
ALTER SESSION SET OPTIMIZER_USE_INVISIBLE_INDEXES = TRUE;

-- Test your query
EXPLAIN PLAN FOR SELECT * FROM employees WHERE job_id = 'IT_PROG';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());

-- If the index helps, make it visible to all
ALTER INDEX emp_job_id_ix VISIBLE;

-- View invisible indexes
SELECT index_name, visibility, status
FROM   user_indexes
WHERE  table_name = 'EMPLOYEES';
```

### Invisible Index Use Cases

1. **Evaluating a new index** in isolation without changing plan choices for other sessions
2. **Safe decommissioning:** render the index invisible, observe the system for a week to confirm no regressions, then drop it
3. **Assessing the impact of removal:** make the existing index invisible and run the workload to measure the effect before committing to a drop

---

## Index Monitoring

Oracle can record whether an index has been accessed by the optimizer during query execution. This data helps identify unused indexes that can be removed to reduce DML overhead.

### 12c+ (Automatic Monitoring via DBA_INDEX_USAGE)

Starting with Oracle 12c Release 2, index usage is tracked automatically with no explicit monitoring configuration required. Statistics are flushed from `V$INDEX_USAGE_INFO` (an instance-level control view) into `DBA_INDEX_USAGE` approximately every 15 minutes.

```sql
-- Check index usage statistics (12cR2+) — query DBA_INDEX_USAGE, not V$INDEX_USAGE_INFO
-- V$INDEX_USAGE_INFO is a control/status view; DBA_INDEX_USAGE holds the per-index stats
SELECT name            AS index_name,
       total_access_count,
       total_exec_count,
       last_used
FROM   dba_index_usage
WHERE  owner = 'HR'
  AND  name IN (
    SELECT index_name FROM user_indexes WHERE table_name = 'EMPLOYEES'
  );
```

### Pre-12c Monitoring (ALTER INDEX MONITORING USAGE)

```sql
-- Enable monitoring
ALTER INDEX emp_salary_ix MONITORING USAGE;

-- Run workload...

-- Check if used
SELECT index_name, monitoring, used, start_monitoring, end_monitoring
FROM   v$object_usage
WHERE  index_name = 'EMP_SALARY_IX';

-- Disable monitoring
ALTER INDEX emp_salary_ix NOMONITORING USAGE;
```

**Caution:** Pre-12c monitoring captures only a TRUE/FALSE used flag, not how often the index was accessed. An index accessed once a month is indistinguishable from one accessed a million times.

---

## Rebuilding vs. Coalescing

Over time, B-tree indexes can accumulate clustering factor degradation and wasted space from deleted entries. Two maintenance operations are available:

### COALESCE

Merges leaf blocks within existing branches without reducing the index height. The I/O overhead is low. Use this for minor fragmentation.

```sql
ALTER INDEX emp_salary_ix COALESCE;
```

### REBUILD

Reconstructs the index from scratch using the underlying table data. This can correct height problems, improve the clustering factor, and apply new storage parameters. It is more costly because it reads all table data.

```sql
-- Rebuild online (does not block DML)
ALTER INDEX emp_salary_ix REBUILD ONLINE;

-- Rebuild with new tablespace
ALTER INDEX emp_salary_ix REBUILD TABLESPACE idx_tbs ONLINE;

-- Rebuild and compress (for composite indexes with repeated leading values)
ALTER INDEX emp_dept_sal_ix REBUILD COMPRESS 1;
```

### When to Rebuild vs. Coalesce

| Scenario | Recommendation |
|---|---|
| Many deletes caused leaf block waste | Coalesce (fast, online-safe) |
| Clustering factor severely degraded | Consider reorganising the **table** |
| Moving index to different tablespace | Rebuild |
| Periodic "maintenance" on a healthy index | Neither — unnecessary on healthy indexes |

**Important:** Scheduled automatic index rebuilds (e.g., monthly) are largely unnecessary in Oracle 10g and later. An index in normal operation with up-to-date statistics rarely requires rebuilding. Always use `ANALYZE INDEX ... VALIDATE STRUCTURE` to confirm fragmentation before making a rebuild decision.

```sql
-- Analyze index structure to check for damage or extreme fragmentation
ANALYZE INDEX emp_salary_ix VALIDATE STRUCTURE;

-- Query results
SELECT name,
       height,
       blocks,
       lf_rows,     -- leaf rows (actual entries)
       lf_blks,     -- leaf blocks
       del_lf_rows, -- deleted leaf rows
       ROUND(del_lf_rows / NULLIF(lf_rows, 0) * 100, 2) AS pct_deleted
FROM   index_stats;
-- If pct_deleted > 20-30%, rebuilding may be beneficial
```

---

## Index on Foreign Keys

A commonly overlooked index is one placed on the **foreign key column** of a child table. Without it:

- Full table scans occur whenever the database navigates from the parent to the child
- Deleting a parent row or updating the parent primary key value (an uncommon operation) triggers a brief **exclusive table-level lock** on the child table in Oracle until the cascade or validation step completes

When the parent table is never deleted from, the decision to index the foreign key column follows the same logic as any other index: will it improve query performance?

```sql
-- Identify unindexed foreign keys
SELECT ac.table_name,
       ac.constraint_name,
       acc.column_name
FROM   all_constraints ac
JOIN   all_cons_columns acc
  ON   ac.constraint_name = acc.constraint_name
  AND  ac.owner           = acc.owner
WHERE  ac.constraint_type = 'R'  -- Referential (FK)
  AND  ac.owner           = 'HR'
  AND  NOT EXISTS (
    SELECT 1
    FROM   all_ind_columns aic
    WHERE  aic.table_name  = ac.table_name
      AND  aic.owner       = ac.owner
      AND  aic.column_name = acc.column_name
      AND  aic.column_position = 1
  );
```

---

## Automatic Indexing (19c+)

Oracle 19c introduced Automatic Indexing, a feature that applies machine learning to continuously evaluate the SQL workload, identify index candidates, validate them against real queries, and promote or retire them without manual intervention. It is available in Oracle Database 19c Enterprise Edition (with Diagnostics and Tuning pack licenses) and on Autonomous Database.

### How It Works

1. Oracle monitors SQL statements in the cursor cache for full table scans and index range scan opportunities.
2. Candidate indexes are created in an **invisible** state so they do not yet influence execution plans.
3. Each candidate is evaluated by replaying relevant SQL with and without the index in place.
4. Indexes that deliver a performance improvement are made **visible** (or applied directly, depending on the operating mode).
5. Indexes that remain unused are automatically dropped once the configured retention period expires.

### Configuration

```sql
-- Check current Auto Indexing configuration
SELECT parameter_name, parameter_value
FROM   dba_auto_index_config;

-- Set the operating mode
-- IMPLEMENT: creates and makes visible automatically (default on Autonomous)
-- REPORT ONLY: creates but keeps invisible; DBA must promote manually
-- OFF: disabled
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_MODE', 'IMPLEMENT');

-- Restrict to specific schemas (comma-separated; NULL = all schemas)
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_SCHEMA', 'HR, OE', allow => TRUE);

-- Exclude a schema
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_SCHEMA', 'SCOTT', allow => FALSE);

-- Set retention period for unused auto indexes (days; default 373)
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_RETENTION_FOR_AUTO', '90');

-- Set retention for manually created indexes tracked by auto indexing (days)
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_RETENTION_FOR_MANUAL', NULL);

-- Limit tablespace used by auto indexes (MB; NULL = no limit)
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_SPACE_BUDGET', '2048');
```

### Monitoring Activity

```sql
-- View recent Auto Indexing task executions
SELECT execution_name,
       execution_start,
       execution_end,
       status,
       new_indexes_found,
       new_indexes_created,
       indexes_dropped
FROM   dba_auto_index_executions
ORDER BY execution_start DESC
FETCH FIRST 10 ROWS ONLY;

-- View index actions taken (created, dropped, made visible, etc.)
SELECT index_name,
       table_owner,
       table_name,
       action,
       status,
       reason,
       creation_date
FROM   dba_auto_index_ind_actions
ORDER BY creation_date DESC;

-- View all auto-created indexes and their current state
SELECT ai.index_name,
       ai.table_owner,
       ai.table_name,
       ai.indexing_status,   -- VALID, UNUSABLE, etc.
       ui.status,
       ui.visibility,
       ui.last_analyzed
FROM   dba_auto_indexes ai
JOIN   dba_indexes ui
  ON   ai.index_name  = ui.index_name
  AND  ai.table_owner = ui.owner;
```

### Generating a Report

```sql
-- Activity report for the last 24 hours (returns CLOB)
SELECT DBMS_AUTO_INDEX.REPORT_ACTIVITY(
  activity_start => SYSDATE - 1,
  activity_end   => SYSDATE,
  type           => 'TEXT',
  section        => 'ALL'
) AS report
FROM dual;
```

### Promoting a REPORT ONLY Index to Visible

In `REPORT ONLY` mode, Oracle creates indexes but leaves them invisible. After reviewing the activity report, promote the candidates you want to activate:

```sql
-- Manually make an auto index visible after review
ALTER INDEX hr.sys_ai_abc123 VISIBLE;

-- Or use DBMS_AUTO_INDEX to accept a specific index
-- (marks it as manually accepted, preventing automatic drop)
EXEC DBMS_AUTO_INDEX.CONFIGURE('AUTO_INDEX_MODE', 'IMPLEMENT');
```

### Limitations

- Creates only B-tree indexes; **bitmap indexes**, **function-based indexes**, **IOT indexes**, and **cluster indexes** are not supported.
- Cannot index columns on **index-organized tables** or **external tables**.
- Requires **Diagnostics Pack** and **Tuning Pack** licenses for on-premises deployments.
- On Autonomous Database, automatic indexing is managed via `DBMS_AUTO_INDEX` and supports the `OFF`, `REPORT ONLY`, and `IMPLEMENT` modes.
- Auto-created indexes carry a `SYS_AI_` prefix and appear in `DBA_AUTO_INDEXES`.

### When to Use vs. Manual Indexing

| Scenario | Recommendation |
|---|---|
| Autonomous Database | Auto Indexing is on by default; supplement with manual indexes for complex cases |
| On-premises with licensed packs, stable schema | Enable in IMPLEMENT mode; review reports weekly |
| On-premises, want control | Use REPORT ONLY; promote candidates after review |
| Rapidly changing schema or workload | Disable; manual indexing gives more predictability |
| Missing index causing an emergency | Create manually — Auto Indexing runs on a schedule (typically hourly) |

---

## Best Practices

- **Index with restraint:** Add indexes only when evidence from explain plans, ASH, or AWR confirms they will be used.
- **Review for unused indexes** regularly via `V$INDEX_USAGE_INFO` (12cR2+) and remove those that are genuinely dormant. Unused indexes waste space and impose DML overhead.
- **Always index FK columns** on child tables to prevent lock escalation and eliminate unnecessary full scans.
- **Favor covering indexes** for high-frequency OLTP queries to remove the separate table row fetch step.
- **Test with invisible indexes** before exposing a change to all sessions.
- **Do not over-compress** B-tree indexes; key compression benefits composite indexes with repeated leading values but introduces CPU cost.
- **Use online rebuilds** (`REBUILD ONLINE`) in production to avoid blocking concurrent DML.
- **After a large batch delete**, assess whether affected indexes warrant a coalesce or rebuild.

---

## Common Mistakes

| Mistake | Impact | Fix |
|---|---|---|
| Placing a B-tree index on a Y/N flag column | Rarely used by the optimizer; adds DML overhead with no query benefit | Use a bitmap index (in a DW environment) or no index (in OLTP) |
| Incorrect column order in a composite index | Index bypassed for the most common queries | Place equality columns first, followed by range columns |
| Leaving FK columns unindexed | Lock escalation during parent DML; slower join performance | Index FK columns where needed |
| Concluding "no index needed" from a full table scan alone | An FBI requirement or type mismatch may be the real cause | Inspect predicate information and correct any function or type mismatches |
| Rebuilding all indexes on a fixed schedule | Maintenance window consumed with no meaningful gain | Rebuild only after confirming significant fragmentation |
| Dropping an index without prior testing | Can trigger a performance regression | Mark the index invisible first, validate behavior, then drop |
| Creating indexes that overlap with existing ones | Unnecessary DML overhead and storage consumption | Review existing indexes before adding a new one |

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database 19c SQL Tuning Guide (TGSQL)](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgsql/)
- [Oracle Database 19c Performance Tuning Guide (TGDBA)](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgdba/)
- [USER_INDEXES / DBA_INDEXES — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/USER_INDEXES.html)
- [DBA_INDEX_USAGE — Oracle Database 19c Reference (12cR2+)](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_INDEX_USAGE.html)
- [V$OBJECT_USAGE — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-OBJECT_USAGE.html)
- [DBMS_AUTO_INDEX — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_AUTO_INDEX.html)
- [DBA_AUTO_INDEXES — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_AUTO_INDEXES.html)
- [Automatic Indexing in Oracle Database 19c (Technical Paper)](https://www.oracle.com/technetwork/database/automatic-indexing-19c-wp-5324365.pdf)
