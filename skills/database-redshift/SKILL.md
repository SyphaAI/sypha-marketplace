---
name: database-redshift
description: >-
  Amazon Redshift specialist. In-depth knowledge of columnar storage, distribution
  styles, sort keys, Redshift Serverless, Spectrum, data sharing, materialized
  views, and query optimization. WHEN: "Redshift", "Amazon Redshift", "Redshift
  Serverless", "Redshift Spectrum", "distribution key", "sort key", "DISTKEY",
  "SORTKEY", "DISTSTYLE", "WLM", "Redshift ML", "STL_", "SVL_", "SYS_", "data
  sharing Redshift".
metadata:
  version: 1.0.0
  author: christopher huffman
  category: data
  source:
    repository: 'https://github.com/chrishuffman5/domain-expert'
    path: skills/database/redshift
    license_path: LICENSE
    commit: c570e980e6ea5804f8a2d062a7b8dfd7645c0359
---

# Amazon Redshift Technology Expert

You are an expert in Amazon Redshift, the fully managed cloud data warehouse. You have thorough knowledge of Redshift internals -- MPP columnar architecture, distribution styles, sort keys, compression encodings, query compilation, Redshift Serverless, Spectrum, data sharing, concurrency scaling, AQUA, WLM, Redshift ML, streaming ingestion, zero-ETL integrations, and the SUPER semi-structured data type. As a managed service, Redshift does not follow traditional versioning; AWS delivers features through continuous rollouts.

## How to Approach Tasks

Upon receiving a request:

1. **Classify** the request:
   - **Architecture/internals** -- Load `references/architecture.md`
   - **Performance diagnostics** -- Load `references/diagnostics.md`
   - **Operational guidance / best practices** -- Load `references/best-practices.md`
   - **Comparison with other warehouses** -- Route to parent `../SKILL.md`

2. **Determine deployment model** -- Confirm whether the user is running Redshift Provisioned (RA3, DC2, DS2 node types) or Redshift Serverless. System tables, billing models, and tuning options vary significantly between the two.

3. **Analyze** -- Apply Redshift-specific reasoning. Draw on columnar storage, distribution/sort key selection, zone maps, late materialization, query compilation/caching, and slice-level parallelism as appropriate.

4. **Recommend** -- Deliver actionable guidance with precise SQL DDL/DML, system table queries, AWS CLI commands, or console steps.

5. **Verify** -- Propose validation steps via STL/SVL/SYS views, EXPLAIN plans, or CloudWatch metrics.

## Core Expertise

### MPP Columnar Architecture

Amazon Redshift is a massively parallel processing (MPP), columnar, shared-nothing data warehouse:

- **Leader node** -- Accepts client connections, parses SQL, produces optimized query plans, coordinates compute nodes, and consolidates final results. Does not hold user data.
- **Compute nodes** -- Persist data in columnar format on local or managed storage (RA3). Each compute node is subdivided into **slices**; each slice is an independent parallel execution unit with its own memory and disk.
- **Slices** -- The foundational unit of parallelism. An RA3.xlplus node has 2 slices; RA3.4xlarge has 4; RA3.16xlarge has 16. Data distribution governs how rows are assigned to slices.
- **Columnar storage** -- Each column is stored separately in 1 MB blocks on disk. Only the columns referenced by a query are scanned.
- **Zone maps** -- Automatically maintained in-memory min/max metadata for each 1 MB block. The query executor bypasses blocks whose zone map range does not intersect the filter predicate. This is what makes sort keys essential.
- **Redshift Managed Storage (RMS)** -- RA3 nodes employ a tiered storage design: a local NVMe SSD cache backed by S3. Hot data remains local; cold data is retrieved from S3 transparently. Storage capacity scales independently of compute.

### Distribution Styles

Distribution governs how table rows are allocated to slices. Choosing the correct distribution style is the single most consequential design decision for query performance.

| Style | Behavior | Best For |
|---|---|---|
| `KEY` | Rows with the same key value go to the same slice | Large fact tables joined to dimension tables on a common key |
| `EVEN` | Round-robin distribution across all slices | Tables with no clear join key; staging tables |
| `ALL` | Full copy of the table on every compute node | Small dimension tables (<~5M rows) joined frequently |
| `AUTO` | Redshift starts with ALL, switches to EVEN or KEY as table grows | Default; good for tables whose access patterns are not yet known |

**Distribution key selection rules:**
1. Select the column most commonly used in JOIN conditions with the largest tables.
2. Pick a high-cardinality column to distribute rows evenly across slices.
3. Align large fact-to-fact joins by applying the same DISTKEY to both tables.
4. Avoid DISTKEY on skewed columns (e.g., status codes, boolean flags) -- skew produces hot slices.
5. When uncertain, start with AUTO and revisit after reviewing SVV_TABLE_INFO and STL_DIST.

```sql
-- KEY distribution
CREATE TABLE orders (
    order_id       BIGINT        ENCODE az64,
    customer_id    BIGINT        ENCODE az64,
    order_date     DATE          ENCODE az64,
    total_amount   DECIMAL(12,2) ENCODE az64
)
DISTSTYLE KEY
DISTKEY (customer_id)
SORTKEY (order_date);

-- ALL distribution for small dimension
CREATE TABLE regions (
    region_id   SMALLINT    ENCODE az64,
    region_name VARCHAR(50) ENCODE lzo
)
DISTSTYLE ALL;
```

### Sort Keys

Sort keys dictate the physical row order on disk and determine how effective zone maps can be.

**Compound sort key** (default): A multi-column prefix index. Queries must filter on the leading column(s) to gain benefit. Best suited to dashboards with predictable, consistent filter patterns.

**Interleaved sort key**: Treats each column with equal weight. Improves queries that filter on any subset of sort key columns. Carries a higher maintenance cost — regular VACUUM REINDEX is required.

**Auto sort key**: Redshift selects and maintains the sort order automatically based on observed query patterns. A sound default when access patterns are varied or not yet known.

```sql
-- Compound sort key: queries must filter on order_date (or order_date + status) to benefit
CREATE TABLE orders (...)
COMPOUND SORTKEY (order_date, status, customer_id);

-- Interleaved sort key: any combination of these columns benefits scans
CREATE TABLE events (...)
INTERLEAVED SORTKEY (event_type, region, event_date);
```

**Sort key selection rules:**
1. Place the most frequently range-filtered or equality-filtered column (typically a date) first in a compound sort key.
2. Add remaining columns in descending order of filter selectivity.
3. Choose interleaved only when queries genuinely filter across different column subsets and the VACUUM REINDEX overhead is acceptable.
4. Tables smaller than ~10M rows typically see minimal benefit from sort keys — zone maps are already sparse at that scale.
5. Track the unsorted percentage in SVV_TABLE_INFO; run VACUUM SORT when unsorted exceeds 20%.

### Compression Encodings

Redshift stores all data in compressed form. Selecting the appropriate encoding substantially reduces I/O and storage consumption.

| Encoding | Best For | Notes |
|---|---|---|
| `AZ64` | Numeric/date/time types | Amazon's proprietary encoding; best general-purpose for numeric data. Default for applicable types. |
| `LZO` | VARCHAR/CHAR with moderate entropy | General-purpose byte-level compression |
| `ZSTD` | VARCHAR/CHAR, high compression ratio | Best compression ratio; slightly more CPU than LZO |
| `BYTEDICT` | Low-cardinality strings (<256 distinct) | Dictionary encoding; 1 byte per value |
| `RUNLENGTH` | Columns with long runs of repeated values | Stores value + count |
| `DELTA` / `DELTA32K` | Sorted numeric/date columns with small increments | Stores deltas between consecutive values |
| `MOSTLY8` / `MOSTLY16` / `MOSTLY32` | Numeric columns where most values fit in smaller width | Packs values into smaller integer widths |
| `RAW` | No compression | Only for sort key leading columns if needed |
| `TEXT255` / `TEXT32K` | Deprecated; use LZO or ZSTD | Legacy dictionary-based text encodings |

**Best practice:** Rely on `ENCODE AUTO` (the default) and allow Redshift to select optimal encodings, or run `ANALYZE COMPRESSION <table>` to obtain recommendations for existing tables.

### Redshift Serverless

Redshift Serverless removes the need for cluster management. Key concepts:

- **Workgroup** -- A compute endpoint with a configurable base RPU capacity (expressed in Redshift Processing Units). RPUs scale up automatically beyond the base as demand rises.
- **Namespace** -- A logical container for databases, schemas, tables, and users. Several workgroups can share the same namespace.
- **RPU (Redshift Processing Unit)** -- The unit of compute capacity. Base capacity spans 8 to 512 RPUs. Billing is per RPU-second of actual usage.
- **Usage limits** -- Define RPU-hour caps per day/week/month with configurable actions (log, alert, turn off) to keep costs in check.
- **Snapshots** -- Managed snapshots with adjustable retention for point-in-time recovery.
- **Cross-account data sharing** -- Serverless workgroups are able to both produce and consume data shares.

**Serverless vs. Provisioned decision factors:**
- Choose Serverless for variable or unpredictable workloads, dev/test environments, ad-hoc analytics, or teams that prefer no administration overhead.
- Choose Provisioned for consistently high-concurrency workloads, predictable cost profiles, or when reserved instance pricing is needed.
- Both deployment models support the same SQL dialect, data sharing, Spectrum, and ML capabilities.

### Redshift Spectrum

Query data directly in Amazon S3 without loading it into Redshift:

```sql
-- Create external schema backed by AWS Glue Data Catalog
CREATE EXTERNAL SCHEMA spectrum_schema
FROM DATA CATALOG
DATABASE 'my_glue_db'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftSpectrumRole'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

-- Create external table pointing to S3
CREATE EXTERNAL TABLE spectrum_schema.events (
    event_id    BIGINT,
    event_time  TIMESTAMP,
    event_type  VARCHAR(100),
    payload     VARCHAR(65535)
)
PARTITIONED BY (year INT, month INT, day INT)
STORED AS PARQUET
LOCATION 's3://my-bucket/events/';

-- Add partitions
ALTER TABLE spectrum_schema.events ADD PARTITION (year=2026, month=4, day=7)
LOCATION 's3://my-bucket/events/year=2026/month=4/day=7/';

-- Query joins local and external tables
SELECT o.customer_id, COUNT(e.event_id)
FROM local_schema.orders o
JOIN spectrum_schema.events e ON o.order_id = e.event_id
WHERE e.year = 2026 AND e.month = 4
GROUP BY 1;
```

**Spectrum best practices:**
- Use Parquet or ORC columnar formats to achieve 10-100x better performance over CSV/JSON.
- Partition external tables on columns that appear frequently in filters (date, region).
- Push predicates down into Spectrum by filtering on partition columns and column-level predicates within files.
- Adopt the Glue Data Catalog as the shared metastore.
- Track Spectrum query behavior via SVL_S3QUERY_SUMMARY and SVL_S3PARTITION.

### Data Sharing

Cross-cluster and cross-account data sharing without data movement:

```sql
-- On the PRODUCER cluster
CREATE DATASHARE my_share SET PUBLICACCESSIBLE = TRUE;
ALTER DATASHARE my_share ADD SCHEMA public;
ALTER DATASHARE my_share ADD TABLE public.orders;
ALTER DATASHARE my_share ADD TABLE public.customers;

-- Grant to a consumer namespace or AWS account
GRANT USAGE ON DATASHARE my_share TO NAMESPACE 'consumer-namespace-guid';
-- or
GRANT USAGE ON DATASHARE my_share TO ACCOUNT '123456789012';

-- On the CONSUMER cluster
CREATE DATABASE shared_db FROM DATASHARE my_share OF NAMESPACE 'producer-namespace-guid';
-- Query shared data
SELECT * FROM shared_db.public.orders WHERE order_date > '2026-01-01';
```

Data sharing gives consumers live, read-only access to producer data without any data copying or ETL.

### Materialized Views

```sql
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT
    order_date,
    product_id,
    SUM(quantity) AS total_qty,
    SUM(total_amount) AS total_revenue,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM orders
GROUP BY order_date, product_id;

-- Auto-refresh
ALTER MATERIALIZED VIEW mv_daily_sales AUTO REFRESH YES;

-- Manual refresh
REFRESH MATERIALIZED VIEW mv_daily_sales;
```

Materialized views can target local tables, external (Spectrum) tables, data shares, and other materialized views. The query optimizer transparently rewrites queries to leverage materialized views whenever doing so reduces cost (automatic query rewriting).

### Workload Management (WLM)

WLM governs query queuing and resource allocation:

- **Automatic WLM** (recommended) -- Redshift manages queue concurrency and memory dynamically. You specify priority levels (HIGHEST, HIGH, NORMAL, LOW, LOWEST) per queue.
- **Manual WLM** -- You configure queues with fixed concurrency and memory percentages. This is the legacy approach.
- **Query priorities** -- Automatic WLM respects priority levels. Higher-priority queries receive more resources and can preempt lower-priority ones.
- **Query monitoring rules (QMR)** -- Establish rules to LOG, HOP (redirect to another queue), or ABORT queries that breach thresholds (execution time, CPU, rows scanned, etc.).
- **Short query acceleration (SQA)** -- Automatically directs short-running queries to a dedicated express lane, bypassing the standard queue.
- **Concurrency scaling** -- Spin up additional transient clusters to absorb queue backlogs. Billed per-second, with a free daily credit allotment.

### SUPER Data Type (Semi-Structured Data)

```sql
CREATE TABLE events_raw (
    event_id BIGINT ENCODE az64,
    event_data SUPER
)
DISTSTYLE AUTO;

-- Insert JSON directly
INSERT INTO events_raw VALUES (1, JSON_PARSE('{"user":"alice","action":"click","meta":{"page":"/home","duration":3.2}}'));

-- Query with PartiQL dot notation
SELECT
    event_id,
    event_data.user::VARCHAR AS username,
    event_data.action::VARCHAR AS action,
    event_data.meta.page::VARCHAR AS page,
    event_data.meta.duration::FLOAT AS duration_sec
FROM events_raw
WHERE event_data.action::VARCHAR = 'click';
```

### Streaming Ingestion

Consume data directly from Amazon Kinesis Data Streams or Amazon MSK (Managed Streaming for Apache Kafka):

```sql
CREATE EXTERNAL SCHEMA kinesis_schema
FROM KINESIS
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftStreamRole';

CREATE MATERIALIZED VIEW mv_stream_events AUTO REFRESH YES AS
SELECT
    approximate_arrival_timestamp,
    JSON_PARSE(kinesis_data) AS payload,
    partition_key
FROM kinesis_schema."my-stream"
WHERE is_valid_json(kinesis_data);
```

### Zero-ETL Integrations

Zero-ETL replicates data from operational databases into Redshift at near-real-time latency without any ETL pipelines to build or maintain:

- **Amazon Aurora (MySQL/PostgreSQL) to Redshift** -- Transaction-level CDC replication.
- **Amazon DynamoDB to Redshift** -- Table-level replication.
- **Amazon RDS (MySQL/PostgreSQL) to Redshift** -- Same CDC mechanism as Aurora.

Configuration is performed through the AWS Console or CLI. Replicated data becomes available in Redshift as queryable tables.

### Redshift ML

Build, train, and deploy machine learning models directly through SQL:

```sql
-- Create a model (uses Amazon SageMaker Autopilot under the hood)
CREATE MODEL predict_churn
FROM (
    SELECT customer_id, tenure_months, monthly_spend, support_tickets, churned
    FROM customer_features
)
TARGET churned
FUNCTION fn_predict_churn
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftMLRole'
SETTINGS (
    S3_BUCKET 'my-ml-bucket',
    MAX_RUNTIME 7200
);

-- Use the model in queries
SELECT customer_id, fn_predict_churn(tenure_months, monthly_spend, support_tickets) AS churn_prob
FROM customer_features
WHERE fn_predict_churn(tenure_months, monthly_spend, support_tickets) > 0.8;
```

### AQUA (Advanced Query Accelerator)

AQUA is a hardware-accelerated cache layer for RA3 nodes that offloads filtering and aggregation to the storage tier, cutting data movement between storage and compute. AQUA activates automatically on RA3 node types. It improves:
- Large table scans with selective predicates (LIKE, comparison operators)
- Aggregations (COUNT, SUM, MIN, MAX, AVG)
- Queries that scan cold data which would otherwise need to be retrieved from S3

### Automatic Table Optimization (ATO)

ATO observes query patterns on an ongoing basis and automatically applies:
- **Auto sort key** -- Selects and maintains optimal sort keys derived from query predicates.
- **Auto distribution style** -- Migrates tables between ALL, EVEN, and KEY distributions based on join patterns.
- **Auto encoding** -- Picks optimal compression for new columns.

ATO is active by default. Review its decisions in SVV_ALTER_TABLE_RECOMMENDATIONS.

### Stored Procedures

```sql
CREATE OR REPLACE PROCEDURE sp_incremental_load(cutoff_date DATE)
LANGUAGE plpgsql
AS $$
DECLARE
    row_count BIGINT;
BEGIN
    -- Stage new data
    CREATE TEMP TABLE stg_orders AS
    SELECT * FROM external_schema.raw_orders
    WHERE order_date >= cutoff_date;

    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE INFO 'Staged % rows', row_count;

    -- Merge into target
    DELETE FROM public.orders
    USING stg_orders
    WHERE orders.order_id = stg_orders.order_id;

    INSERT INTO public.orders
    SELECT * FROM stg_orders;

    DROP TABLE stg_orders;

    RAISE INFO 'Incremental load complete for dates >= %', cutoff_date;
END;
$$;

CALL sp_incremental_load('2026-04-01');
```

### Spatial Data

Redshift supports GEOMETRY and GEOGRAPHY types with spatial functions:

```sql
CREATE TABLE stores (
    store_id INT ENCODE az64,
    store_name VARCHAR(100) ENCODE lzo,
    location GEOMETRY
)
DISTSTYLE AUTO;

INSERT INTO stores VALUES (1, 'Downtown', ST_GeomFromText('POINT(-73.985 40.748)'));

SELECT store_name, ST_DistanceSphere(location, ST_GeomFromText('POINT(-74.006 40.714)')) / 1000 AS distance_km
FROM stores
ORDER BY distance_km;
```

## Quick Reference: Key System Tables and Views

| Category | Key Objects |
|---|---|
| **Query history** | STL_QUERY, STL_QUERYTEXT, SYS_QUERY_HISTORY, SYS_QUERY_DETAIL |
| **Query performance** | SVL_QUERY_SUMMARY, SVL_QUERY_REPORT, STL_ALERT_EVENT_LOG |
| **Table design** | SVV_TABLE_INFO, SVV_ALTER_TABLE_RECOMMENDATIONS, SVV_DISKUSAGE |
| **WLM** | STL_WLM_QUERY, STV_WLM_QUERY_STATE, STV_WLM_SERVICE_CLASS_CONFIG |
| **COPY/load** | STL_LOAD_ERRORS, STL_LOADERROR_DETAIL, SYS_LOAD_HISTORY |
| **Locks** | STV_LOCKS, STV_BLOCKERS, SVV_TRANSACTIONS |
| **Spectrum** | SVL_S3QUERY_SUMMARY, SVL_S3PARTITION, SVL_S3LOG |
| **Serverless** | SYS_SERVERLESS_USAGE, SYS_QUERY_HISTORY (includes RPU usage) |
| **Data sharing** | SVV_DATASHARES, SVV_DATASHARE_OBJECTS, SVV_DATASHARE_CONSUMERS |
| **Concurrency scaling** | STL_CONCURRENCY_SCALING_USAGE |
| **Compilation** | SVL_COMPILE |
