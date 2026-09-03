# Amazon Redshift Best Practices Reference

## Table Design

### Distribution Style Selection

Distribution style is the single most consequential design choice for join performance.

**Decision tree:**

1. **Is the table small (<~2M rows) and frequently joined?** --> DISTSTYLE ALL
2. **Is there a single column used in most JOINs with other large tables?** --> DISTSTYLE KEY on that column
3. **Are there multiple large fact tables that join to each other?** --> DISTKEY both on the shared join column
4. **Is the table rarely joined or used only for scans/aggregations?** --> DISTSTYLE EVEN
5. **Unsure about access patterns?** --> DISTSTYLE AUTO (let ATO decide)

**Common mistakes:**
- DISTKEY on a low-cardinality column (e.g., `status`, `country_code`) producing severe data skew.
- DISTKEY on a column not used in JOINs -- incurs the cost of key distribution without gaining co-location benefits.
- Using DISTSTYLE ALL on a large table -- duplicates storage (full copy on every node) and degrades COPY/INSERT performance (must write to every node).
- Failing to align DISTKEY between fact tables that are joined together frequently.

**Validating distribution:**
```sql
-- Check current distribution style and skew
SELECT "table", diststyle, skew_rows, skew_sortkey1
FROM SVV_TABLE_INFO
WHERE schema = 'public'
ORDER BY skew_rows DESC;

-- Check redistribution in query plans
EXPLAIN <your_query>;
-- Look for DS_DIST_BOTH or DS_DIST_INNER -- these indicate data movement
```

### Sort Key Selection

**Decision tree:**

1. **Most queries filter on a date/timestamp range?** --> COMPOUND SORTKEY with date column first.
2. **Queries consistently filter on the same 2-3 columns in order?** --> COMPOUND SORTKEY in filter-frequency order.
3. **Queries filter on unpredictable subsets of columns?** --> INTERLEAVED SORTKEY (accept higher maintenance).
4. **Unsure?** --> AUTO SORTKEY (let ATO decide).

**Compound sort key column ordering:**
```sql
-- Most dashboards filter by date, then by region, then by product
CREATE TABLE sales (...)
COMPOUND SORTKEY (sale_date, region, product_id);
-- Queries filtering on sale_date benefit fully
-- Queries filtering on sale_date + region benefit fully
-- Queries filtering on region alone get NO sort key benefit (must include leading columns)
```

**Maintenance:**
- VACUUM SORT restores sort order following INSERT/UPDATE/DELETE operations.
- VACUUM REINDEX rebuilds interleaved sort key indexes (must be run periodically for interleaved keys).
- Track unsorted percentage: `SELECT "table", unsorted FROM SVV_TABLE_INFO WHERE unsorted > 5;`

### Compression Encoding

**Recommendations by data type:**

| Data Type | Recommended Encoding | Notes |
|---|---|---|
| BIGINT, INT, SMALLINT | AZ64 | Default; best for numeric types |
| DECIMAL/NUMERIC | AZ64 | Default for RA3 |
| DATE, TIMESTAMP | AZ64 | Excellent for date/time |
| BOOLEAN | ZSTD or RAW | Small columns; compression overhead may exceed benefit |
| VARCHAR (low cardinality) | BYTEDICT | <256 distinct values; 1-byte dictionary lookup |
| VARCHAR (moderate cardinality) | LZO | Good balance of compression and CPU |
| VARCHAR (high cardinality, large) | ZSTD | Best compression ratio for text |
| CHAR | LZO or ZSTD | Depends on string length and cardinality |
| FLOAT/DOUBLE | AZ64 or ZSTD | AZ64 for numeric patterns; ZSTD for random |
| SUPER | LZO | Semi-structured data |

**Best practice:** Specify `ENCODE AUTO` on CREATE TABLE and allow Redshift/ATO to select encodings automatically. Override only when ANALYZE COMPRESSION identifies a clear improvement.

### Column Data Types

- **Use the smallest data type that fits.** Prefer SMALLINT over BIGINT; DATE over TIMESTAMP when time information is unnecessary; VARCHAR(100) over VARCHAR(65535).
- **Avoid VARCHAR(MAX) / VARCHAR(65535)** unless required. Oversized VARCHAR declarations increase memory consumption in intermediate result sets.
- **Use DECIMAL for financial data.** Never store currency values as FLOAT/DOUBLE.
- **Use SUPER for semi-structured JSON.** Storing JSON as VARCHAR should be avoided — SUPER enables PartiQL queries and pushdown optimization.
- **Use TIMESTAMPTZ for time-zone-aware timestamps.** Redshift stores TIMESTAMPTZ values in UTC internally.
- **Use BIGINT for surrogate keys.** INT (4 bytes) caps at ~2.1 billion; BIGINT (8 bytes) accommodates petabyte-scale warehouses.

### Primary Keys and Foreign Keys

Redshift does not enforce primary key or foreign key constraints, but declaring them supplies important query optimizer hints:

```sql
CREATE TABLE orders (
    order_id BIGINT NOT NULL PRIMARY KEY ENCODE az64,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ENCODE az64,
    order_date DATE NOT NULL ENCODE az64
)
DISTSTYLE KEY DISTKEY (customer_id)
SORTKEY (order_date);
```

- **NOT NULL** -- Enforced. Apply to every column that must never hold a null value.
- **PRIMARY KEY** -- Not enforced, but leveraged by the optimizer to eliminate redundant joins and enable certain rewrites.
- **FOREIGN KEY** -- Not enforced, but consulted by the optimizer for join elimination.
- **UNIQUE** -- Not enforced. Declare solely for optimizer hints.
- **It is your responsibility** to guarantee uniqueness and referential integrity within your ETL process.

## Data Loading

### COPY Command Best Practices

COPY is the most efficient method for loading data into Redshift. It takes advantage of parallel loading across all slices.

```sql
COPY orders
FROM 's3://my-bucket/orders/'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftCopyRole'
FORMAT AS PARQUET;
```

**Performance optimization:**
1. **Split input files to match slice count.** For a 16-slice cluster, supply 16 (or a multiple of 16) equally-sized files. Each slice loads one file concurrently. A single large file serializes loading onto one slice.
2. **Use columnar formats.** Parquet and ORC load 2-10x faster than CSV because Redshift can skip unused columns and apply predicate pushdown.
3. **Compress input files.** Use GZIP, LZO, BZIP2, or ZSTD for text formats. Parquet/ORC include built-in compression.
4. **Use a manifest file** to precisely control which files are loaded:
   ```json
   {
     "entries": [
       {"url": "s3://bucket/orders/part-001.parquet", "mandatory": true},
       {"url": "s3://bucket/orders/part-002.parquet", "mandatory": true}
     ]
   }
   ```
   ```sql
   COPY orders FROM 's3://bucket/orders/manifest.json'
   IAM_ROLE '...' MANIFEST FORMAT AS PARQUET;
   ```
5. **MAXERROR** -- Set to a low number (e.g., 10) to abort loads on unexpected errors instead of silently discarding rows.
6. **COMPUPDATE OFF** -- When the table already uses optimal encodings, bypass the analyze-and-update step.
7. **STATUPDATE OFF** -- Omit the automatic statistics update after COPY when you manage ANALYZE independently.

**File sizing guidelines:**
| Cluster Size | Ideal File Size | Ideal File Count |
|---|---|---|
| 2-node RA3.xlplus (4 slices) | 64-128 MB each | 4-8 files |
| 4-node RA3.4xlarge (16 slices) | 64-128 MB each | 16-32 files |
| 8-node RA3.16xlarge (128 slices) | 64-128 MB each | 128-256 files |

### COPY Error Handling

```sql
-- After a failed COPY, check errors
SELECT * FROM STL_LOAD_ERRORS ORDER BY starttime DESC LIMIT 20;

-- Detailed error information
SELECT
    le.starttime, le.filename, le.line_number, le.colname,
    le.type, le.raw_field_value, le.err_reason,
    d.raw_line
FROM STL_LOAD_ERRORS le
LEFT JOIN STL_LOADERROR_DETAIL d ON le.query = d.query AND le.line_number = d.line_number
ORDER BY le.starttime DESC
LIMIT 20;
```

### INSERT Performance

- **Avoid single-row INSERTs in loops.** Every INSERT is an individual transaction carrying commit overhead.
- **Use INSERT INTO ... SELECT for transformations** executed within Redshift.
- **Use COPY for bulk loading** from S3 -- always prefer COPY over multi-row INSERT for external data.
- **CREATE TABLE AS (CTAS)** is typically faster than INSERT INTO ... SELECT because it produces optimally encoded, sorted, and distributed data in a single pass.
- **Deep copy pattern** for table restructuring:
  ```sql
  -- Create new table with desired structure
  CREATE TABLE orders_new (LIKE orders) DISTSTYLE KEY DISTKEY(customer_id) SORTKEY(order_date);
  -- Copy data
  INSERT INTO orders_new SELECT * FROM orders;
  -- Swap
  ALTER TABLE orders RENAME TO orders_old;
  ALTER TABLE orders_new RENAME TO orders;
  DROP TABLE orders_old;
  ```

### UNLOAD Best Practices

```sql
UNLOAD ('SELECT * FROM orders WHERE order_date >= ''2026-01-01''')
TO 's3://my-bucket/unload/orders_'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftUnloadRole'
FORMAT AS PARQUET
PARTITION BY (order_date)
MAXFILESIZE 256 MB
ALLOWOVERWRITE;
```

- **FORMAT AS PARQUET** -- Columnar output, significantly smaller than CSV, and quicker to reload.
- **PARTITION BY** -- Produces a Hive-style partitioned directory layout in S3.
- **MAXFILESIZE** -- Governs output file size. 256 MB - 1 GB per file is optimal for downstream consumption.
- **PARALLEL ON** (default) -- Each slice independently writes its own file(s) in parallel.

## VACUUM and ANALYZE

### VACUUM

Redshift tables require VACUUM to recover space occupied by deleted rows and to re-establish sort order.

```sql
-- Full vacuum: reclaims space AND re-sorts
VACUUM FULL orders;

-- Delete-only vacuum: reclaims space but does not re-sort
VACUUM DELETE ONLY orders;

-- Sort-only vacuum: re-sorts but does not reclaim space
VACUUM SORT ONLY orders;

-- Reindex: rebuilds interleaved sort key indexes
VACUUM REINDEX orders;

-- Vacuum to a threshold (only vacuum if >threshold% unsorted or >threshold% deleted)
VACUUM FULL orders TO 80 PERCENT;
```

**Automated vacuum:** Redshift executes automatic VACUUM DELETE in the background during low-activity periods. Manual VACUUM is still required for SORT and REINDEX operations.

**VACUUM best practices:**
- Schedule VACUUM SORT in maintenance windows following large batch loads.
- Watch `unsorted` and `tbl_rows` vs `size` in SVV_TABLE_INFO.
- On large tables, VACUUM can run for hours. Use `VACUUM ... TO <threshold> PERCENT` to bound the amount of work performed.
- VACUUM holds a table-level lock that prevents DDL (but does not block DML reads/writes).

### ANALYZE

ANALYZE refreshes the table statistics that the query optimizer relies on.

```sql
-- Analyze a specific table
ANALYZE orders;

-- Analyze specific columns
ANALYZE orders (order_date, customer_id);

-- Analyze predicate columns (columns used in WHERE, JOIN, GROUP BY, ORDER BY)
ANALYZE PREDICATE COLUMNS orders;
```

**Auto-analyze:** Redshift automatically executes ANALYZE on tables that have changed substantially (>10% of rows). This covers most scenarios.

**When to run manual ANALYZE:**
- After the initial bulk load of a new table.
- After ingesting a large batch that materially shifts the data distribution.
- After DDL changes that affect statistics (ADD COLUMN, etc.).
- When query plans exhibit unexpected full table scans.

## Query Performance Optimization

### EXPLAIN Plan Analysis

```sql
EXPLAIN SELECT o.order_id, c.name, o.total_amount
FROM orders o JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date BETWEEN '2026-01-01' AND '2026-03-31';
```

**Key things to look for in EXPLAIN output:**

1. **DS_DIST labels** -- DS_DIST_NONE (best) vs DS_DIST_BOTH (worst). Reflects the amount of data movement required for joins.
2. **Scan types** -- Sequential Scan is expected for columnar storage. Examine the `rows=` estimate against the actual row count.
3. **Hash Join vs Merge Join** -- Merge join is available when both inputs are sorted on the join key. Hash join constructs a hash table and is memory intensive.
4. **Sort steps** -- Sorts are costly. When ORDER BY aligns with the sort key, no runtime sort is required.
5. **Cost** -- Relative units. A higher cost implies greater I/O and CPU demand.
6. **Width** -- Bytes per output row. Selecting fewer columns reduces width.
7. **Broadcast** -- DS_BCAST_INNER indicates the inner table is broadcast. Acceptable for small tables; a concern for large ones.

### Query Anti-Patterns

**1. SELECT * -- Never use in production queries.**
```sql
-- BAD: reads all columns
SELECT * FROM orders WHERE order_date = '2026-04-07';

-- GOOD: reads only needed columns
SELECT order_id, customer_id, total_amount FROM orders WHERE order_date = '2026-04-07';
```

**2. Cross-joins and Cartesian products.**
```sql
-- Check for accidental cross-joins by reviewing EXPLAIN for "Nested Loop" with no join predicate.
```

**3. Large DISTINCT or GROUP BY on high-cardinality columns.**
```sql
-- Consider approximate functions for large-scale distinct counts
SELECT approximate_count_distinct(user_id) FROM events;
```

**4. Functions on sort key columns in WHERE clauses.**
```sql
-- BAD: function on sort key prevents zone map pruning
SELECT * FROM orders WHERE DATE_TRUNC('month', order_date) = '2026-01-01';

-- GOOD: range predicate preserves zone map pruning
SELECT * FROM orders WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01';
```

**5. NOT IN with NULLs (use NOT EXISTS instead).**
```sql
-- BAD: NOT IN returns no rows if subquery contains any NULL
SELECT * FROM orders WHERE customer_id NOT IN (SELECT customer_id FROM blacklist);

-- GOOD: NOT EXISTS handles NULLs correctly
SELECT * FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM blacklist b WHERE b.customer_id = o.customer_id);
```

**6. Excessive use of ORDER BY without LIMIT.**

**7. LIKE with leading wildcard ('%%pattern') -- cannot use sort key optimization.**

### Join Optimization

- **Co-locate large-to-large joins** by assigning the same DISTKEY to both tables' join column.
- **Use DISTSTYLE ALL** for small dimension tables that are joined by numerous large tables on varying keys.
- **Avoid joining on expressions** (e.g., `ON UPPER(a.name) = UPPER(b.name)`) -- doing so prevents co-located joins.
- **Pre-filter** large tables inside subqueries/CTEs before joining to minimize data movement.
- **Materialized views** can precompute expensive joins.

### Window Functions

Redshift provides strong window function support. Prefer them over self-joins:

```sql
-- Running total using window function (efficient)
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date ROWS UNBOUNDED PRECEDING) AS running_total
FROM orders;

-- Instead of a correlated subquery (inefficient)
SELECT o1.order_date, o1.total_amount,
    (SELECT SUM(o2.total_amount) FROM orders o2 WHERE o2.order_date <= o1.order_date) AS running_total
FROM orders o1;
```

## Workload Management (WLM) Configuration

### Automatic WLM (Recommended)

```sql
-- Check current WLM configuration
SELECT * FROM STV_WLM_SERVICE_CLASS_CONFIG;

-- View query priorities
SELECT service_class, condition, action, action_value
FROM STV_WLM_CLASSIFICATION_CONFIG;
```

**Priority setup via console or CLI:**
- Define queues for distinct workload classes (e.g., ETL, BI, ad-hoc).
- Set a priority for each queue: HIGHEST, HIGH, NORMAL, LOW, LOWEST.
- Route queries to queues by associating them with user groups or query groups.

```sql
-- Route a session to a specific queue
SET query_group TO 'etl_queue';

-- Route by user group (configured in WLM)
-- Users in the 'analysts' group automatically go to the BI queue
```

### Query Monitoring Rules (QMR)

Configure rules to abort, log, or hop (re-route) queries that surpass defined thresholds:

| Rule | Metric | Recommended Threshold | Action |
|---|---|---|---|
| Long-running queries | `query_execution_time` | 3600 seconds | HOP or ABORT |
| Memory hogs | `query_mem_peak_usage_percentage` | 80% | LOG + ABORT |
| Runaway scans | `scan_row_count` | 10 billion rows | LOG + ABORT |
| CPU hogs | `query_cpu_time` | 600 seconds | LOG |
| Nested loops | `nested_loop_join_row_count` | 1 billion rows | ABORT |
| Return too many rows | `return_row_count` | 10 million rows | LOG |

### Short Query Acceleration (SQA)

SQA directs short-running queries to a fast-path execution lane:

- Enabled by default in Automatic WLM.
- Redshift predicts whether a query will finish within the SQA maximum runtime (configurable; default is determined dynamically).
- Short queries skip the main WLM queue and begin executing immediately.
- If the prediction is incorrect and the query exceeds the threshold, it is redirected to a standard queue.

### Concurrency Scaling

```sql
-- Enable concurrency scaling on a WLM queue (via console/CLI configuration)
-- Check concurrency scaling usage
SELECT * FROM STL_CONCURRENCY_SCALING_USAGE ORDER BY starttime DESC LIMIT 20;
```

Best practice: Enable concurrency scaling on queues that serve interactive or BI queries. Disable it for ETL queues, where queuing is acceptable.

## ETL and Data Pipeline Best Practices

### Incremental Loading Pattern

```sql
-- Stage new/changed data
CREATE TEMP TABLE stg_orders AS
SELECT * FROM spectrum_schema.raw_orders
WHERE load_timestamp > (SELECT MAX(load_timestamp) FROM public.orders);

-- Delete existing rows that will be replaced (merge/upsert pattern)
BEGIN TRANSACTION;

DELETE FROM public.orders
USING stg_orders
WHERE orders.order_id = stg_orders.order_id;

INSERT INTO public.orders
SELECT * FROM stg_orders;

COMMIT;

ANALYZE public.orders;
```

### Large Table Maintenance

For tables subject to heavy updates or deletions:

1. **Deep copy** instead of VACUUM for severely fragmented tables (>50% deleted rows):
   ```sql
   CREATE TABLE orders_clean (LIKE orders INCLUDING DEFAULTS);
   INSERT INTO orders_clean SELECT * FROM orders;
   DROP TABLE orders;
   ALTER TABLE orders_clean RENAME TO orders;
   ```

2. **Time-partitioned tables** -- Maintain separate tables per time period (e.g., `orders_2026_q1`, `orders_2026_q2`) exposed through a UNION ALL view or late-binding view.

3. **Staging tables** -- Rely on temporary or staging tables for ETL transformations. Remove them after use to recover space.

### Transaction Best Practices

- **Redshift uses serializable isolation** by default (the strictest available level).
- **Keep transactions short.** Long-running transactions hold locks and block VACUUM from recovering space.
- **Avoid explicit BEGIN/COMMIT around single statements** -- each statement is automatically committed.
- **Control commit frequency** in multi-statement ETL: group statements into batches of a few hundred per transaction.
- **Monitor long transactions:** `SELECT * FROM SVV_TRANSACTIONS WHERE lockable_object_type = 'relation' ORDER BY txn_start;`

## Monitoring and Alerting

### Key CloudWatch Metrics

| Metric | Healthy Range | Alert Threshold |
|---|---|---|
| `CPUUtilization` | <80% sustained | >90% for >15 min |
| `PercentageDiskSpaceUsed` | <75% | >80% |
| `DatabaseConnections` | <400 | >450 (max 500) |
| `HealthStatus` | 1 (healthy) | 0 (unhealthy) |
| `MaintenanceMode` | 0 | 1 (maintenance in progress) |
| `ReadLatency` | <5 ms | >20 ms |
| `WriteLatency` | <10 ms | >50 ms |
| `QueriesCompletedPerSecond` | varies | sudden drop |
| `QueryDuration` | varies | p99 > 2x baseline |
| `WLMQueueLength` | 0-5 | >20 sustained |
| `ConcurrencyScalingActiveClusters` | 0-1 | >3 sustained |

### Serverless CloudWatch Metrics

| Metric | Description |
|---|---|
| `ComputeCapacity` | Current RPU allocation |
| `ComputeSeconds` | RPU-seconds consumed |
| `DataStorage` | Total storage in bytes |
| `QueriesRunning` | Active query count |
| `QueriesQueued` | Queued query count |
| `QueryDuration` | Average query duration |

### Recommended Alarms

1. Disk space > 80% -- Immediate action required (VACUUM, drop old data, resize).
2. CPU > 90% sustained -- Investigate running queries, add nodes, or activate concurrency scaling.
3. WLM queue length > 20 for > 5 minutes -- Queue is backing up; consider concurrency scaling or adjusting priorities.
4. Health status = 0 -- Cluster is unavailable; consult the AWS Health Dashboard.
5. Query duration p99 > threshold -- Performance regression detected; examine recent schema or data changes.

## Security Best Practices

### Principle of Least Privilege

```sql
-- Create a read-only role
CREATE ROLE analyst_role;
GRANT USAGE ON SCHEMA public TO ROLE analyst_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ROLE analyst_role;

-- Create a user and assign the role
CREATE USER analyst_user PASSWORD 'ComplexP@ss123!';
GRANT ROLE analyst_role TO analyst_user;

-- Row-level security
CREATE RLS POLICY region_policy
WITH (region VARCHAR(50))
USING (region = current_setting('app.user_region'));

ATTACH RLS POLICY region_policy ON orders TO ROLE analyst_role;
ALTER TABLE orders ROW LEVEL SECURITY ON;

-- Dynamic data masking
CREATE MASKING POLICY mask_email
WITH (email VARCHAR(256))
USING (
    CASE
        WHEN current_user IN ('admin') THEN email
        ELSE '***@' || SPLIT_PART(email, '@', 2)
    END
);
ATTACH MASKING POLICY mask_email ON customers(email) TO PUBLIC;
```

### Network Security

- **Always enable Enhanced VPC Routing** for COPY/UNLOAD operations to ensure data stays within the VPC.
- **Use VPC endpoints** when accessing S3, Glue, STS, and other AWS services.
- **Restrict security groups** to specific CIDR ranges and only the required port (5439).
- **Enable SSL** through the parameter group: `require_ssl = true`.
- **Audit logging** -- Activate user activity logging via the parameter group and deliver logs to S3.

### Encryption

- **Enable encryption at rest** for all production clusters (cannot be modified after provisioned cluster creation; serverless is always encrypted).
- **Use AWS KMS** for key management and enable automatic rotation.
- **Rotate credentials** on a regular schedule; use IAM-based authentication wherever possible.

## Cost Optimization

### Provisioned Cluster Cost Optimization

1. **Right-size:** Begin with the smallest RA3 node type that satisfies your performance SLA. Use elastic resize to scale as needed.
2. **Reserved Instances:** Purchase 1 or 3-year reservations for 30-75% savings on stable workloads.
3. **Pause/Resume:** Pause clusters outside business hours (dev/test environments). You are billed only for storage while paused.
4. **Concurrency scaling free credits:** 1 hour free per 24-hour period. Schedule burst workloads to consume free credits first.
5. **Spectrum offload:** Migrate cold or archival data to S3 and query it through Spectrum. S3 storage costs roughly 10x less than Redshift RA3 storage.
6. **Data sharing:** Share data across clusters without replication by using the data sharing feature for zero-copy access.

### Serverless Cost Optimization

1. **Set appropriate base RPU capacity.** Start conservatively (32-64 RPUs) and increase only if queries are running slowly.
2. **Usage limits.** Configure daily/weekly RPU-hour caps with alert actions to control spend.
3. **Workgroup separation.** Establish separate workgroups for different teams so each has independent cost controls.
4. **Schedule workloads.** Run batch ETL during off-peak hours when auto-scaling overhead is reduced.
5. **Optimize queries.** Every RPU-second has a cost -- aggressively tune slow-running queries.

## Troubleshooting Playbooks

### Query Stuck in Queue (WLM)

1. Inspect queue state: `SELECT * FROM STV_WLM_QUERY_STATE WHERE state = 'Queued';`
2. Pinpoint the blocking queue: `SELECT * FROM STV_WLM_SERVICE_CLASS_STATE;`
3. Confirm whether concurrency scaling is active for the queue.
4. Look for long-running queries that are consuming all available slots: `SELECT * FROM STV_RECENTS WHERE status = 'Running' ORDER BY starttime;`
5. Resolution: Terminate long-running queries, raise WLM concurrency (automatic WLM), or activate concurrency scaling.

### Disk Full (100% Disk Usage)

1. **Immediate:** Terminate all running queries to release temp space: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename != 'rdsdb';`
2. **Assess space:** `SELECT * FROM SVV_TABLE_INFO ORDER BY size DESC LIMIT 20;`
3. **Run VACUUM DELETE** on tables carrying a high count of deleted rows.
4. **Remove temp tables** and staging tables.
5. **Truncate or DROP** tables that are no longer needed.
6. **Elastic resize** to add nodes when storage is genuinely insufficient.
7. **Long-term:** Move to RA3 nodes for managed storage, or migrate cold data to Spectrum.

### Data Skew (Hot Slices)

1. **Identify skewed tables:** `SELECT "table", skew_rows FROM SVV_TABLE_INFO WHERE skew_rows > 2.0 ORDER BY skew_rows DESC;`
2. **Examine distribution:** Review the cardinality and value distribution of the DISTKEY column.
3. **Resolution options:**
   - Switch the DISTKEY to a column with higher cardinality.
   - Move to DISTSTYLE EVEN when no suitable DISTKEY column exists.
   - Switch to DISTSTYLE AUTO.
4. **Apply the change:** Use the deep copy pattern (CREATE TABLE ... LIKE + INSERT INTO ... SELECT).

### COPY Failures

1. **Review errors:** `SELECT * FROM STL_LOAD_ERRORS ORDER BY starttime DESC LIMIT 20;`
2. **Examine error detail:** `SELECT * FROM STL_LOADERROR_DETAIL WHERE query = <query_id>;`
3. **Common causes:**
   - Data type mismatch (e.g., a string value in a numeric column) -- correct the source data or apply explicit COPY options.
   - File not found -- verify the S3 path, IAM permissions, and VPC routing.
   - Manifest errors -- validate the manifest JSON syntax.
   - Permission denied -- confirm the IAM role trust policy and S3 bucket policy.
   - Encoding errors (UTF-8) -- use the `ACCEPTINVCHARS` option.
   - Field delimiter present in data -- use `ESCAPE` or switch to Parquet format.

### Lock Contention

1. **List current locks:** `SELECT * FROM STV_LOCKS;`
2. **Locate blockers:** `SELECT * FROM STV_BLOCKERS;`
3. **Inspect transactions:** `SELECT * FROM SVV_TRANSACTIONS ORDER BY txn_start LIMIT 20;`
4. **Resolution:**
   - Kill the blocking session: `SELECT pg_terminate_backend(<pid>);`
   - Refrain from running DDL during periods of active query load.
   - Keep transactions as short as possible.
   - Schedule VACUUM and other maintenance operations during low-activity windows.

### Slow Spectrum Queries

1. **Inspect Spectrum performance:** `SELECT * FROM SVL_S3QUERY_SUMMARY WHERE query = <query_id>;`
2. **Review partition pruning:** `SELECT * FROM SVL_S3PARTITION WHERE query = <query_id>;`
3. **Common causes:**
   - Non-columnar format in use (CSV/JSON instead of Parquet/ORC).
   - Excessive numbers of small files (< 64 MB each).
   - No partition pruning applied (WHERE clause missing partition column predicates).
   - Too many partitions being scanned.
4. **Resolution:** Convert data to Parquet, merge small files, add partition predicates to queries, and introduce additional partitions on columns that are frequently filtered.
