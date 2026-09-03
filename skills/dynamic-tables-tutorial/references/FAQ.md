# Dynamic Tables FAQ

Common questions and answers about Snowflake Dynamic Tables.

---

## General Questions

### What is a Dynamic Table?

A Dynamic Table is a table whose contents are defined by a query and kept current based on a target freshness level (TARGET_LAG). Unlike regular tables that need manual INSERT/UPDATE statements, Dynamic Tables remain synchronized with their source data automatically.

### How is a Dynamic Table different from a View?

| View | Dynamic Table |
|------|---------------|
| No data stored | Data is materialized |
| Query runs every access | Query ran at refresh time |
| Always current | Fresh within TARGET_LAG |
| Can be slow for complex queries | Pre-computed, fast queries |

### How is a Dynamic Table different from a Materialized View?

| Materialized View | Dynamic Table |
|-------------------|---------------|
| Background refresh (no control) | TARGET_LAG controls freshness |
| No incremental refresh | Incremental refresh when possible |
| Cannot chain (MV can't read MV) | Can chain (DT can read DT) |
| More query restrictions | Fewer query restrictions |

### Can I query a Dynamic Table while it's refreshing?

Yes. Queries read the most recently completed refresh. The new refresh runs in the background and is made visible only once it finishes successfully.

---

## TARGET_LAG Questions

### What's the minimum TARGET_LAG I can set?

60 seconds (1 minute) is the minimum.

### Does TARGET_LAG guarantee exact refresh times?

No. TARGET_LAG is a maximum-staleness guarantee. Setting `TARGET_LAG = '5 minutes'` means data will never be more than 5 minutes stale, but it may be fresher. Snowflake schedules refreshes intelligently to remain within the target.

### What does TARGET_LAG = DOWNSTREAM mean?

It means "refresh only when a downstream Dynamic Table requires it." Use this setting for intermediate tables in a pipeline where only the final output needs time-based freshness.

### Can I have different TARGET_LAGs for different tables in a pipeline?

Yes, but each downstream table must have a TARGET_LAG >= that of its upstream tables. If TableA has `TARGET_LAG = '30 minutes'`, any table that reads from TableA must have a lag of at least 30 minutes.

---

## Refresh Questions

### What's the difference between INCREMENTAL and FULL refresh?

**INCREMENTAL**: Processes only the rows that changed since the previous refresh. Considerably faster for large tables with a low change rate.

**FULL**: Recomputes the entire table from scratch. Required when incremental processing is not possible or not efficient.

### How do I know which refresh mode my table uses?

```sql
SHOW DYNAMIC TABLES LIKE 'MY_TABLE';
-- Look at refresh_mode and refresh_mode_reason columns
```

### Can I force a manual refresh?

Yes:
```sql
ALTER DYNAMIC TABLE my_table REFRESH;
```

### What happens if a refresh fails?

The Dynamic Table continues to serve data from the last successful refresh. The failed attempt is recorded in DYNAMIC_TABLE_REFRESH_HISTORY. Depending on the type of failure, Snowflake may retry the refresh or suspend the table.

### Why is my table doing FULL refresh when I expected INCREMENTAL?

Inspect `refresh_mode_reason` in SHOW DYNAMIC TABLES. Typical reasons include:
- The query contains constructs that do not support incremental refresh
- An upstream table changed in a way that is incompatible with incremental mode
- Snowflake determined that FULL refresh is more efficient given the data volume

---

## Creation and Management

### How do I create a Dynamic Table?

```sql
CREATE DYNAMIC TABLE my_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
AS
SELECT ... FROM source_table;
```

### How do I change the TARGET_LAG after creation?

```sql
ALTER DYNAMIC TABLE my_dt SET TARGET_LAG = '30 minutes';
```

### How do I change the REFRESH_MODE after creation?

REFRESH_MODE cannot be changed with ALTER. The table must be recreated:
```sql
CREATE OR REPLACE DYNAMIC TABLE my_dt
  REFRESH_MODE = FULL
  ...;
```

### How do I suspend/resume a Dynamic Table?

```sql
-- Suspend (stop automatic refreshes)
ALTER DYNAMIC TABLE my_dt SUSPEND;

-- Resume (restart automatic refreshes)
ALTER DYNAMIC TABLE my_dt RESUME;
```

### How do I drop a Dynamic Table?

```sql
DROP DYNAMIC TABLE my_dt;
```

---

## Pipeline Questions

### Can a Dynamic Table read from another Dynamic Table?

Yes. This is a significant advantage over Materialized Views. Dynamic Tables can be chained together to build multi-stage pipelines.

### What happens to downstream tables if an upstream table fails?

Downstream tables enter the `UPSTREAM_FAILED` state and will not refresh until the upstream issue is resolved.

### How do I see the dependencies between Dynamic Tables?

```sql
SELECT
  qualified_name,
  ARRAY_TO_STRING(direct_dependencies, ', ') AS upstream_tables
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_GRAPH_HISTORY())
WHERE valid_to IS NULL;
```

---

## Performance Questions

### How do I make my Dynamic Table refresh faster?

1. Use a larger warehouse
2. Ensure queries are structured to support incremental refresh
3. Add clustering on columns that are frequently filtered
4. Apply IMMUTABLE WHERE to historical data
5. Push filters early in the query to minimize data scanned

### Does TARGET_LAG affect cost?

Yes. A shorter TARGET_LAG means more frequent refreshes, which increases compute cost. Select the longest lag that still satisfies your freshness requirements.

### How do I see how long refreshes take?

```sql
SELECT
  name,
  DATEDIFF('second', refresh_start_time, refresh_end_time) AS duration_sec,
  refresh_start_time
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MY_TABLE'
ORDER BY refresh_start_time DESC;
```

---

## Permissions Questions

### What privileges do I need to create a Dynamic Table?

- CREATE DYNAMIC TABLE on the schema
- USAGE on the warehouse
- SELECT on all source tables and views

### Who executes the refresh queries?

The role that owns the Dynamic Table. The owner's privileges are applied during each refresh.

### How do I transfer ownership of a Dynamic Table?

```sql
GRANT OWNERSHIP ON DYNAMIC TABLE my_dt TO ROLE new_owner;
```

---

## Troubleshooting Questions

### My Dynamic Table has no data. Why?

1. The source table may be empty
2. The WHERE clause may be filtering out all rows
3. The initial refresh may not have finished yet
4. Check DYNAMIC_TABLE_REFRESH_HISTORY for failures

### Why am I getting "Object does not exist" errors?

The source table was dropped, or SELECT privileges were revoked. Verify that all source objects exist and that you still have access.

### My Dynamic Table is suspended. How do I fix it?

```sql
-- Check why it's suspended
SHOW DYNAMIC TABLES LIKE 'MY_TABLE';

-- Resume it
ALTER DYNAMIC TABLE my_table RESUME;
```

If there is an underlying issue (failed refreshes, upstream problems), resolve that before resuming.

### How do I debug a failing refresh?

1. Review the error in DYNAMIC_TABLE_REFRESH_HISTORY
2. Retrieve the query_id from the failed refresh
3. Locate the query in Query History
4. Use Query Profile to pinpoint the problem

---

## Comparison Questions

### When should I use Streams + Tasks instead of Dynamic Tables?

Use Streams + Tasks when:
- Exact schedule control is required (CRON)
- Complex procedural logic is involved
- Multiple consumers need to read from the same change stream
- Change history must be preserved

### When should I use a regular View instead?

Use a View when:
- Data must always reflect the current state (100% fresh)
- The query is simple and executes quickly
- Storage cost is a concern
- Pre-computed results are not needed

### Can I use Dynamic Tables with external tables?

Yes, Dynamic Tables can read from external tables. The refresh re-scans the external storage according to the TARGET_LAG setting.

---

## Quick Reference

### Essential Commands

```sql
-- Create
CREATE DYNAMIC TABLE dt TARGET_LAG='1h' WAREHOUSE=wh AS SELECT...;

-- View
SHOW DYNAMIC TABLES;

-- Modify lag
ALTER DYNAMIC TABLE dt SET TARGET_LAG = '30m';

-- Manual refresh
ALTER DYNAMIC TABLE dt REFRESH;

-- Suspend/Resume
ALTER DYNAMIC TABLE dt SUSPEND;
ALTER DYNAMIC TABLE dt RESUME;

-- Drop
DROP DYNAMIC TABLE dt;

-- Check history
SELECT * FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY());
```

---

## Getting the Latest Documentation

### Official Snowflake Documentation

The most current information is always available in the official Snowflake documentation:

| Topic | URL |
|-------|-----|
| Dynamic Tables Overview | https://docs.snowflake.com/en/user-guide/dynamic-tables-about |
| CREATE DYNAMIC TABLE | https://docs.snowflake.com/en/sql-reference/sql/create-dynamic-table |
| ALTER DYNAMIC TABLE | https://docs.snowflake.com/en/sql-reference/sql/alter-dynamic-table |
| Dynamic Table Refresh | https://docs.snowflake.com/en/user-guide/dynamic-tables-refresh |
| Monitoring Dynamic Tables | https://docs.snowflake.com/en/user-guide/dynamic-tables-monitor |
| Dynamic Table Tasks & Graphs | https://docs.snowflake.com/en/user-guide/dynamic-tables-tasks-graphs |

### How to Fetch Latest Docs in Cortex Code

Request the agent to retrieve the latest documentation:

```
"Fetch the latest docs for Dynamic Tables from Snowflake"
"What's new with Dynamic Tables?"
"Get the current documentation for TARGET_LAG"
```

The agent can use `web_fetch` to pull the most current information directly from Snowflake's documentation site.

### Release Notes

Check for new features and changes:

| Resource | URL |
|----------|-----|
| Snowflake Release Notes | https://docs.snowflake.com/en/release-notes |
| Data Engineering Features | https://docs.snowflake.com/en/release-notes/new-features#data-engineering |
| BCR (Behavior Change) Bundles | https://docs.snowflake.com/en/release-notes/bcr-bundles |

### SNOWFLAKE_LEARNING Environment

For the learning environment used in this tutorial:

| Resource | URL |
|----------|-----|
| Learning Environment (BCR-1992) | https://docs.snowflake.com/en/release-notes/bcr-bundles/un-bundled/bcr-1992 |
| Snowsight Templates | https://docs.snowflake.com/en/user-guide/ui-snowsight/snowsight-templates |

### Related Documentation

| Topic | URL |
|-------|-----|
| Streams | https://docs.snowflake.com/en/user-guide/streams |
| Tasks | https://docs.snowflake.com/en/user-guide/tasks |
| Materialized Views | https://docs.snowflake.com/en/user-guide/views-materialized |
| Data Pipelines | https://docs.snowflake.com/en/user-guide/data-pipelines |

### Staying Current

1. **Bookmark the docs**: Save the Dynamic Tables overview page for easy access
2. **Check release notes**: Review monthly to catch new features
3. **Ask in Cortex Code**: The agent can retrieve the latest docs on demand
4. **Snowflake Community**: https://community.snowflake.com for discussions and tips
