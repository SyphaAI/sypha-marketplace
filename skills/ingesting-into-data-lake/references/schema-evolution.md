# Schema Evolution and Nested Structure Handling Reference

This document outlines the expected approaches for managing schema evolution and nested JSON/struct data during imports.

## Schema Evolution

### What is Schema Evolution?

Schema evolution happens when source data contains columns that are absent from the target table. This situation is common when:

- The source data schema changes over time (new fields are added)
- Data is imported from multiple sources with differing schemas
- Business requirements shift and new data points are introduced

### Types of Schema Changes

| Change Type | Example | Handling |
|-------------|---------|----------|
| New columns | Source has `phone_number`, table doesn't | ALTER TABLE ADD COLUMNS |
| Missing columns | Table has `country`, source doesn't | Use NULL or default value |
| Type changes | Source `price` is STRING, was INT | Type conflict resolution (see type-transformations.md) |
| Column rename | Source has `customer_name`, table has `name` | Manual mapping or user decision |

## Schema Evolution Workflow

### 1. Detect Schema Differences

```python
# Get current table schema from Glue Catalog
import boto3
glue = boto3.client('glue')

response = glue.get_table(
    DatabaseName='my_database',
    Name='my_table'
)

existing_columns = {col['Name']: col['Type'] for col in response['Table']['StorageDescriptor']['Columns']}

# Compare with source schema
source_columns = {'customer_id': 'int', 'name': 'string', 'email': 'string', 'phone': 'string'}  # Inferred

new_columns = set(source_columns.keys()) - set(existing_columns.keys())
missing_columns = set(existing_columns.keys()) - set(source_columns.keys())
```

Sample output to present to the user:

```
Schema Comparison:

Existing table columns: customer_id, name, email
Source data columns: customer_id, name, email, phone

New columns in source (will be added): phone
Missing columns in source (will be NULL): None

Schema evolution will automatically add the new columns to the table.
```

### 2. Add New Columns via ALTER TABLE

**With AWS CLI**:

```bash
aws athena start-query-execution \
  --query-string "ALTER TABLE \"catalog\".\"namespace\".\"table\" ADD COLUMNS (phone STRING)" \
  --query-execution-context Database=namespace \
  --result-configuration OutputLocation=s3://bucket/results/ \
  --region us-east-1
```

### 3. Handle Missing Columns

When the source is missing columns that the target table already has, two approaches are available:

**Option 1: Use NULL for missing columns** (recommended) — Incoming rows will contain NULL for these columns. Existing rows retain their current values.

**Option 2: Fail the import** — Guarantees data completeness. Requires the source to supply all expected columns.

## Nested JSON Handling

### Flatten vs Preserve Decision

When the source data contains nested structures:

```json
{
  "order_id": 12345,
  "customer": {
    "customer_id": 789,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "items": [
    {"product_id": 456, "quantity": 2, "price": 29.99}
  ]
}
```

### Flattening Implementation

**PySpark - Flatten Struct**:

```python
from pyspark.sql.functions import col

flattened_df = source_df.select(
    col("order_id"),
    col("customer.customer_id").alias("customer_id"),
    col("customer.name").alias("customer_name"),
    col("customer.email").alias("customer_email"),
    col("order_date"),
    col("total")
)
```

**PySpark - Explode Array**:

```python
from pyspark.sql.functions import explode, col

# One row per item
exploded_df = source_df.select(
    col("order_id"),
    col("customer.customer_id").alias("customer_id"),
    explode(col("items")).alias("item")
).select(
    "order_id",
    "customer_id",
    col("item.product_id"),
    col("item.quantity"),
    col("item.price")
)
```

**Athena SQL - Flatten with UNNEST**:

```sql
-- Create external table with nested types
CREATE EXTERNAL TABLE orders_nested (
  order_id BIGINT,
  customer STRUCT<customer_id: BIGINT, name: STRING, email: STRING>,
  items ARRAY<STRUCT<product_id: BIGINT, quantity: INT, price: DECIMAL(10,2)>>,
  order_date DATE,
  total DECIMAL(10,2)
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://bucket/orders/';

-- Flatten and insert
INSERT INTO "catalog"."namespace"."orders_flat"
SELECT
  order_id,
  customer.customer_id,
  customer.name AS customer_name,
  customer.email AS customer_email,
  item.product_id,
  item.quantity,
  item.price,
  order_date
FROM orders_nested
CROSS JOIN UNNEST(items) AS t(item);
```

### Preserving Nested Structures

**S3 Tables DDL with Nested Types**:

```sql
CREATE TABLE "catalog"."namespace"."orders_nested" (
  order_id BIGINT,
  customer STRUCT<
    customer_id: BIGINT,
    name: STRING,
    email: STRING
  >,
  items ARRAY<STRUCT<
    product_id: BIGINT,
    quantity: INT,
    price: DECIMAL(10,2)
  >>,
  order_date DATE,
  total DECIMAL(10,2)
)
USING ICEBERG
```

**Querying Nested Data**:

```sql
-- Access struct fields
SELECT
  order_id,
  customer.name,
  customer.email,
  order_date
FROM "catalog"."namespace"."orders_nested"
WHERE customer.customer_id = 789;

-- Explode array in queries
SELECT
  order_id,
  item.product_id,
  item.quantity,
  item.price
FROM "catalog"."namespace"."orders_nested"
CROSS JOIN UNNEST(items) AS t(item);
```

**PySpark - Write with Nested Types**:

```python
# Preserve nested structure
source_df.writeTo(args['target_table']).append()

# No flattening needed - PySpark DataFrame schema maps directly to Iceberg
```

## Array Handling Options

Implementation examples for each array handling strategy:

### Option 1: Keep as Array

Store as `ARRAY<STRUCT<...>>` in the S3 Table. Query with UNNEST as needed. Efficiently preserves one-to-many relationships.

### Option 2: Explode to Separate Rows

Each array element is promoted to its own row. Results in a simple, flat table structure. Can produce a large number of rows when arrays are long.

### Option 3: Create Separate Related Table

Store array elements in a dedicated table (e.g., `order_items`) and link back via a foreign key. Follows a normalized database design.

## Complete Examples

### Example 1: Schema Evolution

**Before** (existing table):

```sql
CREATE TABLE customers (
  customer_id INT,
  name STRING,
  email STRING
)
```

**New Source Data** adds columns: `phone STRING`, `address STRING`

**After Evolution**:

```sql
ALTER TABLE customers ADD COLUMNS (
  phone STRING,
  address STRING
);
```

**Result**:

- Existing rows: `customer_id=1, name="Alice", email="alice@example.com", phone=NULL, address=NULL`
- New rows: `customer_id=2, name="Bob", email="bob@example.com", phone="555-1234", address="123 Main St"`

### Example 2: Nested JSON with Flattening

**Source JSON**:

```json
{
  "user_id": 100,
  "profile": {
    "age": 30,
    "city": "Seattle"
  },
  "purchases": [
    {"item": "book", "amount": 20},
    {"item": "laptop", "amount": 1200}
  ]
}
```

**Flattened Table**:

```
user_id | age | city    | item   | amount
--------|-----|---------|--------|-------
100     | 30  | Seattle | book   | 20
100     | 30  | Seattle | laptop | 1200
```

**PySpark Code**:

```python
from pyspark.sql.functions import explode, col

df = spark.read.json("s3://bucket/data.json")

flattened = df.select(
    col("user_id"),
    col("profile.age"),
    col("profile.city"),
    explode(col("purchases")).alias("purchase")
).select(
    "user_id",
    "age",
    "city",
    col("purchase.item"),
    col("purchase.amount")
)
```

### Example 3: Nested JSON Preserved

**Same Source**, but preserved as nested:

**Table Schema**:

```sql
CREATE TABLE user_purchases (
  user_id BIGINT,
  profile STRUCT<age: INT, city: STRING>,
  purchases ARRAY<STRUCT<item: STRING, amount: DECIMAL(10,2)>>
)
```

**Query Example**:

```sql
-- Get users from Seattle who bought laptops
SELECT
  user_id,
  profile.age,
  purchase.item,
  purchase.amount
FROM user_purchases
CROSS JOIN UNNEST(purchases) AS t(purchase)
WHERE profile.city = 'Seattle'
  AND purchase.item = 'laptop';
```

## Evaluation Criteria

### Schema Evolution

**Detection**:

- Compares the source schema against the existing table schema
- Identifies new, missing, and changed columns
- Communicates differences clearly to the user

**Automatic Handling**:

- New columns: Executes ALTER TABLE ADD COLUMNS automatically
- Missing columns: Uses NULL or prompts the user for a decision
- Type changes: Routes to type conflict resolution

**Execution**:

- ALTER TABLE commands are syntactically correct
- Uses the appropriate Iceberg/S3 Tables syntax
- Confirms that changes were applied successfully

### Nested JSON

**Detection**:

- Identifies STRUCT and ARRAY types in the source data
- Determines the depth of nesting
- Lists all nested fields clearly

**User Choice**:

- Presents the flatten vs preserve options
- Explains the pros and cons of each approach
- Waits for the user's decision before proceeding

**Implementation**:

- Flatten: Delivers complete PySpark/SQL code including explode for arrays
- Preserve: Generates correct DDL with nested types
- Validates that the nested schema is correct

**Query Examples**:

- Demonstrates how to query nested data
- Shows struct field access (e.g., `customer.name`)
- Illustrates UNNEST/explode usage for arrays

## Common Mistakes to Avoid

Dropping and recreating an entire table when only ALTER TABLE ADD COLUMNS is needed
Silently filling missing columns with NULL without informing the user
Skipping the question of how to handle nested structures (flatten vs preserve)
Writing incomplete flattening code that omits some nested fields
Using incorrect DDL syntax for nested types
Failing to verify that ALTER TABLE succeeded
Exploding arrays without explaining that doing so creates multiple rows per original row
Omitting query examples for accessing nested data
