# S3 File Import

Load structured data files (CSV, TSV, JSON, Parquet, Avro, ORC) from S3 into tables.

## Workflow

### Phase 0: Understand Intent and Check Tools

1. **Detect load pattern**: One-time ("load this file") vs recurring ("set up a pipeline", "keep updated")
2. **Choose approach**: Glue ETL (default, schedulable) vs Athena (fallback for simple one-time loads)
3. **Require Glue 5.1 or higher** for all Iceberg targets (S3 Tables and standard Iceberg).
4. **Discover available MCP tools**: Search by keyword for S3 Tables MCP, Data Processing MCP, and IAM MCP — do not hardcode tool names.

Use MCP tools whenever they are available. Fall back to the AWS CLI only if MCP tool discovery returns no matching tools.

### Phase 1: Discover Source Data

1. **Identify source**: Ask the user for the S3 path and file format (CSV, JSON, Parquet, Avro, ORC)
2. **Sample files**: List and retrieve samples to understand the data structure
3. **Detect partitions**: For Parquet/ORC, look for Hive-style partitioning (`year=2024/month=01/`)

Format-specific guidance: See [format-specific-loading.md](format-specific-loading.md)

### Phase 2: Infer and Validate Schema

1. **Build schema**: CSV (headers + sample values), JSON (type mapping), Parquet/Avro/ORC (embedded schema)
2. **Map types**: Translate source types to target types (e.g., STRING to INT/DATE/TIMESTAMP based on content). See [type-transformations.md](type-transformations.md).
3. **Handle conflicts**: New columns (schema evolution via ALTER TABLE), type mismatches (cast/skip/fail), missing columns (ask the user: use NULL or fail)
4. **Nested JSON/arrays** (if detected): Ask the user which approach to take before proceeding:
   - **Flatten** -- Expand structs into individual columns, explode arrays into separate rows
   - **Preserve** -- Retain as STRUCT/ARRAY types
   - Do not continue until the user has decided.

Schema evolution and nested data: See [schema-evolution.md](schema-evolution.md)

### Phase 3: Set Up or Verify Target Table

1. **Check if table exists** via MCP or CLI
2. **Create table if needed**: Delegate to [creating-data-lake-table](../../creating-data-lake-table/SKILL.md) for all target types. Provide the target format (S3 Tables, standard Iceberg, or raw files) and schema. See [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md) for target-specific catalog configuration needed by the subsequent Glue job.
3. **Evolve schema if needed**: Compare schemas, generate ALTER TABLE ADD COLUMNS statements, and execute them via Athena

### Phase 3.5: Verify or Create IAM Role for Glue

1. **Check for an existing role**: Look for `AWSGlueServiceRole-*` or `GlueServiceRole-*`
2. **Verify permissions**: AWSGlueServiceRole managed policy, S3 access, and S3 Tables inline policy (if the target is S3 Tables)
3. **Create role if needed**: Add a trust policy for `glue.amazonaws.com`, attach the required policies, and capture the role ARN

Complete IAM setup: Handled by [creating-data-lake-table](../../creating-data-lake-table/SKILL.md).

### Phase 4: Execute Data Load

#### Path A: Glue ETL (Primary)

Write a PySpark script, create a Glue job using the catalog config from [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md), run the job to test it, and schedule it for recurring use if needed.

**When to use**: The default path for most loads. Required for recurring/scheduled imports, complex transformations, and large datasets (millions of rows or more).

Guides: [format-specific-loading.md](format-specific-loading.md), [glue-job-config.md](glue-job-config.md), [glue-job-scripts.md](glue-job-scripts.md)

#### Path B: Athena (Fallback)

Create an external table, write an INSERT INTO query with the needed transformations, execute and monitor it, then clean up.

**When to use**: Simple one-time loads only. Small to medium datasets. SQL transformations are sufficient.

Guide: [athena-loading.md](athena-loading.md)

### Phase 5: Validate Data Load

1. Row count validation
2. Null checks on critical columns
3. Type validation using a sample check
4. Spot-check rows of data

See [data-quality-validation.md](data-quality-validation.md)

### Phase 6: Report Results

Deliver a summary covering: what was loaded, how to query the data, any issues encountered, and recommended next steps.

## Decision Trees

### Glue ETL vs Athena

**Use Glue ETL** when: loads recur on a schedule, transforms are complex, datasets are large, format-specific handling is required, or data quality validation is needed.

**Use Athena** when: it is a simple one-time load, the dataset is small or medium, SQL transforms are sufficient, or Glue is unavailable.

### Glue Triggers vs MWAA

**Use Glue Triggers** (most cases): single job, straightforward schedule, no complex dependencies.

**Use MWAA/Airflow** (advanced): multiple sources that must load in a coordinated sequence, complex dependencies, or branching logic.

## Argument Routing

- **S3 path only**: Treat as a one-time load and proceed with discovery
- **S3 path + table name**: Verify whether the table exists, infer the schema, and execute the load
- **"--recurring" or "--pipeline"**: Force a recurring pipeline via Glue
- **No args**: Walk the user through the workflow interactively

## Gotchas

- S3 Tables requires Glue 5.1 or higher. Standard Iceberg also requires Glue 5.1 or higher for full Iceberg compatibility.
- A CREATE TABLE targeting S3 Tables must NOT include a LOCATION clause. Standard Iceberg MUST include one.
- When creating tables for an S3 Tables import, use the Spark DDL path (Path B) in creating-data-lake-table to ensure the Glue catalog is correctly configured.
- Target-specific catalog configuration and Glue version requirements are documented in [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md).

## References

- [format-specific-loading.md](format-specific-loading.md)
- [type-transformations.md](type-transformations.md)
- [schema-evolution.md](schema-evolution.md)
- [data-quality-validation.md](data-quality-validation.md)
- [athena-loading.md](athena-loading.md)
- [error-handling.md](error-handling.md)
- [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md)
- [glue-job-config.md](glue-job-config.md)
- [glue-job-scripts.md](glue-job-scripts.md)
