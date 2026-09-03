# Data Quality and Validation

Comprehensive reference for verifying data quality both during and after import into S3 Tables.

## Overview

Data quality validation confirms that ingested data satisfies expected standards for completeness, accuracy, and consistency. This reference covers:

- Glue Data Quality rules integration
- Basic post-load validation queries
- Common validation patterns
- Troubleshooting quality issues

## Glue Data Quality Rules

Embed Glue Data Quality rules directly in your ETL jobs to automate validation during the load process.

### Basic Integration

Add the following to your Glue job PySpark script:

```python
from awsglue.data_quality import DataQualityEvaluationOptions, DataQualityEvaluator
from awsglue.dynamicframe import DynamicFrame

# Define data quality rules
rules = """
    Rules = [
        RowCount > 0,
        ColumnCount == <expected_count>,
        ColumnValues "<column_name>" Completeness > 0.95,
        ColumnValues "<numeric_column>" between <min> and <max>,
        IsPrimaryKey "<id_column>",
        Uniqueness "<id_column>" > 0.99
    ]
"""

# Evaluate data quality
evaluator = DataQualityEvaluator(
    glueContext,
    rules,
    DynamicFrame.fromDF(transformed_df, glueContext, "check")
)
result = evaluator.evaluate()

# Fail job if quality checks don't pass
if result.overallResult != "PASS":
    raise Exception(f"Data quality check failed: {result}")
```

### Available Data Quality Rules

| Rule Type | Example | Description |
|-----------|---------|-------------|
| **RowCount** | `RowCount > 1000` | Minimum or maximum row count |
| **ColumnCount** | `ColumnCount == 10` | Expected number of columns |
| **Completeness** | `ColumnValues "email" Completeness > 0.95` | Non-null percentage |
| **Uniqueness** | `Uniqueness "user_id" > 0.99` | Unique value percentage |
| **IsPrimaryKey** | `IsPrimaryKey "order_id"` | Column has unique non-null values |
| **IsComplete** | `IsComplete "required_field"` | Column has no nulls |
| **ColumnValues** | `ColumnValues "age" between 0 and 120` | Value range checks |
| **DistinctValuesCount** | `DistinctValuesCount "status" in [3,5]` | Number of unique values |
| **Mean** | `Mean "price" between 10.0 and 100.0` | Average value range |
| **StandardDeviation** | `StandardDeviation "amount" < 50.0` | Variability check |

### Complete Example with Multiple Rules

```python
from awsglue.data_quality import DataQualityEvaluationOptions, DataQualityEvaluator
from awsglue.dynamicframe import DynamicFrame

# Define comprehensive data quality rules
rules = """
    Rules = [
        # Basic structure checks
        RowCount > 100,
        ColumnCount == 8,

        # Completeness checks
        IsComplete "customer_id",
        IsComplete "order_date",
        ColumnValues "email" Completeness > 0.90,

        # Uniqueness checks
        IsPrimaryKey "order_id",
        Uniqueness "customer_id" > 0.80,

        # Value range checks
        ColumnValues "quantity" between 1 and 1000,
        ColumnValues "price" between 0.01 and 10000.00,
        ColumnValues "order_date" >= "2023-01-01",

        # Statistical checks
        Mean "price" between 10.0 and 500.0,
        StandardDeviation "quantity" < 100.0,

        # Categorical checks
        ColumnValues "status" in ["pending", "completed", "cancelled"],
        DistinctValuesCount "status" == 3
    ]
"""

# Convert DataFrame to DynamicFrame for evaluation
dynamic_frame = DynamicFrame.fromDF(transformed_df, glueContext, "quality_check")

# Create evaluation options
eval_options = DataQualityEvaluationOptions(
    publishCloudWatchMetrics=True,
    publishResultsToCloudWatch=True
)

# Evaluate data quality
evaluator = DataQualityEvaluator(glueContext, rules, dynamic_frame, eval_options)
result = evaluator.evaluate()

# Check results
if result.overallResult != "PASS":
    # Log failed rules
    for rule_result in result.ruleResults:
        if rule_result.result == "FAIL":
            print(f"Failed rule: {rule_result.rule}")
            print(f"Failure reason: {rule_result.failureReason}")

    # Fail the job
    raise Exception(f"Data quality check failed: {result.overallResult}")
else:
    print("All data quality checks passed!")
```

### Conditional Quality Checks

Restrict job failures to critical issues only:

```python
# Define critical vs warning rules
critical_rules = """
    Rules = [
        IsPrimaryKey "order_id",
        IsComplete "customer_id",
        RowCount > 0
    ]
"""

warning_rules = """
    Rules = [
        ColumnValues "email" Completeness > 0.90,
        Mean "price" between 10.0 and 500.0
    ]
"""

# Evaluate critical rules (fail on failure)
critical_result = DataQualityEvaluator(glueContext, critical_rules, dynamic_frame).evaluate()
if critical_result.overallResult != "PASS":
    raise Exception(f"Critical data quality check failed")

# Evaluate warning rules (log but don't fail)
warning_result = DataQualityEvaluator(glueContext, warning_rules, dynamic_frame).evaluate()
if warning_result.overallResult != "PASS":
    print(f"Warning: Non-critical data quality issues detected")
    for rule_result in warning_result.ruleResults:
        if rule_result.result == "FAIL":
            print(f"  - {rule_result.rule}: {rule_result.failureReason}")
```

## Basic Validation Without Glue Data Quality

When Glue Data Quality is not available, run basic checks against the loaded data using Athena queries.

### 1. Row Count Validation

Confirm that data was successfully loaded:

```sql
-- Count rows in target table
SELECT COUNT(*) as row_count
FROM "<catalog>"."<namespace>"."<table>"
```

Compare the result against the source row count when available.

### 2. Null Checks

Confirm that required columns do not have an unexpectedly high null rate:

```sql
-- Check null percentages for critical columns
SELECT
    COUNT(*) as total_rows,
    SUM(CASE WHEN customer_id IS NULL THEN 1 ELSE 0 END) as null_customer_id,
    SUM(CASE WHEN order_date IS NULL THEN 1 ELSE 0 END) as null_order_date,
    SUM(CASE WHEN amount IS NULL THEN 1 ELSE 0 END) as null_amount,
    -- Calculate percentages
    CAST(SUM(CASE WHEN customer_id IS NULL THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) * 100 as pct_null_customer_id,
    CAST(SUM(CASE WHEN order_date IS NULL THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) * 100 as pct_null_order_date,
    CAST(SUM(CASE WHEN amount IS NULL THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) * 100 as pct_null_amount
FROM "<catalog>"."<namespace>"."<table>"
```

### 3. Type Validation

Spot-check that type conversions completed correctly:

```sql
-- Sample data to verify types
SELECT *
FROM "<catalog>"."<namespace>"."<table>"
LIMIT 100
```

Look for:

- Dates stored as strings (e.g., "2024-01-15" instead of DATE)
- Numbers that were left as strings
- Truncated decimals
- Unexpected null values

### 4. Duplicate Detection

Identify unexpected duplicates in key columns:

```sql
-- Find duplicate order_ids
SELECT
    order_id,
    COUNT(*) as duplicate_count
FROM "<catalog>"."<namespace>"."<table>"
GROUP BY order_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 100
```

### 5. Value Range Checks

Confirm that column values fall within acceptable bounds:

```sql
-- Check value ranges
SELECT
    MIN(order_date) as min_date,
    MAX(order_date) as max_date,
    MIN(amount) as min_amount,
    MAX(amount) as max_amount,
    MIN(quantity) as min_quantity,
    MAX(quantity) as max_quantity
FROM "<catalog>"."<namespace>"."<table>"
```

### 6. Categorical Value Checks

Confirm that categorical columns contain only the expected set of values:

```sql
-- Check distinct values in status column
SELECT
    status,
    COUNT(*) as count
FROM "<catalog>"."<namespace>"."<table>"
GROUP BY status
ORDER BY count DESC
```

The results should align with the categories present in the source data.

### 7. Statistical Checks

Retrieve basic summary statistics:

```sql
-- Calculate basic statistics
SELECT
    COUNT(*) as total_rows,
    AVG(amount) as avg_amount,
    STDDEV(amount) as stddev_amount,
    APPROX_PERCENTILE(amount, 0.5) as median_amount,
    APPROX_PERCENTILE(amount, 0.95) as p95_amount
FROM "<catalog>"."<namespace>"."<table>"
```

## Validation Reporting

### Present Results to User

Once validation queries have run, surface the results in a clear, readable format:

```
Data Load Validation Report:
✓ Row count: 1,234,567 rows loaded
✓ Null checks:
  - customer_id: 0% null (expected: 0%)
  - order_date: 0.1% null (acceptable)
  - amount: 2.3% null (within threshold)
✓ Duplicates: No duplicate order_ids found
✓ Value ranges:
  - order_date: 2023-01-01 to 2024-12-31 (expected)
  - amount: $0.01 to $9,999.99 (valid range)
  - quantity: 1 to 500 (valid range)
✓ Categorical values:
  - status: pending (45%), completed (50%), cancelled (5%)
⚠ Warning: email column has 10% null values (target: < 5%)

Overall: PASS with warnings
```

### Handle Failures

When a validation check does not pass:

```python
# In Glue job script
if result.overallResult != "PASS":
    failure_summary = []
    for rule_result in result.ruleResults:
        if rule_result.result == "FAIL":
            failure_summary.append(f"  - {rule_result.rule}: {rule_result.failureReason}")

    error_message = "Data quality validation failed:\n" + "\n".join(failure_summary)
    print(error_message)

    # Optionally send notification or write to error table
    # Then fail the job
    raise Exception(error_message)
```

## Common Validation Patterns

### Pre-Load Validation

Inspect source data before the load begins:

```python
# Sample source data
sample_df = spark.read.format("csv").option("header", "true").load(source_path).limit(1000)

# Check structure
print(f"Row count: {sample_df.count()}")
print(f"Column count: {len(sample_df.columns)}")
print(f"Columns: {sample_df.columns}")
print(f"Schema: {sample_df.printSchema()}")

# Check for issues
null_counts = sample_df.select([
    (col(c).isNull().cast("int")).alias(c) for c in sample_df.columns
]).groupBy().sum()

print("Null counts in sample:")
null_counts.show()
```

### Post-Load Reconciliation

Reconcile row counts between source and target:

```python
# Count source rows
source_count = spark.read.format("csv").option("header", "true").load(source_path).count()

# Count target rows
target_count = spark.sql(f"SELECT COUNT(*) FROM {target_table}").collect()[0][0]

# Verify match
if source_count != target_count:
    print(f"Row count mismatch: source={source_count}, target={target_count}")
    raise Exception("Row count mismatch detected")
else:
    print(f"Row count validation passed: {target_count} rows")
```

## Troubleshooting Quality Issues

### Issue: High Null Percentage

**Symptoms**: Null values exceed the expected threshold in one or more columns
**Possible causes**:

- Quality problems in the source data
- Type conversion failures (e.g., non-numeric strings coerced to null)
- Column mapping errors

**Solutions**:

1. Inspect the source data for null values
2. Confirm that type conversions are applied correctly
3. Add explicit null-handling logic to the transformation step

### Issue: Duplicate Keys

**Symptoms**: Primary key column contains duplicate values
**Possible causes**:

- Duplicates already present in the source data
- Multiple load runs executed without deduplication
- Partition keys unintentionally included in the data

**Solutions**:

1. Add deduplication logic to the Glue job
2. Use window functions to retain only the latest record per key
3. Investigate the root cause in the source system

### Issue: Value Range Violations

**Symptoms**: Column values fall outside their expected range
**Possible causes**:

- Source data contains outliers
- Errors introduced during type conversion
- Unit mismatches (e.g., dollars vs. cents)

**Solutions**:

1. Add filtering or value-capping logic to the transformation
2. Verify that unit conversions are applied correctly
3. Define validation rules to reject out-of-range values

## Best Practices

1. **Start with basic checks**: Row count and null checks surface the majority of problems
2. **Add rules incrementally**: Begin with critical rules and broaden coverage over time
3. **Use sampling for large datasets**: Validate a sample before committing to a full load
4. **Publish metrics to CloudWatch**: Activate monitoring and alerting for ongoing visibility
5. **Document thresholds**: State quality expectations explicitly so they can be reviewed
6. **Handle warnings separately from errors**: Not every issue warrants a job failure
7. **Test quality rules**: Verify that your rules reliably detect bad data

## Summary

Data quality validation workflow:

1. **Pre-load validation**: Sample and inspect the source data
2. **In-load validation**: Apply Glue Data Quality rules during the ETL run
3. **Post-load validation**: Execute Athena queries to verify the loaded results
4. **Reconciliation**: Compare row counts between source and target
5. **Reporting**: Surface clear validation outcomes to the user

Thorough validation ensures that data written to S3 Tables consistently meets the required quality standards.
