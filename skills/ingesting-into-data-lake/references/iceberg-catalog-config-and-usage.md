# Iceberg Catalog Config and Engine Access Patterns

How to set up Spark catalog settings, choose a target format, and reference tables from each engine.

## S3 Tables (Default)

Fully managed Iceberg tables with automatic compaction, snapshot management, and multi-engine access.

- Catalog path: The table bucket is configured in `--conf` via `glue.id`, so the write path is 3-part: `s3tablescatalog.<namespace>.<table>`
- No LOCATION clause in CREATE TABLE
- Table and column names must be lowercase
- Requires Glue 5.1 or higher and `--datalake-formats iceberg` job argument
- All `spark.sql.catalog.*` configuration goes in `--conf` job arguments, never in `spark.conf.set()` (Glue 5.x static config restriction)
- Delegate table creation to [creating-data-lake-table](../../creating-data-lake-table/SKILL.md)

Two access methods are available. Choose Analytics Integration when the table must be visible to Athena, Redshift, or EMR. Use the REST Endpoint when only Glue Spark jobs will access the table.

**Analytics Integration (recommended for multi-engine access):**

```
spark.sql.catalog.s3tablescatalog=org.apache.iceberg.spark.SparkCatalog
spark.sql.catalog.s3tablescatalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog
spark.sql.catalog.s3tablescatalog.glue.id=<account-id>:s3tablescatalog/<table-bucket-name>
spark.sql.catalog.s3tablescatalog.warehouse=<table-bucket-arn>
```

The `warehouse` parameter is required. Omitting it causes Spark to fail with "Cannot derive default warehouse location".

**REST Endpoint (Glue-only access):**

```
spark.sql.catalog.s3tables=org.apache.iceberg.spark.SparkCatalog
spark.sql.catalog.s3tables.type=rest
spark.sql.catalog.s3tables.uri=https://s3tables.<region>.amazonaws.com/iceberg
spark.sql.catalog.s3tables.warehouse=<table-bucket-arn>
spark.sql.catalog.s3tables.rest.sigv4-enabled=true
spark.sql.catalog.s3tables.rest.signing-name=s3tables
spark.sql.catalog.s3tables.rest.signing-region=<region>
spark.sql.catalog.s3tables.io-impl=org.apache.iceberg.aws.s3.S3FileIO
```

Tables created via the REST Endpoint are NOT visible in Athena or Redshift.

**`--conf` format in Glue DefaultArguments:** Supply all settings as a single string. The first key-value pair has no `--conf` prefix; every subsequent pair is space-separated and prefixed with `--conf`:

```json
"--conf": "spark.sql.catalog.s3tablescatalog=org.apache.iceberg.spark.SparkCatalog --conf spark.sql.catalog.s3tablescatalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog --conf spark.sql.catalog.s3tablescatalog.glue.id=<account-id>:s3tablescatalog/<table-bucket-name> --conf spark.sql.catalog.s3tablescatalog.warehouse=<table-bucket-arn>"
```

Use `--cli-input-json file://config.json` to sidestep shell escaping issues.

**Write path (PySpark):**

```python
df.writeTo("s3tablescatalog.<namespace>.<table>").append()
```

## Standard Iceberg on General Purpose Bucket

Self-managed Iceberg tables hosted on regular S3 buckets. Compaction and snapshot cleanup are the user's responsibility.

- Catalog path: `glue_catalog.<database>.<table>` (via Glue Data Catalog)
- LOCATION clause IS required: `LOCATION 's3://<bucket>/<prefix>/'`
- Registered in the Glue Data Catalog in the standard way
- Works with Glue 5.1 or higher and `--datalake-formats iceberg` job argument
- All `spark.sql.catalog.*` configuration goes in `--conf` job arguments, never in `spark.conf.set()`

**Glue job catalog config:**

```
spark.sql.catalog.glue_catalog=org.apache.iceberg.spark.SparkCatalog
spark.sql.catalog.glue_catalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog
spark.sql.catalog.glue_catalog.warehouse=s3://<bucket>/<warehouse-prefix>/
```

The `warehouse` parameter defines the default base path used when creating new tables.

**Write path (PySpark):**

```python
df.writeTo("glue_catalog.<database>.<table>").append()
```

**Athena DDL:**

```sql
CREATE TABLE <database>.<table> (
  col1 STRING,
  col2 INT
)
LOCATION 's3://<bucket>/<prefix>/'
TBLPROPERTIES ('table_type' = 'ICEBERG')
```

## Parquet / ORC / CSV on S3

Raw files written directly to S3 with no Iceberg table metadata. Can be queried through external tables in Athena.

- No table management -- no compaction, no snapshots, no schema evolution
- An external table must be created in the Glue catalog before Athena can query the data
- Appropriate when the user explicitly wants raw files rather than a managed table

**Write path (PySpark):**

```python
# Parquet
df.write.format("parquet").mode("overwrite").save("s3://<bucket>/<prefix>/")

# ORC
df.write.format("orc").mode("overwrite").save("s3://<bucket>/<prefix>/")

# CSV
df.write.format("csv").option("header", "true").mode("overwrite").save("s3://<bucket>/<prefix>/")
```

**External table for querying:**

```sql
CREATE EXTERNAL TABLE <database>.<table> (
  col1 STRING,
  col2 INT
)
STORED AS PARQUET
LOCATION 's3://<bucket>/<prefix>/'
```

## Gotchas

- S3 Tables CREATE TABLE must NOT include a LOCATION clause. Standard Iceberg MUST include one.
- The `s3tablescatalog` federated catalog uses slash-separated paths in Athena: `"s3tablescatalog/<bucket>"."<namespace>"."<table>"`. Spark uses dot notation: `s3tablescatalog.<namespace>.<table>` (the bucket is embedded in `--conf` via `glue.id`).
- Parquet/ORC/CSV targets produce raw files only -- no Iceberg metadata is written. Schema evolution, time travel, and ACID transactions are not available for these targets.
- Discover available MCP tools through keyword search -- do not hardcode tool names.

## Engine Access Patterns

How each engine reads from and writes to each target format. Consult this section when building jobs that cross formats or when validating ingested data.

### S3 Tables

| Engine | Read | Write | Table reference |
|--------|------|-------|-----------------|
| Athena | `SELECT * FROM "s3tablescatalog/<bucket>"."<ns>"."<table>"` | INSERT INTO, CTAS | 4-level, slash-separated catalog |
| Redshift | `SELECT * FROM s3tablescatalog.<bucket>.<ns>.<table>` | INSERT (via external schema) | 4-level, dot-separated |
| Spark (Analytics Integration) | `spark.table("s3tablescatalog.<bucket>.<ns>.<table>")` | `df.writeTo("s3tablescatalog.<bucket>.<ns>.<table>")` | 4-level, bucket explicit |
| Spark (REST Endpoint) | `spark.table("<catalog>.<ns>.<table>")` | `df.writeTo("<catalog>.<ns>.<table>")` | 3-level, bucket in `--conf` warehouse |

Both Spark with Analytics Integration and Athena use 4-level paths, but Athena uses slash-separated catalog references while Spark uses dots. Spark with the REST Endpoint uses only 3 levels because the table bucket is encoded in the `--conf` warehouse ARN.

### Standard Iceberg

| Engine | Read | Write | Table reference |
|--------|------|-------|-----------------|
| Athena | `SELECT * FROM <database>.<table>` | INSERT INTO, CTAS | 2-level (default catalog) |
| Redshift | `SELECT * FROM awsdatacatalog.<database>.<table>` | INSERT (via external schema) | 3-level with catalog |
| Spark | `spark.table("glue_catalog.<database>.<table>")` | `df.writeTo("glue_catalog.<database>.<table>")` | 2-level under configured catalog name |

Standard Iceberg tables are registered in the default Glue Data Catalog. Athena can query them without a catalog prefix. Spark requires the catalog name as configured via `--conf` (e.g., `glue_catalog`).

### Parquet / ORC / CSV

| Engine | Read | Write |
|--------|------|-------|
| Athena | `SELECT * FROM <database>.<external_table>` (requires external table in Glue catalog) | Not applicable (raw files) |
| Spark | `spark.read.format("parquet").load("s3://...")` | `df.write.format("parquet").save("s3://...")` |

Spark reads require no catalog registration -- point the reader directly at the S3 path. Athena requires an external table definition in the Glue catalog before the data can be queried.

## Decision Guide

| Factor | S3 Tables | Standard Iceberg | Raw files |
|--------|-----------|-----------------|-----------|
| Automatic compaction | Yes | No (manual) | N/A |
| Snapshot management | Yes | No (manual) | N/A |
| Schema evolution | Yes | Yes | No |
| Time travel | Yes | Yes | No |
| ACID transactions | Yes | Yes | No |
| Multi-engine access | Athena, EMR, Redshift, Spark | Athena, EMR, Spark | Athena (external table) |
| Setup complexity | Low | Medium | Lowest |
| Ongoing maintenance | None | High | None |
