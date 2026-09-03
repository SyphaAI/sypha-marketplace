# Dynamic Tables Performance Optimization

This guide covers best practices for boosting Dynamic Table performance, reducing costs, and keeping refresh operations dependable.

---

## Performance Fundamentals

### What Affects Refresh Performance?

1. **Query complexity** - Joins, aggregations, and functions in use
2. **Data volume** - Source table size and the rate of change
3. **Refresh mode** - INCREMENTAL vs FULL
4. **Warehouse size** - Available compute resources
5. **Data organization** - Clustering and micro-partition layout

### The Performance Equation

```
Refresh Time = Data Scanned / Warehouse Throughput + Processing Overhead
```

Optimization approaches fall into three categories:
- Minimize data scanned (through incremental refresh, filtering, or clustering)
- Raise throughput (by scaling up to a larger warehouse)
- Cut overhead (by writing simpler queries)

---

## Query Optimization

### Keep Queries Simple

**Avoid over-engineering**. The simplest query that produces correct results is typically the most efficient.

```sql
-- Overly complex (harder to optimize)
CREATE DYNAMIC TABLE my_dt AS
SELECT
  COALESCE(NULLIF(TRIM(name), ''), 'Unknown') AS name,
  CASE WHEN amount > 0 THEN amount ELSE 0 END AS amount,
  ...
FROM source;

-- Simpler (easier to optimize)
CREATE DYNAMIC TABLE my_dt AS
SELECT name, amount FROM source WHERE amount > 0;
```

### Optimize Joins

Joins carry significant cost. Use these techniques to limit their impact:

1. **Filter early** - Apply WHERE conditions before the JOIN
   ```sql
   -- Better: Filter before join
   SELECT a.*, b.name
   FROM (SELECT * FROM table_a WHERE active = TRUE) a
   JOIN table_b b ON a.id = b.id;
   ```

2. **Choose the right join type** - Avoid OUTER joins when INNER is sufficient
   ```sql
   -- Only use LEFT JOIN if you need unmatched rows
   SELECT a.*, b.name
   FROM a
   INNER JOIN b ON a.id = b.id;  -- Not LEFT if you don't need nulls
   ```

3. **Join on clustered columns** - Where practical, join on columns included in the clustering key

### Optimize Aggregations

1. **Pre-filter before aggregating**
   ```sql
   -- Good: Filter first
   SELECT category, SUM(amount)
   FROM source
   WHERE date >= '2024-01-01'  -- Reduces data before aggregation
   GROUP BY category;
   ```

2. **Avoid unnecessary precision**
   ```sql
   -- Excessive precision
   SELECT AVG(amount) AS avg_amt  -- Returns many decimal places

   -- Better
   SELECT ROUND(AVG(amount), 2) AS avg_amt
   ```

### Use Supported Constructs for Incremental

To keep incremental refresh enabled, steer clear of these constructs:
- `UNION` (use `UNION ALL` instead)
- Non-deterministic functions (`RANDOM()`, `UUID_STRING()`)
- Complex recursive CTEs
- Certain window function patterns

Refer to `REFRESH_MODES.md` for the full list.

---

## Warehouse Sizing

### Choosing the Right Size

| Source Data Size | Recommended Start | Notes |
|------------------|-------------------|-------|
| < 1 GB | X-Small | Minimal data, simple queries |
| 1 - 10 GB | Small | Moderate data |
| 10 - 100 GB | Medium | Larger datasets |
| 100 GB - 1 TB | Large | Significant data |
| > 1 TB | X-Large+ | Very large datasets |

**Begin with a smaller size and scale up** based on actual refresh duration observed.

### Monitoring Warehouse Utilization

```sql
-- Check warehouse load during refreshes
SELECT
  query_id,
  warehouse_name,
  warehouse_size,
  execution_time / 1000 AS seconds,
  bytes_scanned / 1e9 AS gb_scanned,
  rows_produced
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE query_tag LIKE 'DYNAMIC_TABLE_REFRESH%'
  AND start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY execution_time DESC
LIMIT 20;
```

### Dedicated Refresh Warehouse

For critical pipelines, set up a dedicated warehouse:

```sql
-- Create dedicated warehouse
CREATE WAREHOUSE dt_refresh_wh
  WAREHOUSE_SIZE = 'MEDIUM'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE;

-- Use for dynamic tables
CREATE DYNAMIC TABLE my_dt
  WAREHOUSE = dt_refresh_wh
  ...;
```

Benefits:
- Refresh workloads are separated from user queries
- More consistent and predictable performance
- Easier cost attribution

---

## Clustering

### When to Use Clustering

Clustering provides performance benefits when:
- Source tables are large (> 1 TB)
- Queries regularly filter on specific columns
- Data has a natural time-series or categorical structure

### Adding Clustering to Dynamic Tables

```sql
CREATE OR REPLACE DYNAMIC TABLE my_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  CLUSTER BY (date_column, category)  -- Cluster by frequently filtered columns
AS
SELECT ...;
```

### Clustering Best Practices

1. **Cluster by filter columns** - Use columns that appear in WHERE clauses
2. **Limit to 3-4 columns** - Beyond that, returns diminish quickly
3. **Order by cardinality** - Put lower-cardinality columns first
4. **Monitor automatic clustering**:
   ```sql
   SELECT *
   FROM TABLE(INFORMATION_SCHEMA.AUTOMATIC_CLUSTERING_HISTORY(
     TABLE_NAME => 'MY_DT'
   ));
   ```

---

## Immutability Constraints

For tables where historical data never changes, apply immutability constraints:

```sql
CREATE DYNAMIC TABLE sales_analysis
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  IMMUTABLE WHERE (sale_date < CURRENT_DATE - 90)
AS
SELECT * FROM sales;
```

### Benefits

- Rows that satisfy the IMMUTABLE condition are **never re-scanned**
- Meaningfully shortens refresh time for large historical tables
- Ideal for time-series data that has a static historical portion

### When to Use

- Time-series data where past records are immutable
- Tables with a well-defined cutoff between "frozen" and "active" data
- Large tables in which most rows belong to the historical portion

---

## Pipeline Architecture

### Break Down Complex Pipelines

Instead of one monolithic Dynamic Table, split the logic across multiple pipeline stages:

```sql
-- BAD: One huge DT with everything
CREATE DYNAMIC TABLE final_output AS
SELECT /* complex transformations */ FROM raw_data;

-- BETTER: Multiple stages
CREATE DYNAMIC TABLE stage1_clean TARGET_LAG = DOWNSTREAM AS
SELECT * FROM raw_data WHERE is_valid = TRUE;

CREATE DYNAMIC TABLE stage2_transform TARGET_LAG = DOWNSTREAM AS
SELECT /* transformations */ FROM stage1_clean;

CREATE DYNAMIC TABLE stage3_aggregate TARGET_LAG = '15 minutes' AS
SELECT /* aggregations */ FROM stage2_transform;
```

### Benefits of Staged Pipelines

1. **Easier debugging** - Narrow down failures to a specific stage quickly
2. **Better incremental refresh** - Each stage can be tuned on its own
3. **Reusability** - Intermediate stages can serve multiple downstream consumers
4. **Isolation** - A failure in one stage does not ripple into others

### Use DOWNSTREAM for Intermediate Tables

Only the final consumer table needs a time-based TARGET_LAG:

```sql
-- Intermediate stages
CREATE DYNAMIC TABLE stage1 TARGET_LAG = DOWNSTREAM ...;
CREATE DYNAMIC TABLE stage2 TARGET_LAG = DOWNSTREAM ...;

-- Final stage controls the schedule
CREATE DYNAMIC TABLE final TARGET_LAG = '15 minutes' ...;
```

---

## Monitoring and Tuning

### Regular Performance Reviews

Run this on a weekly basis:

```sql
-- Top 10 slowest refreshes
SELECT
  name,
  refresh_action,
  DATEDIFF('second', refresh_start_time, refresh_end_time) AS duration_sec,
  refresh_start_time
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE state = 'SUCCEEDED'
  AND refresh_start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY duration_sec DESC
LIMIT 10;
```

### Identify Full Refreshes That Should Be Incremental

```sql
-- Find DTs doing FULL refresh
SELECT name, refresh_action, COUNT(*) as count
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE refresh_start_time > DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY name, refresh_action
HAVING refresh_action = 'FULL'
ORDER BY count DESC;
```

If a table is using FULL refreshes when you expect INCREMENTAL, check the `refresh_mode_reason` field in SHOW DYNAMIC TABLES.

### Cost Tracking

```sql
-- Estimate refresh costs by DT
SELECT
  name,
  COUNT(*) AS refresh_count,
  SUM(DATEDIFF('second', refresh_start_time, refresh_end_time)) / 3600.0 AS total_hours
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE state = 'SUCCEEDED'
  AND refresh_start_time > DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY name
ORDER BY total_hours DESC
LIMIT 20;
```

---

## Common Performance Antipatterns

### Antipattern 1: SELECT *

```sql
-- Bad
CREATE DYNAMIC TABLE dt AS SELECT * FROM source;

-- Good: Only select needed columns
CREATE DYNAMIC TABLE dt AS SELECT id, name, amount FROM source;
```

### Antipattern 2: Unnecessary Sorting

```sql
-- Bad: ORDER BY in DT definition (sorted during refresh, not query)
CREATE DYNAMIC TABLE dt AS
SELECT * FROM source ORDER BY date DESC;

-- Good: Sort at query time if needed
CREATE DYNAMIC TABLE dt AS SELECT * FROM source;
-- Then: SELECT * FROM dt ORDER BY date DESC;
```

### Antipattern 3: Over-Aggressive TARGET_LAG

```sql
-- Bad: 1-minute lag for data used weekly
CREATE DYNAMIC TABLE weekly_report
  TARGET_LAG = '1 minute'
AS SELECT ...;

-- Good: Match lag to actual requirements
CREATE DYNAMIC TABLE weekly_report
  TARGET_LAG = '4 hours'
AS SELECT ...;
```

### Antipattern 4: Missing Filters

```sql
-- Bad: Processing all historical data every refresh
CREATE DYNAMIC TABLE dt AS SELECT * FROM events;

-- Good: Filter to relevant window
CREATE DYNAMIC TABLE dt AS
SELECT * FROM events WHERE event_time >= DATEADD('day', -30, CURRENT_DATE);
```

---

## Quick Wins Checklist

- [ ] Turn on INCREMENTAL refresh mode wherever feasible
- [ ] Pick a TARGET_LAG that reflects your true freshness needs (do not set it unnecessarily short)
- [ ] Assign DOWNSTREAM to all intermediate tables
- [ ] Pull only the columns your pipeline actually uses
- [ ] Apply filters early in the query to limit how much data is scanned
- [ ] Consider clustering for large source tables
- [ ] Apply immutability constraints when historical data is static
- [ ] Break complex queries into multiple pipeline stages
- [ ] Match warehouse size to the actual workload
- [ ] Periodically review trends in refresh duration
