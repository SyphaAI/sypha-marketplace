# Incremental Loading Strategies

Comprehensive guide for setting up incremental data loading from external databases.

## Overview

Incremental loading fetches only new or changed records rather than reprocessing the entire dataset on every run. This approach is essential for recurring pipelines to reduce data transfer volume and processing time.

## Identify Watermark Column

A watermark column is used to track which records have already been loaded. The Glue job retrieves records where the watermark value exceeds the last loaded value.

### Common Watermark Patterns

**Timestamp column** (preferred):

- `updated_at`, `modified_date`, `last_changed`, `etl_timestamp`
- Query: `WHERE timestamp_col > '2024-03-12 10:30:00'`
- Best for: Mutable data that is updated over time

**Monotonic ID column**:

- `id`, `order_id`, `transaction_id` (auto-incrementing)
- Query: `WHERE id > 1234567`
- Best for: Immutable data with sequential IDs

**Both timestamp and ID**:

- Use the timestamp for recent changes and the ID as a fallback for historical data
- Query: `WHERE timestamp_col > '...' OR (timestamp_col IS NULL AND id > ...)`

### Ask the User

Present the available candidates from the source schema:

```
I found these potential watermark columns:
1. CREATED_DATE (TIMESTAMP) - Never changes once set
2. UPDATED_AT (TIMESTAMP) - Updates when record changes (recommended)
3. ID (NUMBER) - Auto-incrementing primary key

Which should I use to track new/updated records?
```

**Selection logic**:

- If `updated_at` or `modified_date` exists → Recommend it (captures updates to existing records)
- Else if a timestamp column exists → Use the creation timestamp
- Else if an auto-incrementing ID exists → Use the ID
- Else → Recommend a full refresh

## Determine Load Strategy

### Incremental Append (New Records Only)

**Best for**: Immutable data

- Transaction logs
- Event streams
- Historical orders
- Audit trails

**How it works**:

1. Query the source for records where `watermark > last_watermark`
2. Append the new records to the target table
3. Advance the watermark to the maximum value seen in the current batch

**Pros**: Simple, fast, and no deduplication logic is needed
**Cons**: Does not capture updates to records that already exist in the target

**PySpark example**:

```python
# Filter for new records
new_records_df = source_df.filter(
    f"{watermark_column} > '{last_watermark}'"
)

# Append to target
new_records_df.writeTo(target_table).append()
```

### Incremental Upsert (New + Updated Records)

**Best for**: Mutable data

- Customer profiles
- Product catalogs
- Employee records
- Account balances

**How it works**:

1. Query the source for records where `watermark > last_watermark`
2. Merge the results into the target table using the primary key
3. Update matching records and insert new ones
4. Advance the watermark

**Pros**: Captures both newly added records and updates to existing ones
**Cons**: More complex to implement and requires a MERGE operation

**PySpark example**:

```python
# Get new/updated records
changed_records_df = source_df.filter(
    f"{watermark_column} > '{last_watermark}'"
)

# Merge into target (upsert)
spark.sql(f"""
MERGE INTO {target_table} AS target
USING changed_records AS source
ON target.{primary_key} = source.{primary_key}
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
""")
```

### Full Refresh

**Best for**:

- Small dimension tables (< 10K rows)
- Data that lacks a watermark column
- Sources that do not support incremental queries

**How it works**:

1. Truncate or drop the target table
2. Load all records from the source
3. No watermark is required

**Pros**: Simple to implement and guarantees full data consistency
**Cons**: Inefficient for large tables and incurs higher data transfer costs

**PySpark example**:

```python
# Read all records
all_records_df = source_df.select("*")

# Overwrite target table
all_records_df.writeTo(target_table).overwritePartitions()
```

## Watermark Storage Options

The Glue job must persist the watermark value between runs.

### Option A: S3 File (Simple)

Persist the watermark as a plain text file in S3.

**Advantages**:

- Straightforward to implement
- Requires no additional AWS services
- Easy to inspect and debug directly

**Implementation**:

```python
import boto3

s3 = boto3.client('s3')
watermark_bucket = args['watermark_bucket']
watermark_key = args['watermark_key']

# Read last watermark
try:
    obj = s3.get_object(Bucket=watermark_bucket, Key=watermark_key)
    last_watermark = obj['Body'].read().decode('utf-8').strip()
    print(f"Last watermark: {last_watermark}")
except s3.exceptions.NoSuchKey:
    last_watermark = '1970-01-01 00:00:00'  # Default for timestamp
    # OR last_watermark = '0'  # Default for ID
    print("No previous watermark found, starting from beginning")

# After loading, update watermark
new_watermark = filtered_df.agg({watermark_column: "max"}).collect()[0][0]
s3.put_object(
    Bucket=watermark_bucket,
    Key=watermark_key,
    Body=str(new_watermark)
)
print(f"Updated watermark to: {new_watermark}")
```

**S3 path structure**:

```
s3://my-glue-watermarks/
  customers.txt          → "2024-03-12 14:30:00"
  orders.txt             → "2024-03-12 14:25:00"
  products.txt           → "2024-03-10 08:00:00"
```

### Option B: DynamoDB Table (Robust)

Persist watermarks in a DynamoDB table, with one item per Glue job.

**Advantages**:

- Supports atomic updates
- Watermarks can be queried programmatically
- Allows additional metadata to be stored alongside the watermark (e.g., last run time, row count)

**Create table**:

```bash
aws dynamodb create-table \
  --table-name glue-job-watermarks \
  --attribute-definitions \
    AttributeName=job_name,AttributeType=S \
  --key-schema \
    AttributeName=job_name,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region <region>
```

**Implementation**:

```python
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('glue-job-watermarks')
job_name = args['JOB_NAME']

# Read last watermark
try:
    response = table.get_item(Key={'job_name': job_name})
    item = response['Item']
    last_watermark = item['watermark']
    print(f"Last watermark for {job_name}: {last_watermark}")
except KeyError:
    last_watermark = '1970-01-01 00:00:00'
    print("No previous watermark found, starting from beginning")

# After loading, update watermark
new_watermark = filtered_df.agg({watermark_column: "max"}).collect()[0][0]
table.put_item(Item={
    'job_name': job_name,
    'watermark': str(new_watermark),
    'last_run_time': datetime.now().isoformat(),
    'rows_loaded': row_count
})
print(f"Updated watermark to: {new_watermark}")
```

### Option C: Query Target Table (Advanced)

Derive the watermark by querying the maximum value directly from the target S3 Table.

**Advantages**:

- No external storage required
- Watermark is always consistent with the actual data in the target

**Disadvantages**:

- Requires a full or partial scan of the target table, which can be slow
- Does not work on the first run when the target table is empty

**Implementation**:

```python
# Query target table for max watermark
try:
    max_watermark_df = spark.sql(f"""
        SELECT MAX({watermark_column}) as max_value
        FROM {target_table}
    """)
    last_watermark = max_watermark_df.collect()[0]['max_value']
    if last_watermark is None:
        last_watermark = '1970-01-01 00:00:00'
    print(f"Max watermark in target: {last_watermark}")
except:
    last_watermark = '1970-01-01 00:00:00'
    print("Target table empty or doesn't exist, starting from beginning")
```

**Recommendation**: Use **Option A (S3 file)** for simplicity unless you have a specific need for DynamoDB's atomic update or metadata capabilities.

## Handling Edge Cases

### Timezone Considerations

**Problem**: The source database and target use different timezones
**Solution**: Normalize all timestamps to UTC before writing

```python
from pyspark.sql.functions import to_utc_timestamp

# Convert source timestamp to UTC
df_utc = source_df.withColumn(
    "timestamp_utc",
    to_utc_timestamp(col("source_timestamp"), "America/New_York")
)
```

### Backfill Historical Data

**Scenario**: Historical data must be loaded before incremental loading can begin

**Approach**:

1. Set the watermark to the earliest desired date: `1900-01-01 00:00:00`
2. Run the job once to load all historical records
3. All subsequent runs will operate incrementally from that point forward

**OR** load history in batches:

```python
# Batch 1: Load 2020 data
WHERE timestamp >= '2020-01-01' AND timestamp < '2021-01-01'

# Batch 2: Load 2021 data
WHERE timestamp >= '2021-01-01' AND timestamp < '2022-01-01'

# Batch 3: Load 2022+ data
WHERE timestamp >= '2022-01-01'

# Then switch to incremental
```

### Late-Arriving Data

**Problem**: Records arrive after their event timestamp (e.g., an event from yesterday is received today)

**Solution 1**: Introduce a buffer window

```python
# Load data from 1 day before last watermark to catch late arrivals
buffer_watermark = last_watermark - timedelta(days=1)
WHERE timestamp > buffer_watermark
```

**Solution 2**: Filter on a dedicated `updated_at` column instead

```python
# Use updated_at instead of event_timestamp
WHERE updated_at > last_watermark
```

### Deleted Records

**Problem**: The source deletes records, but incremental loads do not propagate those deletions

**Solutions**:

**Option 1**: Periodic full refresh

- Run incremental loads on a daily schedule
- Supplement with a weekly full refresh to remove deleted records from the target

**Option 2**: Soft deletes

- The source system marks records as deleted rather than physically removing them
- Filter on: `WHERE updated_at > last_watermark OR deleted_at > last_watermark`

**Option 3**: Compare and prune

- Periodically retrieve all IDs from the source
- Identify IDs present in the target that no longer exist in the source
- Delete the orphaned records from the target

### Duplicate Records

**Problem**: The same record is loaded more than once due to job retries or watermark drift

**Prevention**:

1. Use upsert instead of append for mutable data
2. Apply deduplication logic:

```python
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number

# Deduplicate by primary key, keeping latest by watermark
window = Window.partitionBy("primary_key").orderBy(col(watermark_column).desc())
deduplicated_df = df.withColumn("row_num", row_number().over(window)) \
    .filter(col("row_num") == 1) \
    .drop("row_num")
```

## Performance Optimization

### Index the Watermark Column

Confirm that the watermark column is indexed in the source database:

```sql
-- Oracle
CREATE INDEX idx_customers_updated_at ON CUSTOMERS(UPDATED_AT);

-- SQL Server
CREATE INDEX idx_customers_updated_at ON CUSTOMERS(UPDATED_AT);

-- PostgreSQL
CREATE INDEX idx_customers_updated_at ON customers(updated_at);
```

Without an index, the source database will fall back to full table scans.

### Batch Size Tuning

For high-volume tables, break the load into smaller time-bounded batches:

```python
# Load 1 hour of data at a time
batch_size = timedelta(hours=1)
current_watermark = last_watermark

while current_watermark < datetime.now():
    next_watermark = current_watermark + batch_size

    batch_df = source_df.filter(
        (col(watermark_column) > current_watermark) &
        (col(watermark_column) <= next_watermark)
    )

    batch_df.writeTo(target_table).append()

    current_watermark = next_watermark
```

### Parallel Reads

Leverage Spark's partitioning to read from the source in parallel:

```python
source_df = spark.read.format("jdbc").options(
    url=jdbc_url,
    dbtable=table_name,
    numPartitions=10,  # Read in parallel with 10 partitions
    partitionColumn=watermark_column,
    lowerBound=last_watermark,
    upperBound=current_time
).load()
```

## Monitoring and Alerting

Capture the following metrics for each incremental load:

- **Rows loaded**: Count of new or updated records written to the target
- **Watermark advancement**: How far the watermark moved in the current run
- **Load duration**: Total elapsed time for the job
- **Data lag**: Gap between the maximum watermark in the source and the current loaded watermark

```python
# Log metrics
print(f"Job metrics:")
print(f"  Rows loaded: {row_count}")
print(f"  Previous watermark: {last_watermark}")
print(f"  New watermark: {new_watermark}")
print(f"  Watermark advancement: {new_watermark - last_watermark}")
print(f"  Load duration: {load_duration} seconds")

# Publish to CloudWatch (optional)
cloudwatch = boto3.client('cloudwatch')
cloudwatch.put_metric_data(
    Namespace='GlueJobs',
    MetricData=[{
        'MetricName': 'RowsLoaded',
        'Value': row_count,
        'Unit': 'Count',
        'Dimensions': [{'Name': 'JobName', 'Value': job_name}]
    }]
)
```

## Best Practices

1. **Choose the right watermark column**: Prefer `updated_at` over `created_at` for data that can change
2. **Test with small batches first**: Validate the logic on a limited dataset before running at full scale
3. **Add a buffer for late arrivals**: Consider loading from 1 day before the current watermark to catch delayed records
4. **Monitor watermark advancement**: Set an alert if the watermark stops progressing
5. **Handle timezones consistently**: Normalize all timestamps to UTC throughout the pipeline
6. **Index the watermark column in the source**: This dramatically reduces source query time
7. **Use upsert for mutable data**: Prevents duplicates and ensures updates are captured
8. **Store the watermark reliably**: An S3 file is simple and sufficient for most use cases

## Summary

Incremental loading workflow:

1. **Identify watermark column** - Timestamp or auto-incrementing ID
2. **Choose load strategy** - Append (immutable) vs. Upsert (mutable) vs. Full Refresh
3. **Store watermark** - S3 file, DynamoDB, or query the target table
4. **Handle edge cases** - Timezones, late arrivals, deletions, and duplicates
5. **Optimize performance** - Index the watermark column, use batch loading, enable parallel reads
6. **Monitor** - Track rows loaded, watermark advancement, and data lag

A well-designed incremental loading pipeline keeps recurring jobs efficient by syncing only the data that has changed in the source.
