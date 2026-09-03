# SQL Tuning in Oracle

## Overview

SQL tuning is the practice of improving query performance by understanding how Oracle's Cost-Based Optimizer (CBO) constructs and executes query plans. Effective tuning involves reading execution plans, recognizing join methods and access paths, managing optimizer statistics, and knowing when and how to steer the optimizer using hints, profiles, or baselines.

Oracle's CBO evaluates candidate execution plans and picks the one with the lowest estimated cost — a function of CPU, I/O, and memory. When the CBO makes poor choices, it is typically because statistics are stale, absent, or misleading, or because the query is written in a way that blocks efficient access paths.

---

## Execution Plans

### Generating an Execution Plan

The two primary methods are `EXPLAIN PLAN` (estimates only) and `DBMS_XPLAN` (actual or estimated):

```sql
-- Estimate-only plan (no execution)
EXPLAIN PLAN FOR
SELECT e.last_name, d.department_name
FROM   employees e
JOIN   departments d ON e.department_id = d.department_id
WHERE  e.salary > 10000;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());
```

```sql
-- Actual execution stats via SQL*Plus autotrace
SET AUTOTRACE ON
SELECT e.last_name, d.department_name
FROM   employees e
JOIN   departments d ON e.department_id = d.department_id
WHERE  e.salary > 10000;
```

```sql
-- Best option: get the actual plan from the cursor cache after execution
-- First execute the query, then find its SQL_ID
SELECT sql_id, sql_text
FROM   v$sql
WHERE  sql_text LIKE '%last_name%employees%'
AND    sql_text NOT LIKE '%v$sql%';

-- Then pull the plan with actual row counts
SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY_CURSOR('abc12345xyz', 0, 'ALLSTATS LAST')
);
```

### Reading the Plan Output

Key columns in a `DBMS_XPLAN` output:

| Column | Meaning |
|---|---|
| `Id` | Operation step number; child steps are indented |
| `Operation` | What Oracle is doing (TABLE ACCESS, INDEX RANGE SCAN, etc.) |
| `Name` | Object being accessed |
| `Rows` (E-Rows) | Estimated rows — optimizer's prediction |
| `A-Rows` | Actual rows returned (requires `ALLSTATS`) |
| `Bytes` | Estimated data volume |
| `Cost (%CPU)` | Optimizer cost estimate and CPU fraction |
| `Time` | Estimated wall-clock time |
| `Starts` | How many times this step was executed |

A large gap between E-Rows and A-Rows signals a cardinality estimation problem, which is the underlying cause of most bad plans.

### Common Access Paths

- **TABLE ACCESS FULL** — reads every block in the segment. Efficient for large-percentage retrievals; inefficient for selective queries.
- **INDEX RANGE SCAN** — traverses the B-tree index across a range of values. Well-suited for selective predicates.
- **INDEX UNIQUE SCAN** — single probe into a unique index. The most efficient way to access a single row.
- **INDEX FAST FULL SCAN** — reads all index blocks via multiblock I/O; useful for index-only queries.
- **INDEX SKIP SCAN** — used on composite indexes when the leading column is absent from the predicate. Usually a sign that a more targeted index is needed.

---

## Join Methods

Oracle supports three primary join algorithms. The optimizer selects based on cardinality, available indexes, and available memory.

### Nested Loops (NL)

Best when the driving rowset is small and the inner table has a usable index.

```
NESTED LOOPS
  TABLE ACCESS FULL   EMPLOYEES      (driving table, small result)
  INDEX RANGE SCAN    DEPT_ID_IDX    (inner lookup per driving row)
```

- Low memory requirement
- Scales poorly when the driving set is large
- Performance degrades linearly with driving row count

### Hash Join

Best for joining two large sets with no usable index on the join column. The smaller table is hashed into memory; the larger table is then probed against it.

```
HASH JOIN
  TABLE ACCESS FULL   DEPARTMENTS    (build side — smaller)
  TABLE ACCESS FULL   EMPLOYEES      (probe side — larger)
```

- Requires `PGA` memory for the hash table
- If the build side exceeds available PGA, it spills to temp (slow)
- Only applicable to equi-joins

### Sort Merge Join

Both inputs are sorted on the join key and then merged. Used when inputs arrive pre-sorted or when a hash join is not an option.

- Higher memory requirement than a hash join
- Can outperform a hash join when data is already sorted via an index

---

## Optimizer Hints

Hints are directives embedded in SQL comments that instruct the optimizer to adopt a specific plan element. Use them sparingly — fixing statistics or indexes should always come first.

### Syntax

```sql
SELECT /*+ HINT_NAME(parameter) */ col1 FROM table1;
```

### Commonly Used Hints

```sql
-- Force index use
SELECT /*+ INDEX(e EMP_DEPT_IDX) */ *
FROM   employees e
WHERE  department_id = 30;

-- Force full table scan (bypass an index)
SELECT /*+ FULL(e) */ *
FROM   employees e
WHERE  status = 'A';

-- Control join method
SELECT /*+ USE_NL(e d) */ e.last_name, d.department_name
FROM   employees e
JOIN   departments d ON e.department_id = d.department_id;

SELECT /*+ USE_HASH(e d) */ e.last_name, d.department_name
FROM   employees e
JOIN   departments d ON e.department_id = d.department_id;

-- Control join order (e is first/driving table)
SELECT /*+ LEADING(e d) USE_NL(d) */ e.last_name, d.department_name
FROM   employees e
JOIN   departments d ON e.department_id = d.department_id;

-- Parallel execution
SELECT /*+ PARALLEL(e, 4) */ COUNT(*) FROM employees e;

-- Disable parallel (useful in OLTP)
SELECT /*+ NO_PARALLEL(e) */ * FROM employees e;

-- Cardinality hint (when stats are wrong)
SELECT /*+ CARDINALITY(e 100) */ *
FROM   employees e
WHERE  complex_function(salary) > 5000;
```

### When NOT to Use Hints

- Hints are fragile — they break when table or index names change
- They prevent the optimizer from adapting to evolving data distributions
- Fixing the root cause is preferable: gather better statistics, add an index, or rewrite the query
- Use SQL profiles and baselines for production stabilization instead

---

## Gathering and Interpreting Statistics

Oracle's CBO depends on object statistics. Stale or missing statistics are the #1 cause of bad plans.

### Gathering Table and Index Statistics

```sql
-- Gather stats for a single table (with histograms on all columns)
EXEC DBMS_STATS.GATHER_TABLE_STATS(
  ownname          => 'HR',
  tabname          => 'EMPLOYEES',
  estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
  method_opt       => 'FOR ALL COLUMNS SIZE AUTO',
  cascade          => TRUE   -- also gathers index stats
);

-- Gather stats for an entire schema
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(
  ownname          => 'HR',
  estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
  method_opt       => 'FOR ALL COLUMNS SIZE AUTO',
  cascade          => TRUE
);
```

### Viewing Statistics

```sql
-- Table-level stats
SELECT table_name, num_rows, blocks, avg_row_len, last_analyzed
FROM   dba_tables
WHERE  owner = 'HR';

-- Column-level stats and histograms
SELECT column_name, num_distinct, num_nulls, histogram, num_buckets,
       low_value, high_value, last_analyzed
FROM   dba_tab_col_statistics
WHERE  owner = 'HR'
AND    table_name = 'EMPLOYEES';

-- Check for stale stats (more than 10% change since last analyze)
SELECT owner, table_name, stale_stats
FROM   dba_tab_statistics
WHERE  owner = 'HR'
AND    stale_stats = 'YES';
```

### Histograms

Histograms describe skewed column distributions and are essential for columns with non-uniform data.

```sql
-- Frequency histogram (for low-cardinality columns)
-- Oracle automatically creates these with SIZE AUTO when there are <= 254 distinct values

-- Viewing histogram buckets
SELECT endpoint_number, endpoint_value
FROM   dba_histograms
WHERE  owner = 'HR'
AND    table_name = 'EMPLOYEES'
AND    column_name = 'DEPARTMENT_ID'
ORDER BY endpoint_number;
```

### Extended Statistics (Multi-Column Correlations)

When columns are correlated (e.g., `city` and `state`), the optimizer may underestimate cardinality. Extended statistics resolve this.

```sql
-- Create extended stats on a column group
SELECT DBMS_STATS.CREATE_EXTENDED_STATS(
  ownname => 'HR',
  tabname => 'EMPLOYEES',
  extension => '(DEPARTMENT_ID, JOB_ID)'
) FROM dual;

-- Then re-gather stats to populate them
EXEC DBMS_STATS.GATHER_TABLE_STATS('HR', 'EMPLOYEES',
  method_opt => 'FOR ALL COLUMNS SIZE AUTO');
```

---

## Index Usage and Strategy

### Identifying Missing Indexes

```sql
-- Find full table scans on large tables from the cursor cache
SELECT s.sql_id, s.executions, p.object_name, p.operation, p.options,
       s.disk_reads / NULLIF(s.executions, 0) AS reads_per_exec
FROM   v$sql s
JOIN   v$sql_plan p ON s.sql_id = p.sql_id AND s.child_number = p.child_number
WHERE  p.operation = 'TABLE ACCESS'
AND    p.options   = 'FULL'
AND    p.object_name NOT IN ('DUAL')
ORDER BY reads_per_exec DESC NULLS LAST
FETCH FIRST 20 ROWS ONLY;
```

### Index Monitoring

```sql
-- Oracle 12.2+ — check index usage stats
SELECT index_name, table_name, monitoring, used, start_monitoring, end_monitoring
FROM   v$object_usage
WHERE  table_name = 'EMPLOYEES';

-- Start monitoring an index
ALTER INDEX hr.emp_name_idx MONITORING USAGE;
```

### Automatic Indexing (19c+)

Oracle 19c+ can automatically identify, create, validate, and retire indexes based on SQL workload analysis. See **`db/performance/index-strategy.md` — Automatic Indexing** for configuration (`DBMS_AUTO_INDEX`), monitoring views (`DBA_AUTO_INDEX_EXECUTIONS`, `DBA_AUTO_INDEX_IND_ACTIONS`), and guidance on when to use it versus manual indexing.

### Invisible Indexes

Test a new index without affecting production plans until it has been validated:

```sql
-- Create invisible (no plan impact yet)
CREATE INDEX emp_salary_idx ON employees(salary) INVISIBLE;

-- Test it in your session only
ALTER SESSION SET optimizer_use_invisible_indexes = TRUE;
EXPLAIN PLAN FOR SELECT * FROM employees WHERE salary BETWEEN 5000 AND 8000;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- Make visible when satisfied
ALTER INDEX emp_salary_idx VISIBLE;
```

---

## SQL Profiles and SQL Plan Baselines

### SQL Profiles

A SQL profile stores supplemental statistics or correction factors for a specific query, improving optimizer estimates without locking in a fixed plan.

```sql
-- Using SQL Tuning Advisor to generate a profile
DECLARE
  l_task_name VARCHAR2(30);
  l_sql_id    VARCHAR2(13) := 'abc12345xyz78';
BEGIN
  l_task_name := DBMS_SQLTUNE.CREATE_TUNING_TASK(
    sql_id      => l_sql_id,
    scope       => DBMS_SQLTUNE.SCOPE_COMPREHENSIVE,
    time_limit  => 60,
    task_name   => 'tune_task_1'
  );
  DBMS_SQLTUNE.EXECUTE_TUNING_TASK(task_name => l_task_name);
END;
/

-- Review recommendations
SELECT DBMS_SQLTUNE.REPORT_TUNING_TASK('tune_task_1') FROM dual;

-- Accept the SQL profile if recommended
EXEC DBMS_SQLTUNE.ACCEPT_SQL_PROFILE(
  task_name    => 'tune_task_1',
  replace      => TRUE
);
```

### SQL Plan Baselines (SPM)

SQL Plan Management (SPM) captures known-good plans and prevents plan regression.

```sql
-- Capture baseline from cursor cache for a specific SQL_ID
DECLARE
  l_count PLS_INTEGER;
BEGIN
  l_count := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(
    sql_id => 'abc12345xyz78'
  );
  DBMS_OUTPUT.PUT_LINE('Baselines loaded: ' || l_count);
END;
/

-- View existing baselines
SELECT sql_handle, plan_name, enabled, accepted, fixed, origin
FROM   dba_sql_plan_baselines
ORDER BY created DESC;

-- Evolve non-accepted plans (test and promote better plans)
DECLARE
  l_report CLOB;
BEGIN
  l_report := DBMS_SPM.EVOLVE_SQL_PLAN_BASELINE(
    sql_handle => 'SQL_abc123',
    time_limit => 30,
    verify     => 'YES',
    commit     => 'YES'
  );
  DBMS_OUTPUT.PUT_LINE(l_report);
END;
/
```

---

## Best Practices

- **Always compare actual vs. estimated rows.** A cardinality mismatch of 10x or more nearly always produces a suboptimal plan.
- **Gather statistics regularly on volatile tables.** Use a stats job or `DBMS_SCHEDULER` for nightly collection on high-DML tables.
- **Use `AUTO_SAMPLE_SIZE`.** It delivers near-100% accuracy via Oracle's incremental statistics algorithm at a fraction of the cost.
- **Avoid function calls on indexed columns in WHERE clauses.** Use function-based indexes when such predicates are necessary.
- **Parameterize queries.** Literal values prevent plan sharing and flood the shared pool with hard parses.
- **Validate plan changes before production.** Use invisible indexes and SPM baselines to test without risk.
- **Avoid `SELECT *`.** Retrieve only the required columns; wide projections block index-only access paths.

---

## Common Mistakes

| Mistake | Problem | Fix |
|---|---|---|
| Calling functions on indexed columns: `WHERE UPPER(name) = 'SMITH'` | Invalidates the index | Create a function-based index: `CREATE INDEX ... ON t(UPPER(name))` |
| Implicit type conversion: `WHERE emp_id = '100'` (emp_id is NUMBER) | Prevents index use | Match data types explicitly |
| Stale statistics after bulk loads | CBO uses wrong cardinality | Run `GATHER_TABLE_STATS` after large DML |
| Applying hints in application code | Brittle; breaks on rename | Use SQL profiles/baselines instead |
| Using `ROWNUM` before `ORDER BY` | Returns unordered rows then filters | Use `FETCH FIRST N ROWS ONLY` or subquery |
| Over-indexing | Slows DML; wastes space | Monitor index usage; drop unused indexes |
| Ignoring `TEMP` tablespace spills | Hash/sort spills degrade performance | Increase PGA or rewrite to reduce intermediate sets |

---

## Oracle-Specific Notes

- The `OPTIMIZER_ADAPTIVE_PLANS` parameter (default ON in 12c+) allows Oracle to switch join methods mid-execution based on actual row counts. This is helpful but can produce unexpected plan changes.
- `OPTIMIZER_STATISTICS_ADVISOR` (12.2+) runs automatically during the maintenance window and suggests statistics gathering changes.
- On Exadata, `CELL_OFFLOAD_PROCESSING` in the plan indicates Smart Scan is active — full scans on Exadata can be very fast thanks to storage cell processing.
- The `/*+ GATHER_PLAN_STATISTICS */` hint adds `A-Rows` and `A-Time` to any query without requiring autotrace — useful during application code testing.

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## See Also

- [Explain Plan — Execution Plan Analysis](../performance/explain-plan.md) — Reading and interpreting execution plans

## Sources

- [Oracle Database 19c SQL Tuning Guide (TGSQL)](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgsql/)
- [Oracle Database 19c SQL Language Reference (SQLRF)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/)
- [DBMS_XPLAN — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_XPLAN.html)
- [DBMS_SQLTUNE — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SQLTUNE.html)
- [DBMS_SPM — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SPM.html)
