# Type Transformation and Conflict Resolution Reference

This document explains the expected approaches for resolving type conflicts and applying transformations during data import.

## Type Conflict Detection

### What is a Type Conflict?

A type conflict arises when:

1. **Target table exists** with an established schema
2. **Source data** contains a column with a **mismatched type**
3. **A direct load would fail** without a prior transformation

### Common Type Conflicts

| Source Type | Target Type | Example Conflict |
|-------------|-------------|------------------|
| STRING | INT/DECIMAL | "$29.99" → 29.99 |
| STRING | DATE/TIMESTAMP | "2024-01-15" → DATE |
| INT | STRING | 12345 → "12345" |
| STRING | BOOLEAN | "true"/"false" → TRUE/FALSE |
| DECIMAL | INT | 29.99 → 29 (loses precision) |

## Expected User Interaction

When a type conflict is detected, the skill must:

### 1. Clearly Identify the Conflict

```
[!] Type Conflict Detected:

Column: price
Source Type: STRING (contains values like "$29.99", "$149.50")
Target Type: DECIMAL(10,2)

This conflict must be resolved before the import can proceed.
```

### 2. Present Clear Options

```
How would you like to handle this?

Option 1: Transform/Cast - Strip the $ symbol and cast STRING to DECIMAL
  - Pros: All valid data is preserved
  - Cons: Invalid values may cause the import to fail
  - Example: "$29.99" → 29.99

Option 2: Skip Invalid Rows - Drop rows where the transformation fails
  - Pros: Import continues even when some rows contain bad data
  - Cons: Some rows may be lost
  - Example: "$29.99" → 29.99, "N/A" → skipped

Option 3: Fail Import - Abort if any invalid values are encountered
  - Pros: Guarantees data quality
  - Cons: Source data must be corrected first
  - Example: Halts immediately on the first invalid value

Which option do you prefer?
```

### 3. Wait for User Decision

Do NOT silently apply a transformation without explicit user confirmation.

## Transformation Patterns

### STRING → Numeric (INT/DECIMAL)

**PySpark**:

```python
from pyspark.sql.functions import regexp_replace, col

# Remove non-numeric characters except decimal point
transformed_df = source_df.withColumn(
    "price",
    regexp_replace(col("price"), "[^0-9.]", "").cast("decimal(10,2)")
)

# With validation (skip invalid)
from pyspark.sql.functions import when

transformed_df = source_df.withColumn(
    "price",
    when(
        regexp_replace(col("price"), "[^0-9.]", "").rlike("^[0-9.]+$"),
        regexp_replace(col("price"), "[^0-9.]", "").cast("decimal(10,2)")
    ).otherwise(None)
).filter(col("price").isNotNull())
```

**Athena SQL**:

```sql
SELECT
  CAST(regexp_replace(price, '[^0-9.]', '') AS DECIMAL(10,2)) AS price
FROM source_table
WHERE regexp_replace(price, '[^0-9.]', '') <> ''
```

### STRING → DATE/TIMESTAMP

**PySpark**:

```python
from pyspark.sql.functions import to_date, to_timestamp

# Simple date parsing
transformed_df = source_df.withColumn(
    "signup_date",
    to_date(col("signup_date"), "yyyy-MM-dd")
)

# Timestamp with timezone
transformed_df = source_df.withColumn(
    "event_timestamp",
    to_timestamp(col("event_timestamp"), "yyyy-MM-dd HH:mm:ss")
)

# Multiple format attempts
from pyspark.sql.functions import coalesce

transformed_df = source_df.withColumn(
    "date_field",
    coalesce(
        to_date(col("date_field"), "yyyy-MM-dd"),
        to_date(col("date_field"), "MM/dd/yyyy"),
        to_date(col("date_field"), "dd-MMM-yyyy")
    )
)
```

**Athena SQL**:

```sql
SELECT
  DATE_PARSE(date_string, '%Y-%m-%d') AS parsed_date,
  FROM_ISO8601_TIMESTAMP(timestamp_string) AS parsed_timestamp
FROM source_table
```

### STRING → BOOLEAN

**PySpark**:

```python
from pyspark.sql.functions import when, upper

transformed_df = source_df.withColumn(
    "is_active",
    when(upper(col("is_active")).isin("TRUE", "T", "YES", "Y", "1"), True)
    .when(upper(col("is_active")).isin("FALSE", "F", "NO", "N", "0"), False)
    .otherwise(None)
)
```

**Athena SQL**:

```sql
SELECT
  CASE
    WHEN UPPER(is_active) IN ('TRUE', 'T', 'YES', 'Y', '1') THEN TRUE
    WHEN UPPER(is_active) IN ('FALSE', 'F', 'NO', 'N', '0') THEN FALSE
    ELSE NULL
  END AS is_active
FROM source_table
```

### Numeric → STRING

**PySpark**:

```python
# Simple cast
transformed_df = source_df.withColumn(
    "id_as_string",
    col("id").cast("string")
)

# With formatting
from pyspark.sql.functions import format_string

transformed_df = source_df.withColumn(
    "price_formatted",
    format_string("$%.2f", col("price"))
)
```

### Handling NULL Values

**PySpark**:

```python
from pyspark.sql.functions import coalesce, lit

# Provide default for nulls
transformed_df = source_df.withColumn(
    "quantity",
    coalesce(col("quantity"), lit(0))
)

# Filter out nulls in critical columns
transformed_df = source_df.filter(
    col("customer_id").isNotNull() &
    col("order_date").isNotNull()
)
```

## Complete Transformation Example

### Scenario
The source CSV contains:

- `price` as STRING with a "$" prefix
- `signup_date` as STRING in "YYYY-MM-DD" format
- `is_active` as STRING with values "true"/"false"

The target table expects:

- `price` as DECIMAL(10,2)
- `signup_date` as DATE
- `is_active` as BOOLEAN

### Glue ETL Script

```python
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql.functions import regexp_replace, to_date, when, upper, col

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'source_path', 'target_table'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Read source CSV
source_df = spark.read.format("csv") \
    .option("header", "true") \
    .load(args['source_path'])

# Apply transformations
transformed_df = source_df \
    .withColumn(
        "price",
        regexp_replace(col("price"), "[^0-9.]", "").cast("decimal(10,2)")
    ) \
    .withColumn(
        "signup_date",
        to_date(col("signup_date"), "yyyy-MM-dd")
    ) \
    .withColumn(
        "is_active",
        when(upper(col("is_active")) == "TRUE", True)
        .when(upper(col("is_active")) == "FALSE", False)
        .otherwise(None)
    )

# Filter out rows with failed transformations
clean_df = transformed_df.filter(
    col("price").isNotNull() &
    col("signup_date").isNotNull() &
    col("is_active").isNotNull()
)

# Log filtered count
original_count = source_df.count()
clean_count = clean_df.count()
print(f"Original rows: {original_count}")
print(f"Clean rows: {clean_count}")
print(f"Filtered out: {original_count - clean_count}")

# Write to Iceberg table
clean_df.writeTo(args['target_table']).append()

job.commit()
```

## Evaluation Criteria

Use these criteria when assessing type conflict resolution:

**Detection**:

- The skill compares the source schema against the target schema
- Specific columns with type mismatches are identified
- The conflict is clearly communicated to the user

**User Interaction**:

- At least 2-3 options are presented for resolving the conflict
- The pros and cons of each option are explained
- The skill waits for the user's decision before proceeding
- Transformations are never applied silently without confirmation

**Transformation Code**:

- Complete PySpark or SQL code is provided for the transformation
- Edge cases are handled (null values, invalid formats)
- Data quality filters are included when the "skip invalid" option is chosen
- Row counts are logged (original count vs. transformed count)

**Validation**:

- The transformation is tested against sample data first
- Transformed types are confirmed to match the target schema
- Success or failure is reported clearly

## Common Mistakes to Avoid

Applying transformations silently without user consent
Failing to detect type conflicts before attempting the import
Writing transformation code that lacks null handling
Omitting logs showing how many rows were filtered out
Assuming source data is valid without performing validation
Failing to provide a fallback for invalid values
Using a generic cast without cleaning data first (e.g., "$29.99" → cast fails)
