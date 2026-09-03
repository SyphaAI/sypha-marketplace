# Error Handling and Troubleshooting

Comprehensive guide for resolving common errors and issues that arise during data import into S3 Tables.

## Overview

This reference catalogs errors that can occur across the data import workflow, organized by phase and severity.

**Connection errors are out of scope for this skill.** JDBC/Snowflake/BigQuery connection failures -- including timeouts, authentication failures, missing drivers, and SSL errors -- fall under `connecting-to-data-source`. When a Glue job fails with a connection-level error, delegate troubleshooting to that skill rather than diagnosing it here.

## Common Issues by Category

### Schema Mismatch Errors

**Symptoms**:

- Type conversion failures during the load
- Column count discrepancies between source and target
- Data truncation warnings
- Null values appearing where they are not expected

**Root Causes**:

- Source data types are incompatible with the target Iceberg types
- The source contains new columns that do not exist in the target table
- Columns present in the target are absent from the source
- Incompatible type conversions (e.g., string → int when non-numeric values are present)

**Solutions**:

1. **Type mismatch - safe to cast**:
   - Present the conflict to the user with representative example values
   - Offer to add an explicit CAST to the transformation
   - See [type-transformations.md](type-transformations.md) for casting patterns

2. **Type mismatch - cannot cast**:
   - Display sample problematic values
   - Options:
     - Filter out invalid rows
     - Store as STRING and convert later
     - Fix the source data and re-import
   - Allow the user to choose based on the importance of the data

3. **New columns in source**:
   - Propose schema evolution via ALTER TABLE ADD COLUMNS
   - Display the proposed schema change before applying it
   - Execute the evolution only after the user approves
   - See [schema-evolution.md](schema-evolution.md)

4. **Missing columns in source**:
   - Ask the user how to proceed:
     - Supply default values (e.g., NULL, 0, empty string)
     - Skip the missing columns if they are nullable
     - Fail the load if the columns are critical

**Example Error Message to Present**:

```
Schema Mismatch Detected:
- Column "age": Source type STRING, Target type INT
  Sample values: "25", "thirty", "42", "unknown"
  Issue: Values "thirty" and "unknown" cannot convert to INT

Options:
1. Filter out rows with non-numeric ages (loses ~5% of data)
2. Store age as STRING in target table (requires schema change)
3. Replace non-numeric values with NULL (preserves all rows)

Which approach would you prefer?
```

### Permission Errors

**Symptoms**:

- Access Denied responses from AWS services
- IAM role assumption failures
- S3 bucket access errors
- Glue job terminating with permission-related errors

**Root Causes**:

- IAM policies missing from the Glue service role
- S3 bucket policies that deny access
- S3 Tables permissions not configured on the role
- Cross-account access not properly established

**Solutions**:

1. **Glue service role missing policies**:
   - Confirm the role has the AWSGlueServiceRole managed policy attached
   - Confirm the role has S3 read/write permissions
   - Confirm the role carries an S3 Tables inline policy
   - See [iam-role-management.md](iam-role-management.md) for the complete setup

2. **S3 bucket access denied**:
   - Confirm the IAM role has s3:GetObject and s3:ListBucket on the source bucket
   - Confirm the IAM role has s3:PutObject on the script and results buckets
   - Ensure S3 bucket policies do not explicitly deny the role
   - For cross-account access: confirm the bucket policy allows the role's ARN

3. **S3 Tables access denied**:
   - Confirm the inline policy includes:
     - s3tables:PutTableData
     - s3tables:GetTableMetadataLocation
     - s3tables:GetTable
     - s3tables:UpdateTableMetadataLocation
   - Confirm the resource ARN matches the table bucket structure
   - See [iam-role-management.md](iam-role-management.md#s3-tables-inline-policy)

4. **Athena query execution errors**:
   - Confirm the workgroup has an output location configured
   - Confirm the IAM policy grants athena:StartQueryExecution
   - Confirm the IAM policy grants s3:PutObject on the results bucket

**Example Error Message to Present**:

```
Permission Error Detected:
Glue job failed with: "Access Denied" when writing to table

Root cause: IAM role "GlueServiceRole-import" is missing S3 Tables permissions

Required actions:
1. Add inline policy to role with s3tables:PutTableData permission
2. Resource ARN should be: arn:aws:s3tables:us-east-1:123456789012:bucket/my-table-bucket/namespace/my-namespace/table/*

Would you like me to add this policy to the role?
```

### Data Quality Failures

**Symptoms**:

- Glue Data Quality rules do not pass
- Row counts differ from expected values
- High null percentages in critical columns
- Duplicate primary keys found in the data

**Root Causes**:

- Quality problems in the source data
- Errors in the transformation logic
- Incorrect schema inference
- Data quality rules that are overly strict

**Solutions**:

1. **Row count mismatch**:
   - Compare the source and target row counts directly
   - Review Glue job logs for filtering operations or errors
   - Confirm no duplicate write operations were executed
   - Check whether partitioned data was only partially loaded

2. **High null percentage**:
   - Identify which columns have unexpectedly high null rates
   - Determine whether type conversion failures are producing nulls
   - Ask the user whether the nulls are acceptable or whether the source needs to be corrected
   - Adjust data quality thresholds if the current limits are too strict

3. **Duplicate keys**:
   - Display a sample of the duplicate values
   - Options:
     - Introduce deduplication logic (retain the latest or first occurrence)
     - Investigate the source system for the root cause
     - Fail the load and address the issue at the source
   - Add DISTINCT or a window function to the transformation

4. **Data quality rule failures**:
   - Show which rules failed and explain why
   - Distinguish between critical failures and warnings
   - Options:
     - Relax rule thresholds if they are too restrictive
     - Fix the source data if the data is genuinely bad
     - Continue with warnings if the failing rules are non-critical
   - See [data-quality-validation.md](data-quality-validation.md)

**Example Error Message to Present**:

```
Data Quality Check Failed:
- Rule: IsPrimaryKey "order_id"
- Failure: Found 127 duplicate order_ids (0.5% of total rows)
- Sample duplicates: [10234, 10567, 10892, ...]

This could indicate:
1. Source data has duplicates (check data generation process)
2. Multiple loads without deduplication
3. Partition key included in order_id

Options:
1. Add deduplication keeping the latest record by timestamp
2. Investigate source system for root cause
3. Proceed with warning (not recommended for primary key)

How would you like to proceed?
```

### Large Dataset Timeouts (Athena)

**Symptoms**:

- Athena query exceeds the 30-minute timeout
- Query runs out of memory
- S3 read throttling errors

**Root Causes**:

- Dataset is too large to process in a single Athena query
- Athena engine size is insufficient for the workload
- A large number of small files causes S3 throttling
- Complex transformations are being executed within a single query

**Solutions**:

1. **Break into batches**:
   - Partition the load by date range or partition key
   - Execute multiple INSERT queries in sequence
   - Example: Load one calendar month per query

2. **Switch to Glue ETL**:
   - Glue handles larger datasets efficiently by distributing work across multiple workers
   - A better fit for datasets exceeding 1 GB or containing millions of rows
   - Offers improved monitoring and built-in retry logic
   - See [format-specific-loading.md](format-specific-loading.md) for Glue examples

3. **Increase Athena capacity**:
   - Upgrade to the Athena v3 engine
   - Raise the DPU allocation in the workgroup settings
   - Evaluate Athena provisioned capacity for workloads with repeated large queries

4. **Optimize file structure**:
   - Consolidate many small files using Glue ETL
   - Switch to columnar formats such as Parquet or ORC
   - Partition large datasets by date or region

**Example Error Message to Present**:

```
Athena Query Timeout:
Query exceeded 30-minute limit loading 5.2GB of data

Recommendations:
1. Switch to Glue ETL (recommended for datasets > 1GB)
   - Can handle 5.2GB with 5 G.1X workers in ~15 minutes
   - Better error handling and monitoring

2. Batch the load by date partition
   - Load 2024-01 through 2024-06 separately (6 queries)
   - Each query would handle ~850MB

Would you like me to:
A) Create a Glue ETL job for this load (recommended)
B) Set up batched Athena queries by month
```

### Format-Specific Issues

#### CSV Parsing Errors

**Symptoms**:

- Columns are shifted or misaligned
- Quoted values are not parsed correctly
- Extra or missing columns in the output

**Solutions**:

- Confirm the delimiter setting matches the actual file (comma, tab, or pipe)
- Set `.option("quote", "\"")` to handle quoted fields
- Set `.option("escape", "\\")` to handle escaped characters
- Use `.option("mode", "DROPMALFORMED")` to skip rows with parse errors
- See [format-specific-loading.md](format-specific-loading.md#csv-issues)

#### JSON Parsing Errors

**Symptoms**:

- Multi-line JSON objects are not being parsed
- Nested structures are flattened incorrectly
- Malformed JSON records cause the job to fail

**Solutions**:

- Set `.option("multiLine", "true")` when JSON objects span multiple lines
- Use `.option("mode", "PERMISSIVE")` to tolerate malformed records
- Confirm the JSON schema matches the expected structure
- For JSONL, ensure there is exactly one JSON object per line
- See [format-specific-loading.md](format-specific-loading.md#json-issues)

#### Parquet Partition Issues

**Symptoms**:

- Partition columns are not detected automatically
- Schema evolution errors appear during reads
- Partitions are missing from query results

**Solutions**:

- Confirm the S3 paths follow Hive-style partitioning (key=value/)
- Use `.option("mergeSchema", "true")` to accommodate schema evolution
- Ensure partition column names are consistent across all files
- List the S3 paths to verify the expected partition structure
- See [format-specific-loading.md](format-specific-loading.md#parquet-issues)

#### Avro Library Errors

**Symptoms**:

- "Avro library not found" error at runtime
- Complex union types fail to parse
- Schema registry connection errors

**Solutions**:

- Add `--datalake-formats: iceberg,avro` to the Glue job arguments
- Alternatively, supply the spark-avro JAR via `--extra-jars`
- Convert complex unions to STRING or address them with conditional logic
- See [format-specific-loading.md](format-specific-loading.md#avro-issues)

## Error Severity Levels

### Critical (Fail Immediately)

The following conditions must halt the workflow immediately:

- IAM role does not exist or cannot be assumed
- Source S3 path does not exist or is empty
- Target table exists with an incompatible schema that cannot be evolved
- Primary key violations detected in data quality checks

**Action**: Present the error clearly, supply remediation steps, and wait for the user to act before continuing.

### Warnings (Proceed with Caution)

The following issues should be flagged but need not stop execution:

- High null percentage in optional columns
- Data quality warnings triggered by non-critical rules
- Schema evolution required (user approval needed before applying)
- Source files contain malformed records, but the majority are valid

**Action**: Display the warning with full details and ask the user whether to continue.

### Informational

The following are expected behaviors that require no action:

- Falling back to CLI because MCP is unavailable
- Sampling large files during schema inference
- Automatically inferring the schema from the source
- Creating an IAM role because none exists yet

**Action**: Log for user visibility and continue automatically.

## Troubleshooting Workflow

When an error occurs, follow these steps:

1. **Identify the phase**: Determine which workflow phase failed
2. **Read the error**: Retrieve the full error message from CloudWatch or Athena
3. **Check permissions**: Confirm the IAM role has all required policies attached
4. **Validate data**: Sample the source data to assess format and quality
5. **Review configuration**: Inspect Glue job arguments and Athena settings
6. **Consult logs**: Check CloudWatch logs for detailed stack traces
7. **Search references**: Look up the relevant reference document for the error type

## Getting Help

When surfacing errors to users:

1. **Be specific**: Display the exact error message and the location where it occurred
2. **Provide context**: Describe what operation was underway when the error appeared
3. **Offer solutions**: Present 2-3 concrete, actionable options
4. **Show impact**: Explain the consequences of each option the user might choose
5. **Ask clearly**: Make the required choice or next step unambiguous

## Best Practices

1. **Validate early**: Verify permissions and schema before the load begins
2. **Sample first**: Test with a small subset of data before running the full load
3. **Monitor actively**: Watch CloudWatch logs throughout execution
4. **Handle gracefully**: Surface errors explicitly -- never let jobs fail silently
5. **Document issues**: Maintain a record of common errors and their resolutions
6. **Test transformations**: Verify type casts and filter logic against sample data

## Summary

Error handling workflow:

1. **Detect error** - Identify the error type and its severity
2. **Diagnose root cause** - Review logs, permissions, and data
3. **Present clearly** - Show the error and relevant context to the user
4. **Offer solutions** - Provide 2-3 actionable options
5. **Execute fix** - Apply the chosen solution and retry
6. **Validate resolution** - Confirm the error is fully resolved

Thorough error handling allows the skill to guide users through problems with confidence and ensure data is ultimately loaded successfully.
