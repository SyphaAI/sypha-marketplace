# Glue ETL Migration for Large Tables

Choose Glue ETL (Path B) when Athena CTAS would time out, when transformations are complex, or when the migration must be scheduled and repeatable.

## When to Use

- Source table exceeds ~100 GB
- Column transformations are complex enough to benefit from PySpark
- The migration must run on a schedule or be re-runnable
- The source produces more than 100 target partitions, making batching impractical

## Job Setup

### Requirements

- Glue 5.1 or higher (Spark 3.5.6, Iceberg 1.10.0)
- `--datalake-formats iceberg` job argument
- Catalog configuration in the `--conf` job argument (never in `spark.conf.set()`). See [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md) for the exact keys.
- IAM role with permissions for S3 Tables, Glue, and S3

### Job Configuration (JSON)

Use `--cli-input-json` to sidestep shell escaping issues:

> **Glue --conf format**: In Glue `DefaultArguments`, multiple Spark configs must be passed as a single `--conf` value with space-separated `--conf key=value` pairs. Do not split them into separate JSON keys — Glue only reads one `--conf` key.

```json
{
    "Name": "migrate-to-s3tables",
    "Role": "arn:aws:iam::<account-id>:role/<glue-role>",
    "Command": {
        "Name": "glueetl",
        "ScriptLocation": "s3://<scripts-bucket>/scripts/migrate.py",
        "PythonVersion": "3"
    },
    "DefaultArguments": {
        "--datalake-formats": "iceberg",
        "--enable-glue-datacatalog": "true",
        "--conf": "<see iceberg-catalog-config-and-usage.md for S3 Tables Analytics Integration or REST config>"
    },
    "GlueVersion": "5.1",
    "NumberOfWorkers": 10,
    "WorkerType": "G.1X"
}
```

```bash
aws glue create-job --cli-input-json file://job-config.json --region <region>
```

Scale `NumberOfWorkers` according to source size: a reasonable starting point is approximately 2 workers per 50 GB.

## PySpark Migration Script

```python
import sys
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

args = getResolvedOptions(sys.argv, [
    'JOB_NAME', 'source_database', 'source_table',
    'target_namespace', 'target_table'
])

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Read from source (Glue Data Catalog)
source_df = spark.read.table(
    f"glue_catalog.{args['source_database']}.{args['source_table']}"
)

# Apply transforms (customize as needed)
# Example: lowercase column names for S3 Tables compatibility
for col_name in source_df.columns:
    if col_name != col_name.lower():
        source_df = source_df.withColumnRenamed(col_name, col_name.lower())

# Write to S3 Table
target_table = f"s3tablescatalog.{args['target_namespace']}.{args['target_table']}"

source_df.writeTo(target_table) \
    .tableProperty("format-version", "2") \
    .createOrReplace()

# Verify row count
source_count = spark.read.table(
    f"glue_catalog.{args['source_database']}.{args['source_table']}"
).count()
target_count = spark.read.table(target_table).count()
print(f"Source rows: {source_count}, Target rows: {target_count}")

job.commit()
```

## Key Points

- All catalog configuration belongs in the `--conf` job argument, never in `spark.conf.set()`. See [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md) for the exact keys.
- Do not include a `LOCATION` clause -- S3 Tables manages its own storage
- Column names must be entirely lowercase to be visible in Athena
- `createOrReplace()` covers both scenarios: it creates the table when absent and replaces it when already present, making it safe for re-runs
- For partitioned writes, chain `.partitionedBy()` before calling `.createOrReplace()`

## Running and Monitoring the Job

```bash
# Start the job
JOB_RUN_ID=$(aws glue start-job-run \
  --job-name "migrate-to-s3tables" \
  --arguments '{"--source_database":"legacy_db","--source_table":"orders","--target_namespace":"analytics","--target_table":"orders"}' \
  --query 'JobRunId' --output text)

# Check status
aws glue get-job-run --job-name "migrate-to-s3tables" --run-id "$JOB_RUN_ID"
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Cannot modify static config" | Catalog config in `spark.conf.set()` | Move all catalog config to `--conf` job argument |
| "Access Denied" on S3 Tables | Missing IAM permissions | Add `AmazonS3TablesFullAccess` to Glue role |
| Job runs out of memory | Too few workers for data size | Increase `NumberOfWorkers` or use `G.2X` worker type |
| Table not visible in Athena after Glue job | Used REST endpoint instead of analytics integration | Use the GlueCatalog method with `glue.id` config |
