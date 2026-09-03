# Dynamic Tables Troubleshooting Guide

This guide assists in diagnosing and resolving the most common Dynamic Table issues.

---

## Refresh Failures

### Symptom: Refresh State is FAILED

**How to detect**:
```sql
SELECT name, state, state_code, state_message, query_id
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE state = 'FAILED'
ORDER BY refresh_start_time DESC
LIMIT 10;
```

**Common causes and remedies**:

#### Cause 1: Warehouse Suspended or Doesn't Exist

```
Error: Warehouse 'COMPUTE_WH' does not exist or not authorized
```

**Solution**:
```sql
-- Check warehouse exists
SHOW WAREHOUSES LIKE 'COMPUTE_WH';

-- If suspended, resume it
ALTER WAREHOUSE COMPUTE_WH RESUME;

-- Or change the DT to use a different warehouse
ALTER DYNAMIC TABLE my_dt SET WAREHOUSE = ANOTHER_WH;
```

#### Cause 2: Insufficient Privileges

```
Error: SQL access control error: Insufficient privileges
```

**Solution**:
```sql
-- Grant necessary privileges
GRANT USAGE ON WAREHOUSE compute_wh TO ROLE my_role;
GRANT SELECT ON TABLE source_table TO ROLE my_role;

-- Check ownership
SHOW DYNAMIC TABLES LIKE 'MY_DT';
-- The owner role must have access to all source objects
```

#### Cause 3: Source Object Altered or Dropped

```
Error: Object 'SOURCE_TABLE' does not exist or not authorized
```

**Solution**:
```sql
-- Check if source table exists
SHOW TABLES LIKE 'SOURCE_TABLE';

-- If the table was recreated, you will likely need to recreate the DT as well
CREATE OR REPLACE DYNAMIC TABLE my_dt ...;
```

#### Cause 4: Query Timeout

```
Error: Statement reached its statement or warehouse timeout
```

**Solution**:
```sql
-- Increase warehouse timeout
ALTER WAREHOUSE compute_wh SET STATEMENT_TIMEOUT_IN_SECONDS = 7200;

-- Or use a larger warehouse
ALTER DYNAMIC TABLE my_dt SET WAREHOUSE = LARGER_WH;

-- Or optimize the query (see Performance guide)
```

---

## Refresh State: UPSTREAM_FAILED

### What It Means

The Dynamic Table's refresh was skipped because an upstream Dynamic Table did not complete its own refresh successfully.

**How to detect**:
```sql
SELECT name, state, state_message
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE state = 'UPSTREAM_FAILED'
ORDER BY refresh_start_time DESC;
```

**Solution**:
1. Find the failed upstream table referenced in `state_message`
2. Determine why that table's refresh failed
3. Resolve the upstream issue
4. Trigger a manual refresh if needed:
   ```sql
   ALTER DYNAMIC TABLE failed_upstream_dt REFRESH;
   ```

---

## Refresh State: CANCELLED

### Common Causes

1. **Manual cancellation** - A user cancelled the query
2. **Warehouse suspension** - The warehouse went down during the refresh
3. **System maintenance** - Uncommon, but it can occur

**How to investigate**:
```sql
SELECT name, state, state_code, state_message, query_id
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE state = 'CANCELLED'
ORDER BY refresh_start_time DESC;
```

Use the `query_id` to look up additional details in query history.

---

## Dynamic Table Suspended

### Symptom: No Refreshes Occurring

**Check if DT is suspended**:
```sql
SHOW DYNAMIC TABLES LIKE 'MY_DT';
-- Look at the 'scheduling_state' column
```

**Possible scheduling states**:
- `RUNNING` - Operating normally
- `SUSPENDED` - Manually paused
- `UPSTREAM_SUSPENDED` - A dependency is suspended

### What Triggers Automatic Suspension

A Dynamic Table may be auto-suspended when:
1. Several consecutive refresh failures occur
2. Upstream table changes invalidate the DT's definition
3. The DT is cloned (clones begin in a suspended state)

### Solution: Resume the Dynamic Table

```sql
-- Resume a manually suspended DT
ALTER DYNAMIC TABLE my_dt RESUME;

-- If upstream is suspended, resume that first
ALTER DYNAMIC TABLE upstream_dt RESUME;
```

---

## Data Issues

### Issue: Dynamic Table Has No Data

**Check**:
```sql
SELECT COUNT(*) FROM my_dynamic_table;
-- Returns 0
```

**Likely causes**:

1. **Source table is empty**:
   ```sql
   SELECT COUNT(*) FROM source_table;
   ```

2. **WHERE clause excludes all rows**:
   ```sql
   -- Check whether the filter is too restrictive
   SELECT COUNT(*) FROM source_table WHERE <your_filter>;
   ```

3. **Initial refresh has not finished**:
   ```sql
   -- Check refresh history
   SELECT state, refresh_start_time
   FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
   WHERE name = 'MY_DYNAMIC_TABLE'
   ORDER BY refresh_start_time DESC
   LIMIT 5;
   ```

### Issue: Data Doesn't Match Expected Results

**Diagnostic steps**:

1. **Review refresh mode and lag settings**:
   ```sql
   SHOW DYNAMIC TABLES LIKE 'MY_DT';
   ```

2. **Validate source data**:
   ```sql
   -- Execute the DT's query directly against the source
   SELECT ... FROM source_table ...;
   -- Compare the output with the DT contents
   ```

3. **Examine the data timestamp**:
   ```sql
   -- Determine when the data was last captured
   SELECT data_timestamp
   FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
   WHERE name = 'MY_DT'
   ORDER BY refresh_start_time DESC
   LIMIT 1;
   ```

4. **Trigger a manual refresh**:
   ```sql
   ALTER DYNAMIC TABLE my_dt REFRESH;
   ```

---

## Performance Issues

### Issue: Refreshes Taking Too Long

**Diagnose**:
```sql
-- Check refresh duration
SELECT
  name,
  refresh_action,
  DATEDIFF('minute', refresh_start_time, refresh_end_time) AS duration_minutes
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MY_DT'
ORDER BY refresh_start_time DESC
LIMIT 10;
```

**Remedies**:
1. Switch to a larger warehouse
2. Optimize the query (refer to the Performance guide)
3. Confirm whether FULL refresh is occurring when you expected INCREMENTAL
4. Introduce clustering if the data layout is poor

### Issue: Unexpected FULL Refresh Instead of INCREMENTAL

**Investigate the cause**:
```sql
SHOW DYNAMIC TABLES LIKE 'MY_DT';
-- Look at refresh_mode_reason column
```

**Typical reasons**:
- An upstream view definition was changed
- The query contains constructs that cannot be incrementalized
- Snowflake determined that FULL refresh is more efficient

---

## Error: "Dynamic table can no longer be refreshed incrementally"

### What It Means

The Dynamic Table was originally created to support incremental refresh, but a subsequent change has made incremental refresh no longer viable.

### Common Causes

1. **An upstream view definition was changed**
2. **The source table was recreated**
3. **Permissions on source objects were modified**

### Solution

Recreate the Dynamic Table:
```sql
CREATE OR REPLACE DYNAMIC TABLE my_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
AS
SELECT ... ;  -- Same query
```

---

## Error: "Target lag must be greater than or equal to upstream"

### What It Means

You are attempting to create a Dynamic Table with a shorter lag than one or more of its upstream dependencies.

### Example

```sql
-- Upstream has 30-minute lag
CREATE DYNAMIC TABLE upstream TARGET_LAG = '30 minutes' ...;

-- This will FAIL
CREATE DYNAMIC TABLE downstream TARGET_LAG = '10 minutes'
AS SELECT * FROM upstream;
-- Error: Target lag must be >= 30 minutes
```

### Solution

Choose one of the following:
1. Increase the downstream TARGET_LAG
2. Decrease the upstream TARGET_LAG
3. Switch the upstream table to DOWNSTREAM

```sql
-- Option 1: Increase downstream lag
CREATE DYNAMIC TABLE downstream TARGET_LAG = '30 minutes' ...;

-- Option 2: Make upstream DOWNSTREAM and control from final table
ALTER DYNAMIC TABLE upstream SET TARGET_LAG = DOWNSTREAM;
CREATE DYNAMIC TABLE downstream TARGET_LAG = '10 minutes' ...;
```

---

## Error: "Object does not exist or not authorized"

### During Creation

The source table or view does not exist, or the current role lacks SELECT privileges.

```sql
-- Check object exists
SHOW TABLES LIKE 'SOURCE_TABLE';

-- Grant privileges if needed
GRANT SELECT ON TABLE source_table TO ROLE my_role;
```

### During Refresh

The source object was present at creation time but has since been dropped, or access was revoked.

```sql
-- Recreate the DT once the source has been restored
CREATE OR REPLACE DYNAMIC TABLE my_dt ...;
```

---

## Checking DT Health

### Comprehensive Health Check Query

```sql
WITH dt_info AS (
  SELECT
    database_name || '.' || schema_name || '.' || name AS full_name,
    name,
    scheduling_state,
    target_lag,
    refresh_mode,
    warehouse
  FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))
),
refresh_stats AS (
  SELECT
    name,
    COUNT(*) AS total_refreshes,
    SUM(CASE WHEN state = 'SUCCEEDED' THEN 1 ELSE 0 END) AS successful,
    SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END) AS failed,
    AVG(DATEDIFF('second', refresh_start_time, refresh_end_time)) AS avg_duration_seconds
  FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
  WHERE refresh_start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
  GROUP BY name
)
SELECT
  dt.full_name,
  dt.scheduling_state,
  dt.target_lag,
  dt.refresh_mode,
  COALESCE(rs.total_refreshes, 0) AS refreshes_7d,
  COALESCE(rs.successful, 0) AS successful_7d,
  COALESCE(rs.failed, 0) AS failed_7d,
  ROUND(rs.avg_duration_seconds, 1) AS avg_duration_sec
FROM dt_info dt
LEFT JOIN refresh_stats rs ON dt.name = rs.name
ORDER BY dt.full_name;
```

First run: `SHOW DYNAMIC TABLES;`

---

## Getting Help

If you are unable to resolve an issue:

1. **Collect diagnostics**:
   - SHOW DYNAMIC TABLES output
   - DYNAMIC_TABLE_REFRESH_HISTORY for the affected DT
   - Query ID from the failed refresh
   - Full error messages

2. **Review Query Profile**:
   - Retrieve the query_id from refresh history
   - Identify bottlenecks in the Query Profile

3. **Contact Support**:
   - Share all collected diagnostics
   - Include the DT definition (the full CREATE statement)
