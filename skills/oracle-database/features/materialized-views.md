# Oracle Materialized Views

## Overview

A **materialized view (MV)** is a database object that physically stores query results on disk and can optionally refresh those results as the underlying base tables change. Unlike a standard view — which re-executes its defining query on every reference — a materialized view is a persisted snapshot of query output that can be read without any recomputation.

Materialized views fulfill two primary roles in Oracle:

1. **Query rewrite** — The optimizer transparently redirects a user query to read from a pre-aggregated MV rather than the expensive base tables, with no changes required to application code.
2. **Data replication** — Delivering a summarized or filtered copy of data to a different schema, database, or reporting tier for independent use.

Materialized views were introduced in Oracle 8i as a successor to the older snapshot mechanism and have been steadily improved through 26ai.

---

## Core Concepts

### Refresh Modes

| Mode | Description | Use Case |
|---|---|---|
| `COMPLETE` | Truncates and re-populates the MV by re-executing the full query | Any query; least restrictions; slowest for large data sets |
| `FAST` | Applies only changes since the last refresh using MV logs | Large base tables with small incremental change |
| `FORCE` | Uses FAST if possible, falls back to COMPLETE | General default; good when FAST eligibility is uncertain |
| `NEVER` | MV is never refreshed automatically; must be refreshed manually | Static snapshots, data migration, staging |

### Refresh Timing

| Timing | Description |
|---|---|
| `ON COMMIT` | MV is refreshed automatically when a DML transaction on the base table(s) commits |
| `ON DEMAND` | MV is refreshed only when explicitly triggered via `DBMS_MVIEW.REFRESH` |
| `ON STATEMENT` | 12c+: Refresh triggers immediately after each DML statement, before commit |
| `START WITH ... NEXT ...` | Legacy syntax for scheduled refresh; prefer `DBMS_SCHEDULER` jobs in modern setups |

### Materialized View Logs

A **materialized view log (MV log)** is a change-capture table maintained on a base table. Every INSERT, UPDATE, and DELETE against the base table is written to this log. A FAST refresh reads the log rather than re-scanning the entire base table, then clears the entries it has consumed.

---

## Creating Materialized View Logs

Before creating a FAST-refreshable MV, create a log on each base table the MV references:

```sql
-- Basic MV log: captures all DML changes, including new values
CREATE MATERIALIZED VIEW LOG ON sales
WITH ROWID, SEQUENCE
    (sale_date, product_id, region_id, amount, qty)
INCLUDING NEW VALUES;

-- MV log on dimension table
CREATE MATERIALIZED VIEW LOG ON products
WITH ROWID, SEQUENCE (product_id, category_id, unit_price)
INCLUDING NEW VALUES;

CREATE MATERIALIZED VIEW LOG ON regions
WITH ROWID, SEQUENCE (region_id, region_name, country_code)
INCLUDING NEW VALUES;
```

**Key `WITH` options:**

| Option | Required for |
|---|---|
| `ROWID` | FAST refresh of non-aggregate (join) MVs |
| `PRIMARY KEY` | FAST refresh when MV uses primary key joins |
| `SEQUENCE` | FAST refresh of aggregate MVs (ORDER updates correctly) |
| `INCLUDING NEW VALUES` | FAST refresh of aggregate MVs with `SUM`, `COUNT`, etc. |

---

## Creating Materialized Views

### COMPLETE Refresh — Simple Aggregate

```sql
CREATE MATERIALIZED VIEW mv_monthly_sales_summary
BUILD IMMEDIATE           -- populate immediately on creation; BUILD DEFERRED populates later
REFRESH COMPLETE
ON DEMAND
AS
SELECT  TRUNC(s.sale_date, 'MM')  AS sale_month,
        p.category_id,
        r.region_name,
        COUNT(*)                   AS num_sales,
        SUM(s.amount)              AS total_revenue,
        SUM(s.qty)                 AS total_qty
FROM    sales    s
JOIN    products p ON p.product_id = s.product_id
JOIN    regions  r ON r.region_id  = s.region_id
GROUP   BY TRUNC(s.sale_date, 'MM'), p.category_id, r.region_name;
```

### FAST Refresh — Aggregate MV

FAST refresh on aggregate MVs imposes the following requirements on the MV query:
- `COUNT(*)` must appear in the select list
- For any `SUM(col)`, the corresponding `COUNT(col)` must also be included
- Every dimension must have an MV log with `SEQUENCE` and `INCLUDING NEW VALUES`

```sql
CREATE MATERIALIZED VIEW mv_sales_by_product_region
BUILD IMMEDIATE
REFRESH FAST ON DEMAND
ENABLE QUERY REWRITE
AS
SELECT  s.product_id,
        s.region_id,
        COUNT(*)              AS cnt,         -- required for FAST refresh
        SUM(s.amount)         AS sum_amount,
        COUNT(s.amount)       AS cnt_amount,  -- required for SUM fast refresh
        SUM(s.qty)            AS sum_qty,
        COUNT(s.qty)          AS cnt_qty
FROM    sales s
GROUP   BY s.product_id, s.region_id;
```

### FAST Refresh — Join MV

```sql
CREATE MATERIALIZED VIEW mv_sales_detail
BUILD IMMEDIATE
REFRESH FAST ON DEMAND
ENABLE QUERY REWRITE
AS
SELECT  s.rowid        AS sales_rowid,
        p.rowid        AS products_rowid,
        s.sale_id,
        s.sale_date,
        s.amount,
        p.product_name,
        p.category_id
FROM    sales    s
JOIN    products p ON p.product_id = s.product_id;
```

Join MVs that use FAST refresh must select both ROWIDs — Oracle relies on them to identify which rows have changed in the log.

### ON COMMIT Refresh

```sql
CREATE MATERIALIZED VIEW mv_account_balances
BUILD IMMEDIATE
REFRESH FAST ON COMMIT   -- refreshed automatically when any base table transaction commits
ENABLE QUERY REWRITE
AS
SELECT  account_id,
        COUNT(*)         AS num_transactions,
        SUM(amount)      AS current_balance
FROM    transactions
GROUP   BY account_id;
```

**Caution:** `ON COMMIT` refresh executes synchronously inside the committing transaction. Complex or slow refreshes will noticeably degrade the application's commit latency.

### FORCE Refresh (Recommended Default)

```sql
CREATE MATERIALIZED VIEW mv_regional_totals
BUILD IMMEDIATE
REFRESH FORCE ON DEMAND
ENABLE QUERY REWRITE
AS
SELECT  r.region_name,
        TRUNC(s.sale_date, 'YYYY') AS sale_year,
        SUM(s.amount)              AS annual_revenue
FROM    sales   s
JOIN    regions r ON r.region_id = s.region_id
GROUP   BY r.region_name, TRUNC(s.sale_date, 'YYYY');
```

---

## Query Rewrite

Query rewrite is Oracle's mechanism for **transparently replacing** a user query that references base tables with an equivalent query directed at a materialized view. No application code changes are required — the optimizer performs the substitution automatically.

### Enabling Query Rewrite

```sql
-- At the database level (requires DBA privileges)
ALTER SYSTEM SET query_rewrite_enabled = TRUE;

-- At the session level
ALTER SESSION SET query_rewrite_enabled = TRUE;

-- On the MV itself
ALTER MATERIALIZED VIEW mv_sales_by_product_region ENABLE QUERY REWRITE;

-- Check if MV is eligible for query rewrite
SELECT mview_name, rewrite_enabled, staleness, refresh_mode
FROM   user_mviews;
```

### Verifying Query Rewrite Is Being Used

```sql
-- Run EXPLAIN PLAN to see if the MV is substituted
EXPLAIN PLAN FOR
    SELECT s.product_id, s.region_id, SUM(s.amount)
    FROM   sales s
    GROUP  BY s.product_id, s.region_id;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
-- Look for: MAT_VIEW REWRITE ACCESS FULL (MV_SALES_BY_PRODUCT_REGION)
```

### Query Rewrite Integrity Modes

```sql
-- Set globally or per session
ALTER SESSION SET query_rewrite_integrity = ENFORCED;
-- ENFORCED: only rewrites if MV is known to be fresh (most conservative)
-- TRUSTED:  trusts RELY constraints and dimension relationships
-- STALE_TOLERATED: allows rewrite even on stale MVs (least conservative; use with care)
```

For query rewrite to function reliably:
- The MV must specify `ENABLE QUERY REWRITE`
- The MV must be current (or `STALE_TOLERATED` mode must be active)
- The optimizer must determine that the MV query is equivalent to or a superset of the user query
- `QUERY_REWRITE_ENABLED = TRUE` must be in effect

---

## Manual Refresh

```sql
-- Refresh a single MV
BEGIN
    DBMS_MVIEW.REFRESH(
        list            => 'APPSCHEMA.MV_MONTHLY_SALES_SUMMARY',
        method          => 'C',   -- C=COMPLETE, F=FAST, ?=FORCE, A=always COMPLETE
        atomic_refresh  => FALSE  -- TRUE keeps MV accessible during refresh (at cost of undo)
    );
END;
/

-- Refresh multiple MVs in dependency order
BEGIN
    DBMS_MVIEW.REFRESH(
        list   => 'MV_SALES_DETAIL,MV_SALES_BY_PRODUCT_REGION,MV_MONTHLY_SALES_SUMMARY',
        method => 'F'
    );
END;
/

-- Refresh all MVs in a schema
BEGIN
    FOR mv IN (SELECT mview_name FROM user_mviews) LOOP
        BEGIN
            DBMS_MVIEW.REFRESH(mv.mview_name, method => 'C');  -- complete refresh
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('Failed: ' || mv.mview_name || ' — ' || SQLERRM);
        END;
    END LOOP;
END;
/
```

### DBMS_MVIEW.REFRESH_DEPENDENT

Refreshes every MV that has a dependency on a specified base table:

```sql
BEGIN
    DBMS_MVIEW.REFRESH_DEPENDENT(
        list       => 'SALES',         -- base table name
        method     => 'F',
        rollback_seg => NULL
    );
END;
/
```

---

## Scheduling Refresh with DBMS_SCHEDULER

```sql
BEGIN
    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'REFRESH_SALES_MVS_JOB',
        job_type        => 'PLSQL_BLOCK',
        job_action      => '
            BEGIN
                DBMS_MVIEW.REFRESH(
                    list           => ''MV_SALES_BY_PRODUCT_REGION,MV_MONTHLY_SALES_SUMMARY'',
                    method         => ''F'',
                    atomic_refresh => FALSE
                );
            END;',
        repeat_interval => 'FREQ=HOURLY;BYMINUTE=0;BYSECOND=0',
        enabled         => TRUE,
        comments        => 'Hourly FAST refresh of sales materialized views'
    );
END;
/
```

---

## Monitoring Staleness and Freshness

```sql
-- MV freshness and refresh status
SELECT mview_name,
       last_refresh_date,
       last_refresh_type,
       staleness,          -- FRESH, STALE, UNKNOWN, NEEDS_COMPILE
       refresh_mode,
       refresh_method,
       rewrite_enabled
FROM   user_mviews
ORDER  BY mview_name;

-- MV log size and age (how much unprocessed change exists)
SELECT log_owner,
       master             AS base_table,
       log_table,
       log_trigger,
       rowids,
       sequence,
       includes_new_values
FROM   user_mview_logs;

-- Row count in MV log (unprocessed entries)
SELECT COUNT(*) AS pending_changes FROM mlog$_sales;

-- MV refresh history
SELECT mview_name,
       start_time,
        end_time,
       elapsed_time,
       refresh_method,
       complete_stats_update
FROM   dba_mvref_stats
WHERE  mview_name = 'MV_MONTHLY_SALES_SUMMARY'
ORDER  BY start_time DESC
FETCH FIRST 20 ROWS ONLY;

-- Check if MVs are blocking query rewrite due to staleness
SELECT name, freshness
FROM   v$object_usage;
```

---

## Partitioned Materialized Views

MVs can themselves be partitioned, which becomes important when the MV grows large:

```sql
CREATE MATERIALIZED VIEW mv_partitioned_sales
PARTITION BY RANGE (sale_month) (
    PARTITION p_2023 VALUES LESS THAN (DATE '2024-01-01'),
    PARTITION p_2024 VALUES LESS THAN (DATE '2025-01-01'),
    PARTITION p_2025 VALUES LESS THAN (DATE '2026-01-01'),
    PARTITION p_future VALUES LESS THAN (MAXVALUE)
)
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
SELECT  TRUNC(sale_date, 'MM') AS sale_month,
        region_id,
        product_id,
        SUM(amount)             AS revenue
FROM    sales
GROUP   BY TRUNC(sale_date, 'MM'), region_id, product_id;
```

When an MV is partitioned, a **COMPLETE** refresh can internally leverage partition truncation (refreshing partition by partition), which generates significantly less undo compared to truncating and repopulating the whole MV at once.

---

## Best Practices

- **Create MV logs before creating the MV.** Oracle verifies log existence at MV creation time when `REFRESH FAST` is specified.
- **Use `BUILD DEFERRED` in production deployments** whenever the initial population would cause disruption. Schedule a manual refresh during a maintenance window immediately after the DDL completes.
- **Limit `ON COMMIT` refreshes to small, straightforward MVs.** The refresh executes within the committing user's session. For aggregates spanning millions of rows, switch to `ON DEMAND` with a short-interval scheduler job.
- **Always include `COUNT(*)` and `COUNT(col)` explicitly in aggregate MVs** that will use FAST refresh. Oracle's optimizer depends on these counts to calculate incremental deltas correctly.
- **Monitor MV log growth.** A failed or delayed FAST refresh causes MV logs to accumulate without bound. Tables carrying a large unprocessed log incur write-amplification overhead on every DML operation. Set an alert when the log row count crosses a defined threshold.
- **Use `atomic_refresh => FALSE`** for large COMPLETE refreshes to prevent excessive undo generation. With `atomic_refresh => TRUE` (the default), Oracle preserves the old data during refresh via undo; for very large MVs this can exhaust the undo tablespace.
- **Enable `QUERY REWRITE` only on MVs the optimizer should actively consider.** Enabling it across dozens of MVs forces the optimizer to evaluate all of them on every query parse, which can increase parse overhead.
- **Verify rewrites with `EXPLAIN PLAN`.** Never assume — confirm through execution plans that reporting queries are genuinely reading from MVs.

---

## Common Mistakes and How to Avoid Them

**Mistake 1: FAST refresh silently falls back to COMPLETE with no warning**
When a FAST refresh is requested but is not feasible (for example, the MV log is missing a required option), Oracle either raises an error or falls back to COMPLETE depending on the `method` parameter. Specify `FORCE` (`?`) as the method to allow silent fallback, but then **monitor `last_refresh_type`** in `USER_MVIEWS` to confirm that the expected refresh method is actually being used.

```sql
-- Audit what refresh type was actually used
SELECT mview_name, last_refresh_type, last_refresh_date
FROM   user_mviews
WHERE  last_refresh_type != 'FAST';   -- unexpected COMPLETE refreshes
```

**Mistake 2: Forgetting `SEQUENCE` and `INCLUDING NEW VALUES` on MV logs for aggregate MVs**
Without `SEQUENCE`, Oracle cannot reliably order UPDATE operations that transition a value from old to new within an aggregate. Without `INCLUDING NEW VALUES`, Oracle cannot derive the delta for SUM or COUNT. Both options are mandatory for aggregate FAST refresh.

**Mistake 3: Stale MVs degrading query rewrite silently**
When `query_rewrite_integrity = ENFORCED` (the default), a stale MV is silently excluded from query rewrite with no error. Queries fall through to the base tables and run slowly without any indication of why. Configure monitoring alerts on the `staleness` column in `USER_MVIEWS`.

**Mistake 4: Cascading ON COMMIT refresh on large tables**
`ON COMMIT` refresh is synchronous and executes within the committing user's session. On a high-DML table that feeds a complex aggregate MV, every INSERT, UPDATE, or DELETE will be measurably slower. Switch to `ON DEMAND` with a frequent scheduled refresh if the slight data latency is acceptable.

**Mistake 5: Not accounting for MV logs in backup and export strategies**
MV logs are ordinary tables and are included in Data Pump exports. After a restore or import, MV logs may hold stale entries that reference ROWIDs no longer present in the base table. Following any restore, force a `COMPLETE` refresh on all MVs to reset their logs to a consistent state.

**Mistake 6: Altering the base table without updating the MV log**
Adding a column to a base table does not automatically propagate that column into the MV log. If a new or modified MV requires that column for FAST refresh, you must either drop and recreate the MV log (clearing any pending changes) or use `ALTER MATERIALIZED VIEW LOG ADD (new_column)`.

```sql
-- Check which columns are covered by an existing MV log
SELECT column_name, refs_src_rowid, snapshots
FROM   user_mview_log_filter_cols
WHERE  master = 'SALES';
```

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database Data Warehousing Guide: Basic Materialized Views 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/dwhsg/basic-materialized-views.html)
- [DBMS_MVIEW — Oracle Database PL/SQL Packages and Types Reference 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_MVIEW.html)
- [Oracle Database SQL Language Reference: CREATE MATERIALIZED VIEW 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-MATERIALIZED-VIEW.html)
- [Oracle Database SQL Language Reference: CREATE MATERIALIZED VIEW LOG 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-MATERIALIZED-VIEW-LOG.html)
