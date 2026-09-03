# Glue Job Configuration Guide

Reference for creating Glue jobs, sizing workers, applying advanced PySpark patterns, and monitoring external data import pipelines.

## Creating the Glue Job

After saving the PySpark script to S3 (e.g., `s3://<scripts-bucket>/glue-jobs/external-import-<table-name>.py`), create the Glue job.

### AWS CLI

```bash
aws glue create-job \
  --name "external-import-<source>-<table>" \
  --role "<glue-role-arn>" \
  --command "Name=glueetl,ScriptLocation=s3://<scripts-bucket>/glue-jobs/external-import-<table>.py,PythonVersion=3" \
  --connections "Connections=<glue-connection-name>" \
  --default-arguments '{
    "--datalake-formats": "iceberg",
    "--connection_name": "<glue-connection-name>",
    "--source_table": "<schema>.<table>",
    "--target_table": "<catalog>.<namespace>.<s3-table>",
    "--watermark_column": "<timestamp-column>",
    "--watermark_bucket": "<bucket>",
    "--watermark_key": "watermarks/<table-name>.txt",
    "--conf": "<see iceberg-catalog-config-and-usage.md for S3 Tables or standard Iceberg catalog config>",
    "--enable-glue-datacatalog": "true",
    "--enable-metrics": "true",
    "--enable-continuous-cloudwatch-log": "true"
  }' \
  --glue-version "5.1" \
  --number-of-workers 5 \
  --worker-type "G.1X" \
  --timeout 60 \
  --max-retries 1 \
  --region <region>
```

## Job Configuration Parameters

### Worker Types and Sizing

Select a worker type based on the characteristics of the workload:

| Worker Type | vCPUs | Memory | Use Case |
|-------------|-------|--------|----------|
| G.1X | 4 | 16 GB | Standard ETL, small to medium data volumes |
| G.2X | 8 | 32 GB | Large data volumes, memory-intensive transforms |
| G.4X | 16 | 64 GB | Very large data volumes, complex joins |
| G.8X | 32 | 128 GB | Massive data volumes, high parallelism |

**Worker count guidance:**

- **Small tables** (<1M rows, <1 GB): 2-5 workers, G.1X
- **Medium tables** (1M-10M rows, 1-10 GB): 5-10 workers, G.1X or G.2X
- **Large tables** (10M-100M rows, 10-100 GB): 10-20 workers, G.2X
- **Very large tables** (>100M rows, >100 GB): 20-50 workers, G.2X or G.4X

Begin with a conservative count and increase based on observed job duration and throughput.

### Timeout Configuration

Set the timeout according to the expected job duration:

- **Small incremental loads**: 15-30 minutes
- **Medium incremental loads**: 30-60 minutes
- **Large incremental loads**: 60-120 minutes
- **Full refresh of large tables**: 120-480 minutes

Include a buffer to account for source database query time and network latency.

### Retry Configuration

Set up retries to handle transient failures:

```python
'MaxRetries': 1  # Retry once on failure
```

For production pipelines, consider the following:

- Set `MaxRetries` to 1-2 to recover from transient network issues
- Enable Glue job bookmarks to prevent duplicate record processing
- Implement idempotent write logic (prefer upsert over append)

### Important Job Arguments

**Required arguments:**

- `--datalake-formats iceberg`: Needed for S3 Tables and standard Iceberg targets
- `--enable-glue-datacatalog`: Activates Glue Data Catalog integration for Iceberg
- `--conf`: Spark catalog configuration. See [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md) for the exact keys per target type.
- `--enable-metrics`: Publishes metrics to CloudWatch
- `--enable-continuous-cloudwatch-log`: Streams job logs to CloudWatch in real time

**Optional arguments:**

- `--enable-spark-ui`: Enables the Spark UI for debugging (an S3 bucket is required)
- `--spark-event-logs-path`: Specifies where Spark UI event logs are stored
- `--conf spark.sql.adaptive.enabled=true`: Turns on adaptive query execution
- `--conf spark.sql.adaptive.coalescePartitions.enabled=true`: Dynamically optimizes the partition count

### Network Configuration

When the source database resides in a VPC, the Glue job must have the necessary network access:

```python
'Connections': {
    'Connections': ['<glue-connection-name>']
}
```

The connection definition specifies:

- VPC
- Subnet
- Security groups
- Availability zone

Glue provisions Elastic Network Interfaces (ENIs) in the designated subnet to reach the database.

## Advanced PySpark Patterns

### Parallel Reads with Partitioning

For large tables, distribute the read across multiple partitions using Spark's partitioning support:

```python
# Read with parallel partitions
source_df = spark.read.format("jdbc").options(
    url=jdbc_url,
    dbtable="large_table",
    numPartitions=10,  # Read with 10 parallel connections
    partitionColumn="id",  # Partition on this column
    lowerBound=1,  # Min value
    upperBound=10000000  # Max value
).load()
```

This creates 10 parallel queries:

- Partition 1: `WHERE id >= 1 AND id < 1000000`
- Partition 2: `WHERE id >= 1000000 AND id < 2000000`
- ...
- Partition 10: `WHERE id >= 9000000 AND id <= 10000000`

**Best practices:**

- Choose a numeric column with an even value distribution
- Set `numPartitions` to the number of workers multiplied by the cores per worker
- Derive `lowerBound` and `upperBound` from the actual range of the data

### Deduplication Logic

When duplicate records are possible (e.g., from job retries or late-arriving data):

```python
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number

# Deduplicate by primary key, keeping latest by watermark
window = Window.partitionBy("primary_key").orderBy(col(watermark_column).desc())
deduplicated_df = source_df.withColumn("row_num", row_number().over(window)) \
    .filter(col("row_num") == 1) \
    .drop("row_num")
```

### Type Conversion and Validation

Apply type conversions alongside inline data quality checks:

```python
from pyspark.sql.functions import col, when

transformed_df = source_df.select(
    # Safe type casting with null handling
    when(col("amount").cast("double").isNotNull(), col("amount").cast("double"))
        .otherwise(0.0).alias("amount"),

    # String trimming and validation
    when(col("email").rlike(r"^[\w\.-]+@[\w\.-]+\.\w+$"), col("email"))
        .otherwise(None).alias("email"),

    # Date parsing with fallback
    when(col("order_date").isNotNull(),
         to_date(col("order_date"), "yyyy-MM-dd"))
        .otherwise(None).alias("order_date")
)
```

### Watermark with Buffer for Late Arrivals

When source data can arrive after its event timestamp (i.e., event timestamp < updated timestamp):

```python
from datetime import timedelta

# Load data from 1 day before last watermark to catch late arrivals
buffer_watermark = (datetime.strptime(last_watermark, '%Y-%m-%d %H:%M:%S')
                    - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')

filtered_df = source_df.filter(
    f"{args['watermark_column']} > '{buffer_watermark}'"
)

# Then use upsert to avoid duplicates
```

## Monitoring and Observability

### CloudWatch Logs

Glue streams job output to CloudWatch Logs at:

- Log group: `/aws-glue/jobs/output`
- Log stream: `<job-name>-<job-run-id>`

**Log patterns worth monitoring:**

- `Last watermark: <value>` - The starting point for the incremental load
- `Loading X new/updated records` - Number of records identified for loading
- `Updated watermark to: <value>` - The new watermark value saved after the load
- `ERROR` - Any errors encountered during execution

### CloudWatch Metrics

With `--enable-metrics` enabled, Glue publishes the following metrics:

- `glue.driver.aggregate.numCompletedTasks` - Number of completed tasks
- `glue.driver.aggregate.elapsedTime` - Total job duration
- `glue.driver.aggregate.recordsRead` - Records read from the source
- `glue.driver.aggregate.bytesRead` - Bytes read from the source

Configure CloudWatch alarms for:

- Job failures (state = FAILED)
- Jobs running longer than expected (duration exceeds threshold)
- No records loaded (may indicate a problem with the source)

### Spark UI

Activate the Spark UI for detailed execution metrics:

```python
'DefaultArguments': {
    '--enable-spark-ui': 'true',
    '--spark-event-logs-path': 's3://<logs-bucket>/spark-logs/'
}
```

Access it through the Glue console: Job runs → View Spark UI.

The Spark UI is useful for:

- Pinpointing slow stages caused by data skew or shuffle bottlenecks
- Examining how tasks are distributed across workers
- Diagnosing memory issues such as excessive GC time or disk spills

## Script Storage and Versioning

**Script management best practices:**

1. **Store scripts in S3**: Use a path like `s3://<scripts-bucket>/glue-jobs/<job-name>.py`
2. **Version scripts**: Enable S3 versioning or embed a version identifier in the filename
3. **Separate environments**: Use distinct S3 buckets for dev, staging, and prod
4. **Use Git**: Keep scripts in source control and deploy to S3 via CI/CD

**Example structure:**

```
s3://my-glue-scripts/
  prod/
    external-import-customers.py
    external-import-orders.py
  dev/
    external-import-customers.py
    external-import-orders.py
```

## Testing Scripts Locally

Validate PySpark scripts locally before deploying them to Glue:

```bash
# Install dependencies
pip install pyspark boto3

# Run script locally (modify to use local Spark)
python external-import-customers.py \
  --JOB_NAME test-run \
  --connection_name test-connection \
  --source_table customers \
  --target_table local.test.customers \
  --watermark_column updated_at \
  --watermark_bucket test-bucket \
  --watermark_key watermarks/customers.txt
```

For a complete local test environment, use the AWS Glue Docker images:

```bash
docker pull amazon/aws-glue-libs:glue_libs_5.0.0_image_01
```

## Summary

Glue ETL job creation workflow:

1. **Choose template** - Append, Upsert, Custom SQL, or Full Refresh
2. **Customize script** - Incorporate transformations, validation, and error handling
3. **Save to S3** - Store the script in a versioned S3 location
4. **Create job** - Use MCP or the CLI with the appropriate configuration
5. **Size workers** - Select the worker type and count based on data volume
6. **Configure monitoring** - Enable CloudWatch logs and metrics
7. **Test locally** - Validate the logic before deploying (optional)

A properly configured Glue job enables continuous, low-overhead data flow from external databases into S3 Tables.
