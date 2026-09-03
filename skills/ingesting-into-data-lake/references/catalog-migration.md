# Catalog Migration to S3 Tables

Move existing Glue Data Catalog tables into Amazon S3 Tables. Source tables may be in Hive format, self-managed Iceberg, or any other format readable by Athena. The outcome is a fully managed S3 Table with automatic compaction, snapshot management, and access from multiple engines.

## Reference Documentation

- [ctas-patterns.md](ctas-patterns.md) -- Athena CTAS syntax for S3 Tables, format options, partition transforms
- [migration-validation.md](migration-validation.md) -- Row count, schema, and data integrity checks
- [glue-etl-migration.md](glue-etl-migration.md) -- Glue 5.1 or higher PySpark migration for large tables
- [migration-troubleshooting.md](migration-troubleshooting.md) -- Common errors and fixes

## Why Migrate?

Self-managed Iceberg and Hive tables demand manual compaction, snapshot cleanup, and storage optimization. S3 Tables takes care of all of this automatically. Migration also activates the four-part catalog hierarchy (`s3tablescatalog/<bucket>/<namespace>/<table>`), which enables unified access from Athena, EMR, Redshift, and Spark.

Note: The destination for catalog migration is always S3 Tables -- that is the sole purpose of this workflow.

## Workflow

### Phase 1: Understand the Source

1. **Identify the source table**: Obtain the fully qualified name (`database.table` or `catalog.database.table`). If the user provides a vague or business-oriented name ("our orders table", "the sales data"), delegate to the `finding-data-lake-assets` skill to resolve it first -- the remainder of this workflow requires a concrete table reference.
2. **Inspect the source**:
   - **With MCP**: Use `aws-mcp` to retrieve table metadata (format, location, schema, partitions)
   - **Without MCP**: `aws glue get-table --database-name <db> --name <table>`
3. **Classify the source format**:
   - **Hive (CSV, Parquet, ORC, JSON, Avro)**: Standard external table backed by an S3 general purpose bucket
   - **Self-managed Iceberg**: Iceberg table in a general purpose bucket with manually managed maintenance
   - **Other**: Any format Athena is capable of querying (federated sources, etc.)
4. **Assess size and complexity**:
   - **Small/medium** (under ~100 GB, simple schema): Path A (Athena CTAS) -- a single SQL statement
   - **Large** (over ~100 GB, complex transforms, or requires scheduling): Path B (Glue ETL)
   - **Partitioned source**: Record the partition columns and plan a conversion strategy

### Phase 2: Prepare the Target

1. **Ensure table bucket exists**: Verify with `aws s3tables list-table-buckets`. If none is present, delegate to [creating-data-lake-table](../../creating-data-lake-table/SKILL.md) Phase 2.
2. **Ensure analytics integration is enabled**: Confirm that `s3tablescatalog` exists. If it is not set up, delegate to [creating-data-lake-table](../../creating-data-lake-table/SKILL.md) Phase 2, step 4.
3. **Create or select namespace**: Use an existing namespace or create a new one with `aws s3tables create-namespace`.
4. **Plan partition strategy**: Iceberg supports hidden partition transforms (`day()`, `month()`, `year()`, `hour()`, `bucket()`). Where feasible, convert Hive-style explicit partition columns to the equivalent Iceberg transforms.

### Phase 3: Migrate the Data

#### Path A: Athena CTAS (default for small/medium tables)

A single SQL statement that both creates the S3 Table and loads it in one operation. See [ctas-patterns.md](ctas-patterns.md) for complete syntax and examples.

Key points:

- Target path: `"s3tablescatalog/<table_bucket_name>"."<namespace>"."<new_table_name>"`
- Default format: `PARQUET`. Also supports `AVRO`, `ORC`.
- Use Iceberg partition transforms (`day()`, `month()`, `bucket()`) rather than Hive-style explicit partition columns.
- No `LOCATION` clause -- S3 Tables manages its own storage.
- Table and column names must be entirely lowercase.
- The source catalog for default GDC tables is `awsdatacatalog`.
- Include `WHERE` filters to migrate subsets or to break large migrations into batches.

#### Path B: Glue ETL (for large tables or complex transforms)

Use this path when CTAS would time out, when transforms are non-trivial, or when the migration must be scheduled or repeatable.

1. **Create a PySpark script** that reads from the source and writes to the S3 Table
2. **Create a Glue 5.1 or higher job** with `--datalake-formats iceberg` and `--conf` catalog config
3. **Run and monitor** the job

See [glue-etl-migration.md](glue-etl-migration.md) for job configuration, the PySpark script template, and catalog setup details.

### Phase 4: Validate the Migration

Run all of these checks -- do not skip any:

1. **Row count comparison**:

   ```sql
   SELECT 'source' AS tbl, COUNT(*) AS cnt FROM "<source_catalog>"."<source_db>"."<source_table>"
   UNION ALL
   SELECT 'target' AS tbl, COUNT(*) AS cnt FROM "s3tablescatalog/<bucket>"."<namespace>"."<new_table>"
   ```

2. **Schema comparison**: Confirm that column names, types, and ordering match expectations. Minor type promotions (e.g., `int` to `bigint`) are acceptable.

3. **Spot-check data**: Compare a sample of rows from source and target, focusing on:
   - Boundary values (min/max of numeric and date columns)
   - Null counts per column
   - Distinct counts on key columns

4. **Partition verification** (if partitioned):

   ```sql
   SELECT <partition_column>, COUNT(*) FROM "s3tablescatalog/<bucket>"."<namespace>"."<new_table>"
   GROUP BY 1 ORDER BY 1
   ```

See [migration-validation.md](migration-validation.md) for the full checklist.

### Phase 5: Post-Migration Guidance

Once validation has passed:

1. **Update downstream consumers**: Share the new table path for use in queries, dashboards, and ETL jobs.
2. **Recommend retaining the source table** temporarily as a rollback option. Propose a retention window (e.g., 30 days).
3. **Do NOT drop the source table**. Inform the user and leave the cleanup decision to them.
4. **Evaluate table lineage**: If lineage data exists for the source table, use it to identify recommended next steps for both producers and consumers.

## Gotchas

- Athena CTAS is limited to 100 partitions per statement. For sources with more than 100 partitions, either migrate in batches using `WHERE` filters or switch to Glue ETL (Path B).
- CTAS produces a new table -- it does not perform an in-place conversion. The source table is left unchanged.
- Column names containing uppercase letters will make the target table invisible to analytics services. Always alias them to lowercase in the SELECT: `SELECT upper_Col AS upper_col`.
- Self-managed Iceberg tables may carry schema evolution history (added or renamed columns). CTAS captures only the current schema -- the evolution history is not carried over.
- Hive tables with complex SerDe configurations (custom delimiters, regex SerDe) should be validated first with a small CTAS to confirm Athena can read them. Glue often succeeds where Athena cannot. Fall back to Glue if Athena fails.
- Time travel on the source Iceberg table is not available after migration. The S3 Table begins with its own fresh snapshot history.

## Troubleshooting

See [migration-troubleshooting.md](migration-troubleshooting.md) for common errors and resolutions, including CTAS failures, validation mismatches, visibility problems, and partition issues.
