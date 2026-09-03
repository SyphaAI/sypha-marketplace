# TARGET_LAG Complete Guide

TARGET_LAG is the most significant parameter for Dynamic Tables. It governs data freshness, how often refreshes occur, and ultimately the cost incurred. This guide walks through everything you need to know.

---

## What is TARGET_LAG?

TARGET_LAG defines the **maximum tolerable staleness** of your Dynamic Table's data relative to its source tables.

When you set `TARGET_LAG = '5 minutes'`:
- Data in the Dynamic Table will never lag more than 5 minutes behind the source
- Snowflake schedules refreshes to uphold this freshness guarantee
- The actual lag may be shorter than 5 minutes, but will never exceed it

---

## TARGET_LAG Options

### Time-Based Lag

Specify how fresh the data must be:

```sql
TARGET_LAG = '60 seconds'    -- Minimum allowed
TARGET_LAG = '5 minutes'     -- Near real-time dashboards
TARGET_LAG = '1 hour'        -- Hourly reporting
TARGET_LAG = '24 hours'      -- Daily batch processing
TARGET_LAG = '7 days'        -- Weekly summaries
```

**Valid units**: `seconds`, `minutes`, `hours`, `days`

**Minimum value**: 60 seconds (1 minute)

### DOWNSTREAM Lag

```sql
TARGET_LAG = DOWNSTREAM
```

This special value instructs Snowflake to refresh the table only when a downstream Dynamic Table requires updated data.

Use DOWNSTREAM for intermediate tables in a pipeline where only the final output needs a time-based freshness guarantee.

---

## How TARGET_LAG Affects Refresh Scheduling

Snowflake does not refresh on exact TARGET_LAG intervals. Instead, it relies on a **smart scheduling algorithm**:

### Example: 4-hour TARGET_LAG

With `TARGET_LAG = '4 hours'`, Snowflake may:
- Refresh every 3.5 hours
- Or every 2 hours during periods of heavy activity
- Or less often when no source changes are detected

The aim is to **guarantee** the lag never surpasses 4 hours — not to fire a refresh exactly every 4 hours.

### Factors That Influence Scheduling

1. **Source data changes**: A higher rate of changes can prompt more frequent refreshes
2. **Refresh duration**: A 30-minute refresh is factored into the schedule automatically
3. **Downstream dependencies**: Timing is coordinated with dependent tables
4. **System load**: May be adjusted slightly to improve cluster efficiency

---

## Choosing the Right TARGET_LAG

### Decision Framework

| Use Case | Recommended Lag | Rationale |
|----------|-----------------|-----------|
| Real-time dashboards | 1-5 minutes | Users expect current data |
| Operational reporting | 15-30 minutes | Good balance of freshness and cost |
| Business analytics | 1-4 hours | Hourly freshness usually sufficient |
| Historical analysis | 12-24 hours | Data doesn't need to be real-time |
| Archival/compliance | 24+ hours | Infrequent updates acceptable |

### Cost vs. Freshness Tradeoff

```
Shorter Lag = More Refreshes = Higher Cost = Fresher Data
Longer Lag = Fewer Refreshes = Lower Cost = Staler Data
```

**Rule of thumb**: Begin with a longer lag and shorten it only when business requirements call for fresher data.

### Questions to Ask

1. **How current does this data truly need to be?**
   - Don't default to "real-time" — many use cases are well served by hourly data

2. **What is the impact of stale data?**
   - Financial loss? User friction? Flawed decisions?

3. **How large is the source dataset?**
   - Larger tables mean longer refreshes and a need for more scheduling buffer

4. **How compute-intensive are the transformations?**
   - Complex queries require more time and resources

---

## DOWNSTREAM Deep Dive

### When to Use DOWNSTREAM

Use `TARGET_LAG = DOWNSTREAM` when:
- The table acts as an **intermediate stage** in a pipeline
- Only **downstream tables** actually read from it
- You want to **avoid refreshes that serve no immediate consumer**

### How DOWNSTREAM Works

```sql
-- This table refreshes ONLY when dashboard_metrics needs it
CREATE DYNAMIC TABLE cleaned_events
  TARGET_LAG = DOWNSTREAM
  WAREHOUSE = ETL_WH
AS SELECT * FROM raw_events WHERE is_valid = TRUE;

-- This table controls the pipeline's refresh schedule
CREATE DYNAMIC TABLE dashboard_metrics
  TARGET_LAG = '15 minutes'
  WAREHOUSE = ETL_WH
AS SELECT COUNT(*) FROM cleaned_events;
```

When `dashboard_metrics` is due for a refresh:
1. Snowflake checks whether `cleaned_events` also needs updating
2. If so, `cleaned_events` is refreshed first
3. `dashboard_metrics` then refreshes against the newly updated data

### DOWNSTREAM Chains

In a pipeline where all upstream tables use DOWNSTREAM:

```sql
A (DOWNSTREAM) → B (DOWNSTREAM) → C (DOWNSTREAM) → D ('1 hour')
```

Only D carries a time-based lag. When D triggers a refresh:
- Snowflake walks back through C, B, and A
- Refreshes whichever tables have pending changes
- Maintains snapshot isolation throughout the process

**Important**: When ALL tables in a DAG use `TARGET_LAG = DOWNSTREAM`, no automatic refreshes will ever occur. At least one table in the graph must have a time-based lag.

---

## TARGET_LAG in Dependencies

### Lag Inheritance Rules

A Dynamic Table's TARGET_LAG must be **greater than or equal to** the lag of any Dynamic Tables it reads from.

```sql
-- This is VALID
CREATE DYNAMIC TABLE upstream TARGET_LAG = '5 minutes' ...;
CREATE DYNAMIC TABLE downstream TARGET_LAG = '10 minutes'
  AS SELECT * FROM upstream;  -- ✓ 10 min >= 5 min

-- This is INVALID
CREATE DYNAMIC TABLE upstream TARGET_LAG = '30 minutes' ...;
CREATE DYNAMIC TABLE downstream TARGET_LAG = '5 minutes'
  AS SELECT * FROM upstream;  -- ✗ 5 min < 30 min
```

**Why?** When upstream data is only guaranteed fresh within 30 minutes, a downstream table cannot offer a stronger freshness promise.

### Mixed Lag Pipelines

```sql
-- Upstream tables with different lags
CREATE DYNAMIC TABLE fast_source TARGET_LAG = '1 minute' ...;
CREATE DYNAMIC TABLE slow_source TARGET_LAG = '1 hour' ...;

-- Downstream must honor the SLOWEST upstream
CREATE DYNAMIC TABLE combined TARGET_LAG = '1 hour'  -- Must be >= 1 hour
  AS SELECT * FROM fast_source JOIN slow_source ON ...;
```

---

## Changing TARGET_LAG

You can change TARGET_LAG without recreating the table:

```sql
-- Increase freshness (more frequent refresh)
ALTER DYNAMIC TABLE my_dt SET TARGET_LAG = '5 minutes';

-- Decrease freshness (less frequent refresh)
ALTER DYNAMIC TABLE my_dt SET TARGET_LAG = '4 hours';

-- Switch to DOWNSTREAM
ALTER DYNAMIC TABLE my_dt SET TARGET_LAG = DOWNSTREAM;
```

The new setting takes effect on the next refresh cycle.

---

## Monitoring Lag

### Check Current Lag

```sql
-- See the actual vs target lag
SELECT
  name,
  target_lag_seconds,
  DATEDIFF('second', data_timestamp, CURRENT_TIMESTAMP()) AS actual_lag_seconds
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MY_DYNAMIC_TABLE'
ORDER BY refresh_start_time DESC
LIMIT 1;
```

### Check if Lag is Being Met

```sql
-- Find refreshes that took longer than expected
SELECT
  name,
  data_timestamp,
  refresh_start_time,
  completion_target,
  CASE
    WHEN refresh_end_time > completion_target THEN 'MISSED'
    ELSE 'MET'
  END AS lag_status
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MY_DYNAMIC_TABLE'
ORDER BY refresh_start_time DESC
LIMIT 10;
```

---

## Common Mistakes

### Mistake 1: Lag Shorter Than the Query Execution Time

```sql
-- BAD: Complex aggregation with 1 minute lag
CREATE DYNAMIC TABLE complex_agg
  TARGET_LAG = '1 minute'  -- Refresh might take 5 minutes!
AS
SELECT ... (very complex query over huge data) ...;
```

**Fix**: Set TARGET_LAG to exceed the worst-case refresh duration.

### Mistake 2: Every Table Set to DOWNSTREAM

```sql
-- BAD: No table controls the schedule
CREATE DYNAMIC TABLE a TARGET_LAG = DOWNSTREAM ...;
CREATE DYNAMIC TABLE b TARGET_LAG = DOWNSTREAM AS SELECT * FROM a;
CREATE DYNAMIC TABLE c TARGET_LAG = DOWNSTREAM AS SELECT * FROM b;
-- Nothing ever refreshes automatically!
```

**Fix**: At least one table — typically the final consumer — must have a time-based lag.

### Mistake 3: Unnecessarily Short Lag

```sql
-- BAD: 1-minute lag for monthly reporting
CREATE DYNAMIC TABLE monthly_report
  TARGET_LAG = '1 minute'  -- Wasteful!
AS
SELECT MONTH(date), SUM(sales) FROM ... GROUP BY 1;
```

**Fix**: Set TARGET_LAG to reflect actual business requirements.

---

## Best Practices

1. **Start Conservative, Tighten If Necessary**
   - Open with `'1 hour'` or `'4 hours'`
   - Reduce only when users report data being too stale

2. **Use DOWNSTREAM for Intermediate Tables**
   - Only the final consumer table needs a time-based lag
   - This eliminates unneeded refresh operations along the pipeline

3. **Account for Refresh Duration**
   - TARGET_LAG should be at least 2x the expected refresh time
   - Track refresh duration over time and tune accordingly

4. **Align with Business Rhythms**
   - Daily reports: `'24 hours'`
   - Shift handoffs: `'8 hours'`
   - Pre-meeting prep: `'1 hour'`

5. **Monitor and Tune**
   - Review DYNAMIC_TABLE_REFRESH_HISTORY on a regular basis
   - Adjust lag values in response to actual usage patterns
