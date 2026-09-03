# Dynamic Table Refresh Modes

This guide describes the three refresh modes available for Dynamic Tables: AUTO, INCREMENTAL, and FULL. A solid grasp of these modes is essential for tuning performance and controlling cost.

---

## Overview of Refresh Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **AUTO** | Snowflake chooses INCREMENTAL or FULL | Default - let Snowflake optimize |
| **INCREMENTAL** | Only process changed rows | Large tables with few changes |
| **FULL** | Recompute entire table | Small tables or unsupported queries |

---

## AUTO Mode (Default)

```sql
CREATE DYNAMIC TABLE my_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  REFRESH_MODE = AUTO  -- Default, doesn't need to be specified
AS
SELECT ...;
```

### How AUTO Works

When AUTO mode is used, Snowflake:

1. **Inspects your query** at creation time
2. **Decides whether incremental refresh is feasible** based on:
   - SQL constructs present
   - Operators and functions in use
   - Data characteristics
3. **Selects the best mode** (INCREMENTAL or FULL)
4. **Applies the same mode** to all subsequent refreshes

### When AUTO Chooses INCREMENTAL

Snowflake picks incremental when:
- The query relies only on incrementalizable operators
- No unsupported functions appear in the query
- Incremental processing is expected to be more cost-effective

### When AUTO Chooses FULL

Snowflake falls back to full when:
- The query includes unsupported constructs
- The query is straightforward enough that a full refresh is faster
- Source tables are small enough that the incremental overhead is not worthwhile

### Checking What AUTO Selected

```sql
-- See the refresh mode for existing dynamic tables
SHOW DYNAMIC TABLES;

-- The refresh_mode column shows: AUTO, INCREMENTAL, or FULL
-- The refresh_mode_reason column explains why (if not incremental)
```

---

## INCREMENTAL Mode

```sql
CREATE DYNAMIC TABLE my_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  REFRESH_MODE = INCREMENTAL
AS
SELECT ...;
```

### How Incremental Refresh Works

Rather than recomputing the entire table:

1. **Identify changes** in source tables since the last refresh
2. **Process only the affected rows** in the output
3. **Merge those changes** into the existing materialized data

### Example: Incremental vs Full

Source table contains 1 million rows. 100 new rows have been added.

**Full Refresh**:
- Scans all 1 million rows
- Runs transformations across all 1 million rows
- Replaces the entire Dynamic Table

**Incremental Refresh**:
- Detects the 100 new rows
- Runs transformations on only those 100 rows
- Merges the 100 new rows into the existing table

### Operators That Support Incremental

These SQL constructs are fully incrementalizable:

| Operator | Notes |
|----------|-------|
| SELECT | Basic column selection |
| WHERE | Filter conditions |
| JOIN (INNER, LEFT, RIGHT, OUTER) | Most join types |
| UNION ALL | Combining datasets |
| GROUP BY | Aggregations |
| Most aggregate functions | SUM, COUNT, AVG, MIN, MAX |
| CASE expressions | Conditional logic |
| Arithmetic operations | +, -, *, / |
| String functions | Most string operations |

### Operators That DON'T Support Incremental

These constructs force FULL refresh:

| Construct | Why |
|-----------|-----|
| UNION (without ALL) | Requires global deduplication |
| Non-deterministic functions | RANDOM(), UUID_STRING(), etc. |
| External functions | Can't track dependencies |
| Recursive CTEs | Complex dependency tracking |
| Certain window functions | Some partitioning patterns |
| QUALIFY with certain patterns | Depends on the specific pattern |
| CONNECT BY | Hierarchical queries |

### Forcing INCREMENTAL Mode

If you set `REFRESH_MODE = INCREMENTAL` but the query cannot be incrementalized:

```sql
-- This will FAIL at creation time
CREATE DYNAMIC TABLE my_dt
  REFRESH_MODE = INCREMENTAL
AS
SELECT *, RANDOM() as rand_col FROM source;  -- RANDOM is non-deterministic
```

Error: `Dynamic table definition is not incrementalizable`

---

## FULL Mode

```sql
CREATE DYNAMIC TABLE my_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  REFRESH_MODE = FULL
AS
SELECT ...;
```

### How Full Refresh Works

Every refresh:
1. **Runs the complete query** against source tables
2. **Materializes all results**
3. **Replaces the entire Dynamic Table**

### When to Use FULL Mode

1. **Small tables** where the overhead of incremental processing is not justified
2. **Non-incrementalizable queries** that rely on constructs not supported by incremental refresh
3. **Complete data replacement** scenarios

### Performance Characteristics

| Aspect | FULL | INCREMENTAL |
|--------|------|-------------|
| First refresh | Same | Same |
| Subsequent refreshes | Full scan every time | Only scans changes |
| Small source tables | Often faster | Overhead not worth it |
| Large source tables | Expensive | Much faster |
| Complex queries | May be only option | Limited construct support |

---

## Checking Refresh Mode at Runtime

### View Current Refresh Mode

```sql
-- See all dynamic tables and their refresh modes
SHOW DYNAMIC TABLES;
```

Key columns:
- `refresh_mode`: The configured mode (AUTO, INCREMENTAL, FULL)
- `refresh_mode_reason`: Explains why (especially if not incremental)

### Check Refresh History

```sql
-- See what mode was actually used for recent refreshes
SELECT
  name,
  refresh_action,  -- INCREMENTAL, FULL, or REINITIALIZE
  state,
  refresh_start_time
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MY_DYNAMIC_TABLE'
ORDER BY refresh_start_time DESC
LIMIT 10;
```

The `refresh_action` column indicates:
- `INCREMENTAL` - An incremental refresh was performed
- `FULL` - A full refresh was performed
- `REINITIALIZE` - The table was fully rebuilt (typically the first refresh)
- `NO_DATA` - No changes were found in the source

---

## Refresh Mode and Pipeline Design

### Pattern: Mixed Modes in a Pipeline

```sql
-- Stage 1: Complex cleaning (might need FULL)
CREATE DYNAMIC TABLE cleaned
  REFRESH_MODE = AUTO  -- Let Snowflake decide
  TARGET_LAG = DOWNSTREAM
AS
SELECT DISTINCT * FROM raw_data;  -- DISTINCT may force FULL

-- Stage 2: Simple aggregation (should be INCREMENTAL)
CREATE DYNAMIC TABLE aggregated
  REFRESH_MODE = AUTO  -- Will likely choose INCREMENTAL
  TARGET_LAG = '15 minutes'
AS
SELECT category, SUM(amount) FROM cleaned GROUP BY category;
```

### Important Constraint

**INCREMENTAL mode Dynamic Tables cannot sit downstream of FULL mode tables.**

```sql
-- This will FAIL
CREATE DYNAMIC TABLE upstream
  REFRESH_MODE = FULL
AS SELECT * FROM source;

CREATE DYNAMIC TABLE downstream
  REFRESH_MODE = INCREMENTAL  -- ERROR!
AS SELECT * FROM upstream;
```

The reason: incremental refresh depends on row-level change tracking. Full refresh replaces every row, which makes that tracking impossible.

---

## Optimizing for Incremental Refresh

### Tips for Incrementalizable Queries

1. **Avoid UNION** - Use UNION ALL instead
   ```sql
   -- Bad: Forces FULL
   SELECT * FROM a UNION SELECT * FROM b

   -- Good: Incrementalizable
   SELECT * FROM a UNION ALL SELECT * FROM b
   ```

2. **Avoid non-deterministic functions**
   ```sql
   -- Bad: Forces FULL
   SELECT *, RANDOM() as rand FROM source

   -- Good: Deterministic
   SELECT *, HASH(id) as hash_col FROM source
   ```

3. **Use supported window functions**
   ```sql
   -- Often incrementalizable
   SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts) as rn
   FROM source
   ```

4. **Keep joins simple**
   ```sql
   -- Good: Simple equi-join
   SELECT a.*, b.name
   FROM a JOIN b ON a.id = b.id
   ```

### Checking Incrementalizability

Before committing to `REFRESH_MODE = INCREMENTAL`, validate with AUTO first:

```sql
-- First, create with AUTO
CREATE DYNAMIC TABLE test_dt
  REFRESH_MODE = AUTO
AS SELECT ...;

-- Check what mode was chosen
SHOW DYNAMIC TABLES LIKE 'TEST_DT';

-- If refresh_mode_reason shows issues, adjust your query
```

---

## Common Questions

### Q: Can I change refresh mode after creation?

No. You need to recreate the Dynamic Table:

```sql
CREATE OR REPLACE DYNAMIC TABLE my_dt
  REFRESH_MODE = FULL  -- Changed from INCREMENTAL
AS SELECT ...;
```

### Q: Why does AUTO sometimes choose FULL for simple queries?

For very small source tables, a full refresh can complete faster than the overhead involved in incremental change tracking. Snowflake prioritizes speed over mode preference.

### Q: How do I know if my query is incrementalizable?

Create the table with `REFRESH_MODE = INCREMENTAL`. If the query does not support incremental refresh, creation will fail and return an explanatory error.

### Q: Does incremental refresh always consume less compute?

Generally yes for large tables where only a small fraction of rows change. However, for small tables or situations where most data changes, a full refresh may be more efficient.
