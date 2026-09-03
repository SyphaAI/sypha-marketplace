---
name: ingesting-into-data-lake
description: >-
  Bring data into the AWS data lake from S3 files, local uploads, JDBC
  databases (Oracle, SQL Server, PostgreSQL, MySQL, RDS, Aurora), Amazon
  Redshift, Snowflake, BigQuery, DynamoDB, or existing Glue catalog tables
  (migration). Default target is S3 Tables; standard Iceberg on a general
  purpose bucket is supported where S3 Tables is not adopted. Handles one-time
  loads, recurring pipelines, migrations. Triggers on: import data, load data,
  ingest, sync database, migrate table, move data to AWS, set up pipeline, ETL,
  pull from Snowflake, query BigQuery into S3, export DynamoDB, CTAS, convert to
  Iceberg. Do NOT use for setting up or troubleshooting Glue connections (use
  connecting-to-data-source), creating empty tables (use
  creating-data-lake-table), running queries (use querying-data-lake), finding
  tables by fuzzy name (use finding-data-lake-assets), catalog audit (use
  exploring-data-catalog), or SaaS platforms like Salesforce, ServiceNow, SAP,
  MongoDB, Kafka.
metadata:
  upstream:
    version: 1
    argument-hint: >-
      [source-path|connection-name|table-name] [--target
      s3-tables|iceberg|parquet]
  category: data
  source:
    repository: 'https://github.com/aws/agent-toolkit-for-aws'
    path: plugins/aws-data-analytics/skills/ingesting-into-data-lake
    license_path: LICENSE
    commit: cbdc61a29707dc97989d5d11a2b53ad584781e78
---

# Ingest into Data Lake

Transfer data from a source into a queryable table in the data lake. This skill assumes any required source connection already exists. For Glue connection creation or troubleshooting, delegate to `connecting-to-data-source`.

## Philosophy

**Default to S3 Tables unless the environment indicates otherwise.** S3 Tables is the preferred destination for new data lake work. If the user's catalog inventory shows that S3 Tables has not been adopted, recommend standard Iceberg on their existing general-purpose bucket rather than pushing them to change their posture.

## Common Tasks

You MUST run commands using AWS MCP server tools when connected -- they provide validation, sandboxed execution, and audit logging. Fall back to the AWS CLI only when MCP is unavailable. You MUST describe each step before executing it.

## Workflow

### 1. Verify Dependencies and Context

- You MUST determine whether AWS MCP tools or the AWS CLI are available and notify the user if either is missing
- You MUST confirm the target AWS region and validate credentials using `aws sts get-caller-identity`
- For SageMaker Unified Studio project roles, be aware that target tables and connections may be scoped to the project. Refer to the caller ARN detection pattern in `querying-data-lake`.

### 2. Classify the Source

| User says... | Source type | Reference |
|---|---|---|
| "upload my file", "local CSV", "move to S3" | Local file | [local-upload.md](references/local-upload.md) |
| "load from S3", "import CSV/JSON/Parquet from s3://" | S3 files | [s3-files.md](references/s3-files.md) |
| "import from Oracle/Postgres/MySQL/SQL Server/Redshift/RDS/Aurora" | JDBC | [jdbc-ingest.md](references/jdbc-ingest.md) |
| "pull from Snowflake", "Snowflake table to S3" | Snowflake | [snowflake-ingest.md](references/snowflake-ingest.md) |
| "import from BigQuery", "GCP analytics to S3" | BigQuery | [bigquery-ingest.md](references/bigquery-ingest.md) |
| "export DynamoDB", "DynamoDB to data lake" | DynamoDB | [dynamodb-ingest.md](references/dynamodb-ingest.md) |
| "migrate Glue table", "convert Hive to Iceberg" | Catalog migration | [catalog-migration.md](references/catalog-migration.md) |

If the user references Salesforce, ServiceNow, SAP, MongoDB, Kafka, or any other SaaS/streaming source, decline -- these are not supported in this release.

If the source table is identified by a vague or business-oriented name ("migrate our orders table", "pull from the sales warehouse"), delegate to `finding-data-lake-assets` to resolve the name before continuing.

### 3. Confirm Connection Exists (if applicable)

A Glue connection is required for JDBC, Snowflake, and BigQuery sources. Verify with:

```bash
aws glue get-connection --name <CONNECTION_NAME> --region <REGION>
```

If no connection exists, stop here and delegate to `connecting-to-data-source` to create and test one. Do not proceed with the ingest until the connection has been confirmed.

Local files, S3 files, DynamoDB, and catalog migration workflows do not require a Glue connection.

### 4. Clarify the Target

You MUST ask the user (or make a suggestion based on catalog inventory) before creating or writing to any table:

- **Database/namespace**: Is there an existing target database, or does one need to be created?
- **Table**: An existing table (append/merge) or a new table (delegate to `creating-data-lake-table`)?
- **Format**: S3 Tables (default), standard Iceberg, or raw Parquet?

**Inventory-aware defaults:**

If you have already run `exploring-data-catalog` or can perform a quick check, base your recommendation on what already exists:

- Account has an `s3tablescatalog` federated catalog and active table buckets: recommend S3 Tables
- Account has general-purpose buckets with Iceberg tables and no S3 Tables usage: recommend standard Iceberg on their existing bucket
- Account uses Parquet/ORC on S3 without Iceberg metadata: ask whether to adopt Iceberg now (recommended) or continue with raw files

Do not push S3 Tables on accounts that have not yet adopted it. See [iceberg-catalog-config-and-usage.md](references/iceberg-catalog-config-and-usage.md).

**Delegations from this step:**

- Target table doesn't exist -> `creating-data-lake-table`
- Target database named by fuzzy term -> `finding-data-lake-assets`
- User doesn't know what exists -> `exploring-data-catalog`

### 5. Execute Source Workflow

Consult the appropriate source-specific reference and follow its phases. Each reference is self-contained with job templates, known pitfalls, and troubleshooting guidance:

- Local / S3 / JDBC / Snowflake / BigQuery / DynamoDB / catalog migration -- one reference per source

Shared Glue 5.1 or higher job configuration and PySpark templates are available in [glue-job-config.md](references/glue-job-config.md) and [glue-job-scripts.md](references/glue-job-scripts.md).

### 6. Validate

Run all three checks without skipping any:

1. Row count matches the expected value (source vs target)
2. Null check on critical columns
3. Spot-check 3-5 sample rows

See [data-quality-validation.md](references/data-quality-validation.md).

### 7. Schedule (if recurring)

For pipelines that run on a schedule, set up a Glue Trigger with a cron expression. See [testing-and-scheduling.md](references/testing-and-scheduling.md). Single-step pipelines use Glue Triggers; multi-step workflows with branching logic use MWAA.

## Argument Routing

- S3 path only: Treat as a one-time load and begin Step 2 with S3 files
- Connection name: Begin at Step 3 using the provided connection
- Table name: Begin at Step 4 and ask whether this is the source or target
- `--target` flag: Pre-populate the target format in Step 4
- No args: Proceed interactively

## Gotchas

- S3 Tables requires Glue 5.1 or higher and the `--datalake-formats iceberg` job argument
- All `spark.sql.catalog.*` configuration MUST be placed in `--conf` job arguments, never in `spark.conf.set()`. Glue 5.x will raise `AnalysisException: Cannot modify the value of a static config` otherwise. See [iceberg-catalog-config-and-usage.md](references/iceberg-catalog-config-and-usage.md) for correct catalog configs.
- The `warehouse` parameter is required in the S3 Tables catalog config. Omitting it causes Spark to fail with "Cannot derive default warehouse location".
- Table and column names in S3 Tables MUST be all lowercase
- `overwritePartitions()` replaces only the partitions present in the DataFrame -- for a full refresh that includes deletions, use `createOrReplace()`
- Standard Iceberg targets MUST include a LOCATION clause; S3 Tables targets MUST NOT
- DynamoDB does not require a Glue connection -- do not try to create one
- Connection failures during ingest should be delegated back to `connecting-to-data-source`; do not troubleshoot network or credential issues within this skill
- For target tables in SageMaker Unified Studio projects, confirm that the project role has write access to the target namespace before the Glue job runs

## Troubleshooting

| Error | Likely cause | Action |
|---|---|---|
| Access Denied on S3 | Missing IAM permissions | Check Glue role has s3:GetObject, s3:PutObject |
| Access Denied on S3 Tables | Missing s3tables:* permissions | Add S3 Tables inline policy to Glue role |
| CTAS timeout | Dataset too large for Athena | Switch to Glue ETL or batch with WHERE filters |
| JDBC connection timeout/auth failure | Connection-level issue | Delegate to `connecting-to-data-source` |
| Throughput exceeded (DynamoDB) | Read percent too high | Lower `read.percent` or use native export |

See [error-handling.md](references/error-handling.md) for the full catalog.

## References

### Source-specific

- [local-upload.md](references/local-upload.md) -- Local files
- [s3-files.md](references/s3-files.md) -- S3 files (CSV, JSON, Parquet, Avro, ORC)
- [jdbc-ingest.md](references/jdbc-ingest.md) -- Oracle, SQL Server, PostgreSQL, MySQL, RDS, Aurora, Redshift
- [snowflake-ingest.md](references/snowflake-ingest.md) -- Snowflake
- [bigquery-ingest.md](references/bigquery-ingest.md) -- BigQuery
- [dynamodb-ingest.md](references/dynamodb-ingest.md) -- DynamoDB (export and Glue direct read)
- [catalog-migration.md](references/catalog-migration.md) -- Existing Glue catalog tables (Hive, self-managed Iceberg)

### Cross-cutting

- [iceberg-catalog-config-and-usage.md](references/iceberg-catalog-config-and-usage.md) -- S3 Tables, standard Iceberg, raw files: catalog config, engine access patterns
- [glue-job-config.md](references/glue-job-config.md) -- Job sizing, monitoring, retry
- [glue-job-scripts.md](references/glue-job-scripts.md) -- PySpark templates (append, upsert, custom SQL, full refresh)
- [incremental-loading.md](references/incremental-loading.md) -- Watermark strategies
- [testing-and-scheduling.md](references/testing-and-scheduling.md) -- Glue Triggers, MWAA
- [data-quality-validation.md](references/data-quality-validation.md) -- Row counts, null checks, Glue Data Quality
- [schema-evolution.md](references/schema-evolution.md) -- ALTER TABLE ADD COLUMNS, nested JSON
- [type-transformations.md](references/type-transformations.md) -- Type conflict resolution
- [format-specific-loading.md](references/format-specific-loading.md) -- CSV/JSON/Parquet/Avro/ORC specifics
- [athena-loading.md](references/athena-loading.md) -- Athena INSERT INTO as simple-load fallback
- [error-handling.md](references/error-handling.md) -- Ingest errors (connection errors delegate to connecting-to-data-source)
- [upload-options.md](references/upload-options.md) -- aws s3 cp vs sync, multipart

### Migration-specific

- [ctas-patterns.md](references/ctas-patterns.md) -- Athena CTAS syntax and partition transforms
- [glue-etl-migration.md](references/glue-etl-migration.md) -- Large-table migration via Glue 5.1 or higher PySpark
- [migration-validation.md](references/migration-validation.md) -- Full validation checklist
- [migration-troubleshooting.md](references/migration-troubleshooting.md) -- CTAS failures, visibility, partitions

### JDBC-specific

- [jdbc-schema-discovery.md](references/jdbc-schema-discovery.md) -- Crawler, direct inspection, custom SQL
- [jdbc-performance.md](references/jdbc-performance.md) -- Parallel reads, partitioning
