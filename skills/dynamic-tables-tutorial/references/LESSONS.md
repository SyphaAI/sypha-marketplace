# Dynamic Tables Tutorial - Lesson SQL Reference

This file contains all SQL code for the tutorial, organized by lesson. Progress through each section one step at a time, offering explanations as you go.

---

## Lesson 1: Load Data from Cloud Storage

**Learning Objective**: Bring sample data from an S3 bucket into Snowflake to serve as the source for our Dynamic Tables.

### Step 1.1: Set Up the Environment

```sql
-- Use the dedicated least-privilege tutorial environment
USE ROLE SNOWFLAKE_LEARNING_ROLE;
USE DATABASE SNOWFLAKE_LEARNING_DB;
USE WAREHOUSE SNOWFLAKE_LEARNING_WH;

-- Create a user-specific schema to avoid conflicts with other learners
SET user_schema = CURRENT_USER() || '_DYNAMIC_TABLES';
CREATE SCHEMA IF NOT EXISTS IDENTIFIER($user_schema);
USE SCHEMA IDENTIFIER($user_schema);
```

**Explain**: A schema named after the current user (e.g., `JOHN_DYNAMIC_TABLES`) is created so that multiple participants can execute this tutorial at the same time without interfering with one another.

### Step 1.2: Create File Format and Stage

```sql
-- Create a file format for reading CSV files
CREATE OR REPLACE FILE FORMAT csv_ff
  TYPE = 'CSV';
```

**Explain**: File formats tell Snowflake how to interpret files when reading them. This basic format is suitable for standard CSV files.

```sql
-- Create an external stage pointing to the Tasty Bytes sample data in S3
CREATE OR REPLACE STAGE tasty_bytes_stage
  URL = 's3://sfquickstarts/tastybytes/'
  FILE_FORMAT = csv_ff;
```

**Explain**: A stage is a pointer to an external storage location. This one targets Snowflake's public sample data bucket containing the Tasty Bytes food truck dataset.

### Step 1.3: Create the Source Table

```sql
-- Create the raw menu table that will be our source
CREATE OR REPLACE TABLE menu_raw
(
  menu_id NUMBER(19,0),
  menu_type_id NUMBER(38,0),
  menu_type VARCHAR,
  truck_brand_name VARCHAR,
  menu_item_id NUMBER(38,0),
  menu_item_name VARCHAR,
  item_category VARCHAR,
  item_subcategory VARCHAR,
  cost_of_goods_usd NUMBER(38,4),
  sale_price_usd NUMBER(38,4),
  menu_item_health_metrics_obj VARIANT
);
```

**Explain**: This table stores menu items from multiple food truck brands together with the pricing information needed to calculate profitability.

### Step 1.4: Load the Data

```sql
-- Load menu data from S3 into our table
COPY INTO menu_raw
FROM @tasty_bytes_stage/raw_pos/menu/;
```

**Explain**: COPY INTO moves data from the stage into the target table. Several hundred menu items should be loaded by this operation.

### Step 1.5: Verify the Data

```sql
-- Check how many rows were loaded
SELECT COUNT(*) AS total_menu_items FROM menu_raw;
```

**Explain**: This confirms that data was ingested successfully.

```sql
-- Preview the data
SELECT
  menu_item_name,
  truck_brand_name,
  cost_of_goods_usd,
  sale_price_usd
FROM menu_raw
LIMIT 10;
```

**Explain**: This provides a sample view of the data. Each row corresponds to a menu item with its cost and sale price — a natural fit for profitability analysis.

---

## Lesson 2: Create Your First Dynamic Table

**Learning Objective**: Build a Dynamic Table that automatically computes menu item profitability and refreshes according to TARGET_LAG.

### Step 2.1: Create the Dynamic Table

```sql
-- Create a dynamic table that calculates profitability metrics
CREATE OR REPLACE DYNAMIC TABLE menu_profitability
  TARGET_LAG = '3 hours'
  WAREHOUSE = COMPUTE_WH
  AS
SELECT
  -- Product identifiers
  menu_item_id,
  menu_item_name,
  truck_brand_name,
  menu_type,
  item_category,
  item_subcategory,

  -- Pricing information
  cost_of_goods_usd,
  sale_price_usd,

  -- Profitability calculations
  (sale_price_usd - cost_of_goods_usd) AS profit_usd,
  ROUND(
    ((sale_price_usd - cost_of_goods_usd) / NULLIF(sale_price_usd, 0)) * 100,
    2
  ) AS profit_margin_pct,

  -- Price categorization
  CASE
    WHEN sale_price_usd < 5 THEN 'Budget'
    WHEN sale_price_usd BETWEEN 5 AND 10 THEN 'Mid-Range'
    ELSE 'Premium'
  END AS price_tier

FROM menu_raw
WHERE sale_price_usd IS NOT NULL
  AND cost_of_goods_usd IS NOT NULL;
```

**Explain the key parts**:
- `TARGET_LAG = '3 hours'`: The data will never fall more than 3 hours behind the source
- `WAREHOUSE = COMPUTE_WH`: This warehouse carries out the refresh operations
- The SELECT clause determines what the table contains
- Profit is expressed both in dollars and as a percentage
- Items are categorized into price tiers

### Step 2.2: Query the Dynamic Table

```sql
-- Find the most profitable menu items
SELECT
  truck_brand_name,
  menu_item_name,
  price_tier,
  profit_usd,
  profit_margin_pct
FROM menu_profitability
ORDER BY profit_margin_pct DESC
LIMIT 10;
```

**Explain**: From a querying standpoint, the dynamic table behaves just like a regular table. What sets it apart is that Snowflake automatically keeps its contents up to date.

### Step 2.3: Check the Refresh Status

```sql
-- See when the dynamic table was last refreshed
SELECT
  name,
  refresh_action,
  state,
  refresh_start_time,
  refresh_end_time,
  DATEDIFF('second', refresh_start_time, refresh_end_time) AS duration_seconds
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MENU_PROFITABILITY'
ORDER BY refresh_start_time DESC
LIMIT 5;
```

**Explain**: This shows the refresh history for the dynamic table. The first entry should display `refresh_action = 'REINITIALIZE'` since it corresponds to the initial population of data.

---

## Lesson 3: Incremental Refresh in Action

**Learning Objective**: See how Dynamic Tables handle only modified data by inserting new rows and triggering a refresh manually.

### Step 3.1: Create a Stored Procedure to Generate Data

```sql
-- Create a procedure that generates new menu items
CREATE OR REPLACE PROCEDURE generate_menu_items(num_rows INTEGER)
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
  items_before INTEGER;
  items_after INTEGER;
  items_inserted INTEGER;
BEGIN
  -- Capture count before insert
  SELECT COUNT(*) INTO :items_before FROM menu_raw;

  -- Insert new menu items based on existing data with randomized values
  INSERT INTO menu_raw (
    menu_id,
    menu_type_id,
    menu_type,
    truck_brand_name,
    menu_item_id,
    menu_item_name,
    item_category,
    item_subcategory,
    cost_of_goods_usd,
    sale_price_usd,
    menu_item_health_metrics_obj
  )
  SELECT
    (SELECT COALESCE(MAX(menu_id), 0) FROM menu_raw) + ROW_NUMBER() OVER (ORDER BY RANDOM()) AS menu_id,
    menu_type_id,
    menu_type,
    truck_brand_name,
    (SELECT COALESCE(MAX(menu_item_id), 0) FROM menu_raw) + ROW_NUMBER() OVER (ORDER BY RANDOM()) AS menu_item_id,
    'New Menu Item ' || ((SELECT COALESCE(MAX(menu_item_id), 0) FROM menu_raw) + ROW_NUMBER() OVER (ORDER BY RANDOM())) AS menu_item_name,
    item_category,
    item_subcategory,
    cost_of_goods_usd * (0.8 + UNIFORM(0, 0.4, RANDOM())) AS cost_of_goods_usd,
    sale_price_usd * (0.8 + UNIFORM(0, 0.4, RANDOM())) AS sale_price_usd,
    menu_item_health_metrics_obj
  FROM menu_raw
  WHERE menu_item_id IS NOT NULL
  ORDER BY RANDOM()
  LIMIT :num_rows;

  -- Capture count after insert
  SELECT COUNT(*) INTO :items_after FROM menu_raw;
  items_inserted := :items_after - :items_before;

  RETURN 'Successfully inserted ' || items_inserted::STRING || ' new menu items. Total items: ' || items_after::STRING;
END;
$$;
```

**Explain**: This procedure creates new menu items by copying existing ones and applying slightly randomized prices. It provides a convenient way to add data so we can watch incremental refresh in practice.

### Step 3.2: Generate New Data

```sql
-- Add 100 new menu items
CALL generate_menu_items(100);
```

**Explain**: 100 new rows have just been inserted into `menu_raw`. The dynamic table has not yet picked up these changes.

```sql
-- Verify the new rows exist in the source
SELECT COUNT(*) AS total_rows FROM menu_raw;
```

### Step 3.3: Manually Trigger a Refresh

```sql
-- Manually refresh the dynamic table (normally this happens automatically)
ALTER DYNAMIC TABLE menu_profitability REFRESH;
```

**Explain**: In normal circumstances, Snowflake triggers refreshes automatically based on the TARGET_LAG setting. We invoke it manually here so the behavior is immediately visible.

### Step 3.4: Verify Incremental Refresh

```sql
-- Check the refresh history - look for 'INCREMENTAL' in refresh_action
SELECT
  name,
  refresh_action,
  state,
  refresh_start_time,
  refresh_end_time,
  DATEDIFF('second', refresh_start_time, refresh_end_time) AS duration_seconds
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
WHERE name = 'MENU_PROFITABILITY'
ORDER BY refresh_start_time DESC
LIMIT 5;
```

**Explain**: Pay attention to the `refresh_action` column:
- `REINITIALIZE` — Complete table rebuild executed during initial creation
- `INCREMENTAL` — Only the 100 newly added rows were processed
- `FULL` — The whole table was recomputed (occurs when incremental processing was not feasible)

The latest refresh should show `INCREMENTAL`, which confirms that Snowflake processed only the new rows.

---

## Lesson 4: Materialized Views vs Dynamic Tables

**Learning Objective**: Recognize the distinctions between Materialized Views and Dynamic Tables, and learn how to transition from one to the other.

### Step 4.1: Create a Materialized View

```sql
-- Create a materialized view showing menu summary by brand and category
CREATE OR REPLACE MATERIALIZED VIEW menu_summary_mv
AS
SELECT
  truck_brand_name,
  menu_type,
  item_category,
  COUNT(*) AS item_count,
  ROUND(AVG(cost_of_goods_usd), 2) AS avg_cost_usd,
  ROUND(AVG(sale_price_usd), 2) AS avg_price_usd,
  ROUND(AVG(sale_price_usd - cost_of_goods_usd), 2) AS avg_profit_usd,
  ROUND(
    AVG(((sale_price_usd - cost_of_goods_usd) / NULLIF(sale_price_usd, 0)) * 100),
    2
  ) AS avg_margin_pct,
  MIN(sale_price_usd - cost_of_goods_usd) AS min_profit_usd,
  MAX(sale_price_usd - cost_of_goods_usd) AS max_profit_usd
FROM menu_raw
WHERE sale_price_usd IS NOT NULL
  AND cost_of_goods_usd IS NOT NULL
GROUP BY
  truck_brand_name,
  menu_type,
  item_category;
```

**Explain**: Materialized Views likewise persist precomputed results, but they come with significant limitations relative to Dynamic Tables.

### Step 4.2: Query the Materialized View

```sql
-- Query the materialized view
SELECT
  truck_brand_name,
  menu_type,
  item_category,
  item_count,
  avg_profit_usd,
  avg_margin_pct
FROM menu_summary_mv
ORDER BY avg_margin_pct DESC
LIMIT 10;
```

### Step 4.3: Understand the Differences

**Key differences to cover**:

| Feature | Materialized View | Dynamic Table |
|---------|------------------|---------------|
| Refresh timing | Background, no control | TARGET_LAG gives you control |
| Incremental refresh | No | Yes (when possible) |
| Chain dependencies | Cannot read from another MV | Can read from other DTs |
| Refresh mode | Always full | AUTO, INCREMENTAL, or FULL |

### Step 4.4: Convert to a Dynamic Table

```sql
-- The same query as a Dynamic Table - just add TARGET_LAG and WAREHOUSE
CREATE OR REPLACE DYNAMIC TABLE menu_summary_dt
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  truck_brand_name,
  menu_type,
  item_category,
  COUNT(*) AS item_count,
  ROUND(AVG(cost_of_goods_usd), 2) AS avg_cost_usd,
  ROUND(AVG(sale_price_usd), 2) AS avg_price_usd,
  ROUND(AVG(sale_price_usd - cost_of_goods_usd), 2) AS avg_profit_usd,
  ROUND(
    AVG(((sale_price_usd - cost_of_goods_usd) / NULLIF(sale_price_usd, 0)) * 100),
    2
  ) AS avg_margin_pct,
  MIN(sale_price_usd - cost_of_goods_usd) AS min_profit_usd,
  MAX(sale_price_usd - cost_of_goods_usd) AS max_profit_usd
FROM menu_raw
WHERE sale_price_usd IS NOT NULL
  AND cost_of_goods_usd IS NOT NULL
GROUP BY
  truck_brand_name,
  menu_type,
  item_category;
```

**Explain**: The conversion is simple — wrap the same SELECT query in Dynamic Table syntax. The result gives you:
- Control over when data refreshes (TARGET_LAG = '1 hour')
- The possibility of incremental refresh
- The ability to chain this table with other Dynamic Tables

---

## Lesson 5: Change Data Capture (CDC) Comparison

**Learning Objective**: Contrast the traditional CDC approach using Streams and Tasks with the modern Dynamic Tables method.

### Approach A: Traditional CDC with Streams and Tasks

**Step 5.1: Create the Stream**

```sql
-- Create a stream to capture changes on the source table
CREATE OR REPLACE STREAM menu_changes_stream
  ON TABLE menu_raw;
```

**Explain**: A stream tracks INSERT, UPDATE, and DELETE operations on a table — serving as a running change log.

**Important Note**: This stream only captures changes that take place AFTER its creation. Rows that already exist in the table will not be reflected in the stream.

**Step 5.2: Create the Target Table**

```sql
-- Create a target table for the CDC pipeline
CREATE OR REPLACE TABLE menu_profitability_cdc
(
  menu_item_id NUMBER(38,0),
  menu_item_name VARCHAR,
  truck_brand_name VARCHAR,
  profit_usd NUMBER(38,4),
  profit_margin_pct NUMBER(38,2),
  updated_at TIMESTAMP_NTZ
);
```

**Step 5.3: Create the Task**

```sql
-- Create a task to process the stream
CREATE OR REPLACE TASK update_menu_profitability
  WAREHOUSE = COMPUTE_WH
  SCHEDULE = '3 HOURS'
WHEN
  SYSTEM$STREAM_HAS_DATA('menu_changes_stream')
AS
  MERGE INTO menu_profitability_cdc t
  USING (
    SELECT
      menu_item_id,
      menu_item_name,
      truck_brand_name,
      sale_price_usd - cost_of_goods_usd AS profit_usd,
      ROUND(((sale_price_usd - cost_of_goods_usd) / NULLIF(sale_price_usd, 0)) * 100, 2) AS profit_margin_pct,
      METADATA$ACTION
    FROM menu_changes_stream
  ) s
  ON t.menu_item_id = s.menu_item_id
  WHEN MATCHED AND s.METADATA$ACTION = 'DELETE' THEN
    DELETE
  WHEN MATCHED THEN
    UPDATE SET
      t.menu_item_name = s.menu_item_name,
      t.truck_brand_name = s.truck_brand_name,
      t.profit_usd = s.profit_usd,
      t.profit_margin_pct = s.profit_margin_pct,
      t.updated_at = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN
    INSERT (menu_item_id, menu_item_name, truck_brand_name, profit_usd, profit_margin_pct, updated_at)
    VALUES (s.menu_item_id, s.menu_item_name, s.truck_brand_name, s.profit_usd, s.profit_margin_pct, CURRENT_TIMESTAMP());
```

**Explain**: This task:
1. Runs on a 3-hour cycle (SCHEDULE)
2. Only activates when the stream has data to process (WHEN clause)
3. Uses MERGE to handle inserts, updates, and deletes

**Step 5.4: Do Initial Load and Test**

```sql
-- Initial load of existing data (stream only captures future changes)
INSERT INTO menu_profitability_cdc
SELECT
  menu_item_id,
  menu_item_name,
  truck_brand_name,
  sale_price_usd - cost_of_goods_usd AS profit_usd,
  ROUND(((sale_price_usd - cost_of_goods_usd) / NULLIF(sale_price_usd, 0)) * 100, 2) AS profit_margin_pct,
  CURRENT_TIMESTAMP() AS updated_at
FROM menu_raw
WHERE sale_price_usd IS NOT NULL AND cost_of_goods_usd IS NOT NULL;
```

```sql
-- Manually execute the task to test it
EXECUTE TASK update_menu_profitability;
```

```sql
-- View the results
SELECT
  menu_item_id,
  menu_item_name,
  truck_brand_name,
  profit_usd,
  profit_margin_pct,
  updated_at
FROM menu_profitability_cdc
ORDER BY profit_margin_pct DESC
LIMIT 10;
```

### Approach B: Dynamic Tables (Same Result, Less Code)

**Step 5.5: Create the Equivalent Dynamic Table**

```sql
-- Same CDC functionality with a Dynamic Table
CREATE OR REPLACE DYNAMIC TABLE menu_profitability_dt
  TARGET_LAG = '3 HOURS'
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  menu_item_id,
  menu_item_name,
  truck_brand_name,
  (sale_price_usd - cost_of_goods_usd) AS profit_usd,
  ROUND(((sale_price_usd - cost_of_goods_usd) / NULLIF(sale_price_usd, 0)) * 100, 2) AS profit_margin_pct
FROM menu_raw
WHERE sale_price_usd IS NOT NULL
  AND cost_of_goods_usd IS NOT NULL;
```

**Explain**: Notice how much more concise this is — a single statement replaces:
- CREATE STREAM
- CREATE TABLE
- CREATE TASK with MERGE logic
- An initial data load

The Dynamic Table handles all of that on its own.

**Step 5.6: Compare the Results**

```sql
-- Query the Dynamic Table results
SELECT
  menu_item_id,
  menu_item_name,
  truck_brand_name,
  profit_usd,
  profit_margin_pct
FROM menu_profitability_dt
ORDER BY profit_margin_pct DESC
LIMIT 10;
```

**Step 5.7: Suspend the Task**

```sql
-- IMPORTANT: Suspend the task to prevent it from running on schedule
ALTER TASK update_menu_profitability SUSPEND;
```

**Explain**: Make it a habit to suspend tasks after testing is done. Tasks left running will keep consuming warehouse credits.

---

## Lesson 6: Verification and Cleanup

**Learning Objective**: Confirm that everything is working as expected and remove the tutorial objects.

### Step 6.1: Final Verification

```sql
-- List all dynamic tables we created
SHOW DYNAMIC TABLES;
```

```sql
-- Check refresh history for all dynamic tables
SELECT
  name,
  refresh_action,
  state,
  refresh_start_time,
  refresh_end_time,
  DATEDIFF('second', refresh_start_time, refresh_end_time) AS duration_seconds
FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
ORDER BY refresh_start_time DESC
LIMIT 10;
```

```sql
-- Verify row counts
SELECT 'menu_raw' AS table_name, COUNT(*) AS row_count FROM menu_raw
UNION ALL
SELECT 'menu_profitability', COUNT(*) FROM menu_profitability
UNION ALL
SELECT 'menu_profitability_dt', COUNT(*) FROM menu_profitability_dt
UNION ALL
SELECT 'menu_profitability_cdc', COUNT(*) FROM menu_profitability_cdc;
```

```sql
-- Show sample results from the main dynamic table
SELECT
  truck_brand_name,
  menu_item_name,
  profit_margin_pct,
  price_tier
FROM menu_profitability
ORDER BY profit_margin_pct DESC
LIMIT 5;
```

### Step 6.2: Cleanup (Optional)

Execute this section only when the user wants to delete the tutorial objects:

```sql
-- Clean up all objects created in this tutorial
DROP TASK IF EXISTS update_menu_profitability;
DROP STREAM IF EXISTS menu_changes_stream;
DROP TABLE IF EXISTS menu_profitability_cdc;

DROP DYNAMIC TABLE IF EXISTS menu_profitability_dt;
DROP DYNAMIC TABLE IF EXISTS menu_summary_dt;
DROP DYNAMIC TABLE IF EXISTS menu_profitability;

DROP MATERIALIZED VIEW IF EXISTS menu_summary_mv;

DROP PROCEDURE IF EXISTS generate_menu_items(INTEGER);
DROP TABLE IF EXISTS menu_raw;
DROP STAGE IF EXISTS tasty_bytes_stage;
DROP FILE FORMAT IF EXISTS csv_ff;

-- Optionally drop the entire schema
-- DROP SCHEMA IF EXISTS IDENTIFIER($user_schema);
```

**Explain**: This drops every object created during the tutorial. The schema removal is commented out so the user can continue exploring if desired.

---

## Summary of What Was Built

| Object Type | Name | Purpose |
|-------------|------|---------|
| Table | menu_raw | Source data from Tasty Bytes |
| Dynamic Table | menu_profitability | Calculates profit metrics with 3-hour lag |
| Dynamic Table | menu_profitability_dt | CDC example using DT |
| Dynamic Table | menu_summary_dt | Aggregations by brand/category |
| Materialized View | menu_summary_mv | For comparison with DT |
| Stream | menu_changes_stream | Traditional CDC approach |
| Task | update_menu_profitability | Traditional CDC approach |
| Table | menu_profitability_cdc | Traditional CDC target |
| Procedure | generate_menu_items | Generates test data |
