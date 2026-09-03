# Dynamic Tables Deep Dive

This document gives thorough coverage of Snowflake Dynamic Tables — what they are, how they operate, and when they are the right choice.

---

## What Are Dynamic Tables?

Dynamic Tables offer a declarative way to define data transformations in Snowflake. Traditional ETL pipelines require you to write code that:
1. Detects changes in source data
2. Transforms the data
3. Loads it into a target table
4. Schedules and monitors the process

Dynamic Tables let you simply declare: **"I want this query's results, kept fresh within X time."**

Snowflake takes care of all the underlying complexity:
- Change detection
- Incremental processing (when the query allows it)
- Scheduling refreshes
- Managing dependencies between tables

### The Core Concept

Think of a Dynamic Table as a **materialized query result that remains current**. You specify:
1. **What data you need** (the SELECT query)
2. **How fresh it must be** (TARGET_LAG)
3. **What compute to use** (WAREHOUSE)

Snowflake takes care of the rest.

---

## How Dynamic Tables Work Internally

### The Automated Refresh Process

When you create a Dynamic Table, Snowflake:

1. **Analyzes your query** to map dependencies and assess whether incremental refresh is possible
2. **Builds an initial snapshot** by executing the full query
3. **Watches source tables** for changes
4. **Schedules refreshes** according to TARGET_LAG to preserve freshness
5. **Runs refreshes** on the specified warehouse, favoring incremental mode whenever possible

### The Refresh Cycle

```
Source Data Changes → Change Detection → Refresh Scheduled → Refresh Executed → DT Updated
```

A refresh does not trigger immediately when source data changes. Instead, Snowflake accumulates changes and refreshes periodically to remain within TARGET_LAG.

### Snapshot Isolation

Dynamic Tables provide **snapshot isolation**. During a refresh:
- All source tables are read at a **single consistent point in time**
- Even if source tables are being modified during the refresh, the DT observes a consistent snapshot
- This avoids data inconsistencies across complex pipelines

For example, if DT_C reads from DT_A and DT_B:
```
DT_A ──┐
       ├──► DT_C (sees consistent snapshot of A and B)
DT_B ──┘
```

---

## Key Properties of Dynamic Tables

### TARGET_LAG

Controls how fresh the data should be. Options:
- **Time-based**: `'1 minute'`, `'5 minutes'`, `'1 hour'`, `'24 hours'`
- **DOWNSTREAM**: Refresh only when downstream tables need it

See `TARGET_LAG_GUIDE.md` for detailed guidance.

### WAREHOUSE

The virtual warehouse responsible for executing refresh operations. Key considerations:
- The warehouse must grant USAGE privilege
- Warehouse size directly influences refresh speed
- For large pipelines, consider using dedicated warehouses

### REFRESH_MODE

How the table is refreshed:
- **AUTO** (default): Snowflake chooses the best approach
- **INCREMENTAL**: Only process changed data
- **FULL**: Recompute the entire table

See `REFRESH_MODES.md` for detailed guidance.

### INITIALIZE

When the initial data population occurs:
- **ON_CREATE** (default): Populate immediately when created
- **ON_SCHEDULE**: Populate during the first scheduled refresh

---

## When to Use Dynamic Tables

### Ideal Use Cases

1. **Data Transformation Pipelines**
   - ETL/ELT workflows
   - Data warehouse dimensional modeling
   - Feature engineering for ML

2. **Aggregation and Summarization**
   - Tables backing dashboards
   - Pre-computed reports
   - Materialized KPIs

3. **Slowly Changing Dimensions (SCDs)**
   - Type 1 SCDs (overwrite)
   - Type 2 SCDs (historical tracking)

4. **Change Data Capture (CDC)**
   - A simpler alternative to Streams + Tasks
   - Automatic change propagation

5. **Data Freshness Requirements**
   - When data should be near real-time but does not need to be instant
   - When you require control over the maximum allowable staleness

### When NOT to Use Dynamic Tables

1. **Real-time requirements** (sub-second freshness)
   - Use Streams + Tasks or Snowpipe Streaming instead

2. **Simple one-off queries**
   - A regular VIEW is sufficient

3. **Exact schedule requirements**
   - When refreshes must occur at precise times (e.g., "every day at 2 AM")
   - Use Tasks with CRON schedules instead

4. **Complex procedural logic**
   - When the transformation involves loops, conditionals, or multi-step logic
   - Use Stored Procedures + Tasks instead

---

## Dynamic Tables vs Other Objects

### vs Regular Tables

| Aspect | Regular Table | Dynamic Table |
|--------|--------------|---------------|
| Data population | Manual INSERT/UPDATE | Automatic from query |
| Freshness | Point-in-time snapshot | Continuously refreshed |
| Maintenance | Manual | Automatic |

### vs Views

| Aspect | View | Dynamic Table |
|--------|------|---------------|
| Storage | No data stored | Data materialized |
| Query cost | Full query each time | Pre-computed |
| Freshness | Always current | Within TARGET_LAG |
| Complex queries | Can be slow | Pre-computed, fast |

### vs Materialized Views

| Aspect | Materialized View | Dynamic Table |
|--------|------------------|---------------|
| Refresh control | Background, no control | TARGET_LAG control |
| Incremental refresh | No | Yes (when possible) |
| Can chain | No (MV can't read MV) | Yes (DT can read DT) |
| Query restrictions | Many | Fewer |

### vs Streams + Tasks

| Aspect | Streams + Tasks | Dynamic Table |
|--------|----------------|---------------|
| Code complexity | High (MERGE logic) | Low (just SELECT) |
| Objects to manage | 3+ (stream, task, table) | 1 (dynamic table) |
| Scheduling | Explicit (CRON) | Automatic (TARGET_LAG) |
| Fine-grained control | More | Less |

---

## Chaining Dynamic Tables

Chaining Dynamic Tables is one of the feature's most powerful capabilities. Unlike Materialized Views, a Dynamic Table can reference other Dynamic Tables as its source.

### Example: Multi-Stage Pipeline

```sql
-- Stage 1: Clean raw data
CREATE DYNAMIC TABLE cleaned_data
  TARGET_LAG = DOWNSTREAM
  WAREHOUSE = ETL_WH
AS
SELECT * FROM raw_data WHERE is_valid = TRUE;

-- Stage 2: Aggregate
CREATE DYNAMIC TABLE daily_summary
  TARGET_LAG = DOWNSTREAM
  WAREHOUSE = ETL_WH
AS
SELECT date, SUM(amount) as total
FROM cleaned_data
GROUP BY date;

-- Stage 3: Final output (controls the pipeline)
CREATE DYNAMIC TABLE dashboard_data
  TARGET_LAG = '15 minutes'
  WAREHOUSE = ETL_WH
AS
SELECT * FROM daily_summary WHERE date >= CURRENT_DATE - 30;
```

In this pattern:
- `cleaned_data` and `daily_summary` use `DOWNSTREAM` — they refresh only when a downstream consumer requires it
- `dashboard_data` has a 15-minute lag — it drives the refresh schedule for the entire pipeline
- When `dashboard_data` refreshes, it automatically triggers upstream refreshes as necessary

### Dependency Management

Snowflake handles this automatically by:
- Tracking dependencies between Dynamic Tables
- Refreshing upstream tables before their downstream counterparts
- Maintaining snapshot isolation throughout the pipeline

---

## Immutability Constraints

For large tables where historical data is static, you can apply **immutability constraints** to boost performance:

```sql
CREATE DYNAMIC TABLE sales_history
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  IMMUTABLE WHERE (sale_date < CURRENT_DATE - 90)
AS
SELECT * FROM raw_sales;
```

The `IMMUTABLE WHERE` clause signals to Snowflake that rows satisfying the condition will never change. This enables:
- Skipping those rows during incremental refresh
- Substantial performance gains for large historical datasets

---

## Common Patterns

### Pattern 1: Bronze-Silver-Gold Pipeline

```
Raw Data → Bronze (cleaned) → Silver (transformed) → Gold (aggregated)
```

Each stage is a Dynamic Table; only the Gold layer carries a time-based TARGET_LAG.

### Pattern 2: Type 2 SCD

```sql
CREATE DYNAMIC TABLE customer_history
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  customer_id,
  name,
  email,
  updated_at AS valid_from,
  LEAD(updated_at) OVER (PARTITION BY customer_id ORDER BY updated_at) AS valid_to,
  CASE WHEN LEAD(updated_at) OVER (PARTITION BY customer_id ORDER BY updated_at) IS NULL
       THEN TRUE ELSE FALSE END AS is_current
FROM customer_changes;
```

### Pattern 3: Dashboard Backing Table

```sql
CREATE DYNAMIC TABLE dashboard_metrics
  TARGET_LAG = '5 minutes'
  WAREHOUSE = BI_WH
AS
SELECT
  DATE_TRUNC('hour', event_time) AS hour,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users,
  SUM(revenue) AS total_revenue
FROM events
WHERE event_time >= CURRENT_DATE - 7
GROUP BY 1;
```

---

## Limitations and Considerations

### Query Restrictions

Certain SQL constructs prevent incremental refresh:
- Some window functions
- Non-deterministic functions (RANDOM, UUID)
- External functions
- Recursive CTEs

When these constructs appear, Snowflake falls back to FULL refresh mode.

### Cost Considerations

Dynamic Tables generate costs from:
- **Warehouse compute**: Refresh executions
- **Storage**: Materialized data
- **Serverless compute**: Change tracking

Weigh TARGET_LAG against cost — a shorter lag produces more frequent refreshes.

### Ownership

- The role that creates the DT becomes its owner
- The owner's privileges are used when refreshes run
- Use GRANT OWNERSHIP to transfer ownership when needed

---

## Further Reading

- `TARGET_LAG_GUIDE.md` - Detailed guidance on TARGET_LAG
- `REFRESH_MODES.md` - Understanding refresh modes
- `PERFORMANCE_OPTIMIZATION.md` - Optimization techniques
- `MONITORING_REFERENCE.md` - Monitoring and troubleshooting
