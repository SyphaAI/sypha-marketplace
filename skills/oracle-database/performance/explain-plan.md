# Explain Plan — Execution Plan Analysis

## Overview

An execution plan describes the ordered set of operations Oracle performs to resolve a SQL statement. The optimizer considers multiple candidate plans and selects the one with the lowest estimated cost. Knowing how to generate, read, and interpret execution plans is the most foundational skill in Oracle performance tuning.

Plans can be captured through several mechanisms:
- **EXPLAIN PLAN** — estimates the plan without running the query
- **DBMS_XPLAN.DISPLAY_CURSOR** — fetches the actual plan for a recently executed statement from the shared pool
- **DBMS_XPLAN.DISPLAY_AWR** — retrieves a historical plan stored in AWR
- **AUTOTRACE** — pairs EXPLAIN PLAN output with actual execution statistics inside SQL*Plus

---

## EXPLAIN PLAN

`EXPLAIN PLAN FOR` parses the SQL statement and writes the estimated plan to the `PLAN_TABLE` (a session-level temporary table created automatically). The query itself is **not** executed.

```sql
-- Basic usage
EXPLAIN PLAN FOR
SELECT e.last_name, d.department_name
FROM   employees e
JOIN   departments d ON e.department_id = d.department_id
WHERE  e.salary > 10000;

-- Display the result
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());
```

### Using a Statement ID (for Multiple Plans)

```sql
EXPLAIN PLAN SET STATEMENT_ID = 'MY_QUERY' FOR
SELECT * FROM orders WHERE status = 'PENDING';

SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY(
    table_name   => 'PLAN_TABLE',
    statement_id => 'MY_QUERY',
    format       => 'TYPICAL'
  )
);
```

### EXPLAIN PLAN Limitation

`EXPLAIN PLAN` applies bind variable peeking differently than the runtime engine does. The plan it produces may diverge from the plan that actually executes, particularly when:
- Bind variables are in use (the estimated plan substitutes default values)
- Adaptive plans are involved
- Object statistics are stale

**Use `DISPLAY_CURSOR` whenever you need to see the plan that was actually chosen at runtime.**

---

## DBMS_XPLAN.DISPLAY_CURSOR

Fetches the actual plan from the shared pool for a recently executed statement. This is the most dependable method for determining what Oracle actually chose to execute.

```sql
-- Display plan for the most recently executed statement in your session
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR());

-- Display plan for a specific SQL_ID (last child cursor)
SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY_CURSOR(
    sql_id        => 'abc123xyz789',
    cursor_child_no => NULL,   -- NULL = most recent child
    format        => 'TYPICAL'
  )
);

-- Find the SQL_ID of a recent query
SELECT sql_id, plan_hash_value, sql_text
FROM   v$sql
WHERE  sql_text LIKE '%orders%'
  AND  sql_text NOT LIKE '%v$sql%'
ORDER  BY last_active_time DESC
FETCH  FIRST 10 ROWS ONLY;
```

### Format Options

| Format String | What It Shows |
|---|---|
| `'BASIC'` | Operation and object only |
| `'TYPICAL'` | Standard output (default) — operations, cost, rows, bytes |
| `'ALL'` | Full details including predicate information, column projections |
| `'ADVANCED'` | ALL plus outline, binding, remote SQL |
| `'+IOSTATS LAST'` | Adds actual row counts from the last execution |
| `'+MEMSTATS'` | Memory usage for sort/hash operations |
| `'+ROWSTATS LAST'` | Row source statistics (requires `STATISTICS_LEVEL=ALL` or hint) |

```sql
-- Most useful format for debugging: plan + actual row counts
SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY_CURSOR(
    sql_id  => 'abc123xyz789',
    format  => 'TYPICAL +IOSTATS LAST +PEEKED_BINDS'
  )
);
```

### Enable Row Source Statistics Collection

To get actual row counts per operation (the most valuable diagnostic data), you need statistics collection enabled:

```sql
-- Option 1: Session-level (use this when you control the session)
ALTER SESSION SET STATISTICS_LEVEL = ALL;
-- Run your query...
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(FORMAT => 'ALLSTATS LAST'));

-- Option 2: Query-level hint (no ALTER SESSION needed)
SELECT /*+ GATHER_PLAN_STATISTICS */
       e.last_name, e.salary
FROM   employees e
WHERE  e.department_id = 60;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(FORMAT => 'ALLSTATS LAST'));
```

---

## DBMS_XPLAN.DISPLAY_AWR

Retrieves historical plans persisted in AWR. Use this when the plan of interest is no longer present in the shared pool.

> Note: In Oracle Database 23ai and later, `DISPLAY_AWR` is deprecated. The replacement is `DBMS_XPLAN.DISPLAY_WORKLOAD_REPOSITORY`, which has the same intent but a slightly different signature (`dbid` is the last parameter and the parameter is named `dbid` not `db_id`). `DISPLAY_AWR` continues to function for backward compatibility but new code should prefer `DISPLAY_WORKLOAD_REPOSITORY`.

```sql
-- All plans for a SQL_ID from AWR (use DISPLAY_WORKLOAD_REPOSITORY in 23ai+)
SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY_AWR(
    sql_id          => 'abc123xyz789',
    plan_hash_value => NULL,  -- NULL shows all plans
    db_id           => NULL,  -- NULL = current database
    format          => 'TYPICAL'
  )
);

-- List all plan hashes for a SQL from AWR
SELECT sql_id,
       plan_hash_value,
       MIN(begin_interval_time) AS first_seen,
       MAX(end_interval_time)   AS last_seen,
       SUM(executions_delta)    AS total_executions,
       ROUND(SUM(elapsed_time_delta) / NULLIF(SUM(executions_delta),0) / 1e6, 3) AS avg_elapsed_sec
FROM   dba_hist_sqlstat s
JOIN   dba_hist_snapshot sn USING (snap_id, dbid, instance_number)
WHERE  sql_id = 'abc123xyz789'
GROUP  BY sql_id, plan_hash_value
ORDER  BY first_seen;
```

---

## Reading the Plan Output

A typical plan looks like this:

```
Plan hash value: 1234567890

----------------------------------------------------------------------------------
| Id  | Operation                    | Name         | Rows  | Bytes | Cost (%CPU)|
----------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |              |   500 |  25K  |   142   (2)|
|   1 |  HASH JOIN                   |              |   500 |  25K  |   142   (2)|
|   2 |   TABLE ACCESS FULL          | DEPARTMENTS  |    27 |   432 |     3   (0)|
|*  3 |   TABLE ACCESS BY INDEX ROWID| EMPLOYEES    |   500 |  17K  |   139   (1)|
|*  4 |    INDEX RANGE SCAN          | EMP_DEPT_IX  |   503 |       |     2   (0)|
----------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   3 - filter("E"."SALARY">10000)
   4 - access("E"."DEPARTMENT_ID"="D"."DEPARTMENT_ID")
```

### Understanding Each Column

| Column | Meaning |
|---|---|
| `Id` | Step number; an asterisk (*) indicates that predicates are applied at this step |
| `Operation` | The algorithm Oracle employs (TABLE ACCESS FULL, INDEX RANGE SCAN, HASH JOIN, etc.) |
| `Name` | The table or index involved in the operation |
| `Rows` | The optimizer's estimated row count (cardinality) |
| `Bytes` | Estimated data volume (rows multiplied by average row size) |
| `Cost` | Relative optimizer cost based on the I/O + CPU model |
| `(%CPU)` | Share of the cost attributed to CPU work |
| `Time` | Estimated wall-clock duration (a rough approximation only) |

### Reading with Actual Rows (ALLSTATS format)

```
| Id  | Operation            | Name    | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT     |         |      1 |        |     50 |00:00:02.14 |   84321 |
|*  1 |  TABLE ACCESS FULL   | ORDERS  |      1 |  500K  |     50 |00:00:02.14 |   84321 |
```

- `Starts` — the number of times this operation was invoked
- `E-Rows` — estimated row count (the optimizer's prediction)
- `A-Rows` — actual rows produced
- `A-Time` — cumulative elapsed time through and including this step
- `Buffers` — logical I/O (buffer gets) charged to this step

**The most valuable diagnostic:** Compare `E-Rows` against `A-Rows`. Divergences of 10x or more signal cardinality estimate errors, which steer the optimizer toward poor plan choices.

### Plan Tree Reading Order

Plans are read **inside-out** (starting with the most indented node) and **bottom-up** within each branch:

```
|   0 | SELECT STATEMENT    |          -- last: combine results
|   1 |  SORT ORDER BY      |          -- step 4: sort
|   2 |   HASH JOIN         |          -- step 3: join
|   3 |    INDEX RANGE SCAN | IDX_A    -- step 1: probe index
|   4 |    TABLE ACCESS FULL| TABLE_B  -- step 2: scan table
```

---

## Common Plan Operations and What They Mean

### Access Paths

| Operation | Description | Good When |
|---|---|---|
| `TABLE ACCESS FULL` | Reads all blocks of table | Few rows returned relative to table, or majority of table needed |
| `TABLE ACCESS BY INDEX ROWID` | Fetches row by rowid after index lookup | Selective predicate with good index |
| `INDEX UNIQUE SCAN` | Single index entry lookup | Primary key or unique constraint lookup |
| `INDEX RANGE SCAN` | Scans a range of index entries | Range predicate or low-cardinality equality |
| `INDEX FAST FULL SCAN` | Reads all index blocks like a FTS | Index covers all needed columns; avoids table access |
| `INDEX SKIP SCAN` | Skips leading column of composite index | Low cardinality leading column |

### Join Methods

| Operation | Description | Good When |
|---|---|---|
| `NESTED LOOPS` | For each outer row, probe inner | Outer is small; inner has selective index |
| `HASH JOIN` | Build hash table from smaller side, probe with larger | Larger datasets; no useful index |
| `MERGE JOIN` | Sort both inputs, merge-join | Both inputs pre-sorted; equality join |
| `NESTED LOOPS ANTI` / `SEMI` | Anti/semi join optimization | NOT IN / EXISTS subqueries |

---

## AUTOTRACE in SQL*Plus

AUTOTRACE displays the execution plan along with runtime statistics once a query completes.

```sql
-- Setup (one-time per user, DBA required)
-- Grant access to the plan table and autotrace role
GRANT SELECT ON v_$session TO your_user;
GRANT SELECT ON v_$sql_plan TO your_user;
-- Or simply:
GRANT PLUSTRACE TO your_user;

-- Enable autotrace
SET AUTOTRACE ON            -- show results + plan + stats
SET AUTOTRACE TRACEONLY     -- suppress results, show plan + stats
SET AUTOTRACE TRACEONLY EXPLAIN -- plan only (no execution)
SET AUTOTRACE TRACEONLY STATISTICS -- stats only (executes)
SET AUTOTRACE OFF           -- disable

-- Example session
SET AUTOTRACE TRACEONLY
SELECT * FROM employees WHERE department_id = 60;
```

Autotrace output includes:

```
Statistics
----------------------------------------------------------
         45  recursive calls
          0  db block gets
        182  consistent gets          <-- logical reads
          3  physical reads           <-- disk reads
          0  redo size
       1423  bytes sent via SQL*Net
        608  bytes received via SQL*Net
          3  SQL*Net roundtrips
          1  sorts (memory)
          0  sorts (disk)
          6  rows processed
```

**Key autotrace statistics:**

- `consistent gets` — logical reads satisfied from the buffer cache
- `physical reads` — blocks read from disk
- `sorts (disk)` — sort exceeded PGA memory and spilled to the temp tablespace
- `recursive calls` — internal SQL activity (dictionary lookups, triggers); a high value warrants investigation

---

## Identifying Bad Plans

### Symptom 1: Cardinality Mismatch

```sql
-- After running with GATHER_PLAN_STATISTICS:
-- E-Rows = 5, A-Rows = 500,000
-- Optimizer chose NESTED LOOPS thinking 5 rows
-- Fix: gather accurate stats, consider extended stats, SQL hints
```

### Symptom 2: Wrong Join Order

The optimizer joins large tables together instead of starting with the smaller side. This typically results from stale or absent statistics.

### Symptom 3: Full Table Scan When Index Expected

```sql
-- Common causes:
-- 1. Function applied to indexed column (defeats index)
SELECT * FROM employees WHERE UPPER(last_name) = 'SMITH';
-- Fix: create function-based index
CREATE INDEX emp_upper_lname ON employees (UPPER(last_name));

-- 2. Implicit data type conversion
SELECT * FROM employees WHERE employee_id = '100';  -- VARCHAR vs NUMBER
-- Fix: match data types

-- 3. Leading wildcard
SELECT * FROM employees WHERE last_name LIKE '%SMITH';
-- Fix: consider Oracle Text or application redesign

-- 4. Optimizer decides FTS is cheaper (small table, or most rows returned)
-- This may actually be correct; verify with actual row counts
```

### Symptom 4: Inefficient Subquery (Not Unnested)

```sql
-- Correlated subquery running once per outer row
SELECT * FROM orders o
WHERE  total > (SELECT AVG(total) FROM orders WHERE customer_id = o.customer_id);
-- Check plan for "FILTER" operation with subquery — often slow
-- Fix: rewrite as JOIN with inline view or use analytic function
SELECT * FROM (
  SELECT o.*, AVG(total) OVER (PARTITION BY customer_id) AS avg_total
  FROM   orders o
)
WHERE  total > avg_total;
```

### Symptom 5: Sort-Merge Join Instead of Hash Join on Large Tables

This typically points to missing or out-of-date system statistics.

```sql
-- Manually hint a hash join to test
SELECT /*+ USE_HASH(e d) */ e.last_name, d.department_name
FROM   employees e, departments d
WHERE  e.department_id = d.department_id;
```

---

## Best Practices

- **Always include the `GATHER_PLAN_STATISTICS`** hint or set `STATISTICS_LEVEL=ALL` when debugging so actual row counts are visible alongside estimates.
- **Examine `E-Rows` against `A-Rows` at every step.** The first node where the two diverge significantly is the place to direct your investigation.
- **Prefer `DISPLAY_CURSOR` over `EXPLAIN PLAN`** for production SQL debugging. `EXPLAIN PLAN` can produce misleading results when bind variables are present.
- **Include `PEEKED_BINDS` in the format string** to see the bind values Oracle used when the plan was compiled.
- **Lock good plans using SQL Plan Management (SPM)** to guard against plan regression following statistics refreshes or upgrades.
- **Review the `Predicate Information` section.** Verify that filters (`filter`) are applied at the expected steps and that access predicates (`access`) align with your index structure.

```sql
-- Create a SQL Plan Baseline to lock a good plan
DECLARE
  l_plans PLS_INTEGER;
BEGIN
  l_plans := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(
    sql_id          => 'abc123xyz789',
    plan_hash_value => 1234567890
  );
  DBMS_OUTPUT.PUT_LINE('Plans loaded: ' || l_plans);
END;
/
```

---

## Common Mistakes

| Mistake | Impact | Correction |
|---|---|---|
| Using EXPLAIN PLAN for SQL with bind variables | Displayed plan may not match what runs at runtime | Use `DISPLAY_CURSOR` with `+PEEKED_BINDS` |
| Skipping the A-Rows vs E-Rows comparison | Cardinality estimate problems go undetected | Always apply the `GATHER_PLAN_STATISTICS` hint |
| Treating lower cost as equivalent to faster execution | Cost is a relative model value, not a wall-clock measurement | Measure actual elapsed time |
| Embedding hints in production code | Hints are fragile and break when objects change | Resolve the root cause via statistics or indexes; use SPM |
| Overlooking Predicate Information | The filter vs. access predicate distinction is missed | Always read the predicate section |
| Misreading cumulative A-Time | Each step's time rolls up child-step time | Subtract child A-Time from parent to isolate step duration |
| Creating additional indexes to eliminate every FTS | May degrade DML throughput and consume extra storage | Confirm the full table scan is actually the bottleneck before indexing |

---

## Security Considerations

### Protecting Execution Plan Information
Execution plans can expose sensitive details about your database schema, indexes, and query structure. Handle them as sensitive data:

- **Restrict access to plan tables and views:**
  ```sql
  -- Only grant necessary privileges for plan analysis
  GRANT SELECT ON plan_table TO tuning_role;
  GRANT SELECT ON v_$sql_plan TO tuning_role;
  GRANT SELECT ON v_$sql_plan_statistics TO tuning_role;
  GRANT SELECT ON v_$sqlarea TO tuning_role;
  -- Avoid granting these to PUBLIC or overly broad roles
  ```

- **Exercise care when sharing plans with external parties** (vendors, consultants, etc.):
  - Plans can disclose table structures, index names, and column details
  - When sharing for troubleshooting purposes, consider masking schema and object names
  - Where possible, use database links to a remote tuning environment rather than exporting plans directly

- **Watch for unauthorized attempts to access plan data:**
  ```sql
  -- Audit access to plan-related views
  CREATE AUDIT POLICY plan_access_monitor
    ACTIONS SELECT ON SYS.V_$SQL_PLAN,
            SELECT ON SYS.V_$SQLAREA;
  AUDIT POLICY plan_access_monitor;
  ```

### SQL Injection and Plan Stability
Although explain plan does not execute SQL, the statements being analyzed remain vulnerable to injection:

- **Always use bind variables** in application code to prevent SQL injection:
  ```java
  // SAFE: Using PreparedStatement with bind variables
  PreparedStatement ps = conn.prepareStatement(
      "SELECT * FROM employees WHERE department_id = ? AND salary > ?");
  ps.setInt(1, deptId);
  ps.setDouble(2, minSalary);
  ResultSet rs = ps.executeQuery();

  // UNSAFE: String concatenation leads to SQL injection
  // String sql = "SELECT * FROM employees WHERE department_id = " + deptId
  //           + " AND salary > " + minSalary;  // NEVER DO THIS
  ```

- **Plan instability caused by SQL injection** can introduce performance problems:
  - Attackers may inject hints or restructure query text
  - This can force bad execution plans into the shared pool
  - Apply proper input validation and enforce database-level security controls (VPD, Oracle Database Firewall)

### Secure Plan Management

- **When using SQL Plan Management (SPM), account for its security implications:**
  ```sql
  -- Baseline plans only from trusted sources
  -- Avoid loading plans from unverified SQL statements
  DECLARE
    l_plans PLS_INTEGER;
  BEGIN
    l_plans := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(
      sql_id          => 'trusted_sql_id_only',  -- Verify source first
      plan_hash_value => 1234567890
    );
  END;
  /

- **Restrict who can create/modify SQL Plan Baselines:**
  ```sql
  -- Only grant ADMINISTER SQL MANAGEMENT OBJECT to trusted DBAs
  GRANT ADMINISTER SQL MANAGEMENT OBJECT TO dba_role;
  -- Do NOT grant this to application users or developers
  ```

### Protecting Sensitive Data in Plans

- **Execution plans can expose peeked bind values** that may contain sensitive data:
  ```sql
  -- When using +PEEKED_BINDS format, be aware that:
  SELECT * FROM TABLE(
    DBMS_XPLAN.DISPLAY_CURSOR(
      sql_id  => 'some_sql_id',
      format  => 'TYPICAL +PEEKED_BINDS'
    )
  );
  -- This might show actual values like credit card numbers, passwords, etc.
  ```

- **Mitigation approaches:**
  - Avoid placing sensitive values directly in bind variables where feasible; use application-level encryption or tokenization instead
  - Limit who can invoke DISPLAY_CURSOR with the +PEEKED_BINDS format option
  - Design applications to pass surrogate keys or tokens in SQL rather than raw sensitive data

### Compliance Considerations

- **PCI-DSS**: Execution plans can expose the cardholder data environment — restrict access appropriately
- **HIPAA**: Plans may reveal PHI-related table and column structures — apply minimum necessary access controls
- **GDPR**: Plans can surface personal data structures — ensure that access is granted only to authorized personnel

- **Audit plan access to meet compliance requirements:**
  ```sql
  -- Track who accesses execution plans (for compliance reporting)
  CREATE AUDIT POLICY plan_access_audit
    ACTIONS SELECT ON SYS.V_$SQL_PLAN,
            SELECT ON SYS.V_$SQL_PLAN_STATISTICS_ALL;
  AUDIT POLICY plan_access_audit;
  ```

---

## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## See Also

- [SQL Tuning in Oracle](../sql-dev/sql-tuning.md) — Full SQL tuning methodology: hints, profiles, baselines

## Sources

- [Oracle Database 19c SQL Tuning Guide (TGSQL)](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgsql/)
- [DBMS_XPLAN — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_XPLAN.html)
- [V$SQL — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SQL.html)
- [DBMS_SPM — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SPM.html)
- [PLAN_TABLE — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/PLAN_TABLE.html)
