# Schema Discovery for External Databases

End-to-end reference for locating schemas in external database systems and deriving Iceberg-compatible target S3 Table schemas.

## Overview

Schema discovery determines what data exists in the source system and translates it to Iceberg-compatible types for the target S3 Table.

## Identifying Source Data

### Ask the User

Collect the information needed to proceed with the import:

**Which table(s) or view(s)** to import:

- Single table: `CUSTOMERS`, `SALES_ORDERS`, `INVENTORY`
- Multiple tables: A list of tables to bring across
- Views: Database views are handled the same as tables

**Schema/database name** (if the system supports multiple databases):

- Oracle: Schema name (e.g., `SALES_SCHEMA`)
- SQL Server: Database and schema (e.g., `SalesDB.dbo`)
- PostgreSQL: Schema within the database (e.g., `public`, `analytics`)
- MySQL: Database name (e.g., `sales_db`)

**Custom SQL query** (optional):

- Use when the user needs to filter or transform data at the source
- Reduces data volume prior to transfer
- Example: `SELECT * FROM CUSTOMERS WHERE status = 'ACTIVE' AND created_date >= CURRENT_DATE - 90`

## Auto-Discovering Available Tables

Use Glue crawlers to enumerate available tables in the source database.

### Create Temporary Crawler

```bash
# Create crawler
aws glue create-crawler \
  --name "temp-discovery-crawler" \
  --role "<glue-service-role-arn>" \
  --database-name "temp_discovery_db" \
  --targets '{
    "JdbcTargets": [{
      "ConnectionName": "<connection-name>",
      "Path": "<database>/%"
    }]
  }' \
  --region <region>
```

### Path Patterns for Different Databases

| Database | Path Pattern | Example |
|----------|--------------|---------|
| Oracle | `<schema>/%` | `SALES_SCHEMA/%` |
| SQL Server | `<database>/<schema>/%` | `SalesDB/dbo/%` |
| PostgreSQL | `<database>/<schema>/%` | `analytics/public/%` |
| MySQL | `<database>/%` | `sales_db/%` |

### Run the Crawler

```bash
# Start crawler
aws glue start-crawler --name "temp-discovery-crawler" --region <region>

# Check status (wait until State is READY)
aws glue get-crawler --name "temp-discovery-crawler" --region <region> \
  --query 'Crawler.State' --output text
```

Crawler states: `READY` (not running), `RUNNING`, `STOPPING`

### List Discovered Tables

Once the crawler finishes:

```bash
aws glue get-tables --database-name "temp_discovery_db" --region <region>
```

Present the results to the user:

```
I found these tables in your database:
1. CUSTOMERS (45 columns, ~1.2M rows)
2. ORDERS (32 columns, ~5.8M rows)
3. PRODUCTS (18 columns, ~15K rows)
4. INVENTORY (12 columns, ~250K rows)

Which one(s) should I import?
```

### Clean Up

After the user selects their table(s), remove the temporary crawler and database:

```bash
# Delete crawler
aws glue delete-crawler --name "temp-discovery-crawler" --region <region>

# Delete temp database (optional - tables still useful for reference)
aws glue delete-database --name "temp_discovery_db" --region <region>
```

## Inspecting Table Schema

Once the user has identified the source table, retrieve its full schema details.

### Using Glue Data Catalog (after crawling)

```bash
aws glue get-table \
  --database-name "temp_discovery_db" \
  --name "<table-name>" \
  --region <region>
```

This returns:

- Column names and data types
- Table statistics (estimated row count, data size)
- Partition information (if the table is partitioned)

### Directly Querying the Database

As an alternative, query the source database directly to obtain the schema.

**For SQL databases** (via test Glue job):

```python
# test-schema.py
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()

# Read just the schema (LIMIT 0)
df = spark.read.format("jdbc").options(
    url="<jdbc-url>",
    dbtable="(SELECT * FROM <table> WHERE 1=0) AS schema_query",
    user="<username>",
    password="<password>"
).load()

# Print schema
df.printSchema()
```

**Using Athena Federated Query** (if connector installed):

```sql
-- Query external database via Athena connector
SELECT * FROM "<athena-connector>"."<schema>"."<table>" LIMIT 0
```

Returns the schema without transferring any data rows.

## Custom SQL Queries

When the user needs to filter or transform data at the source, custom SQL is supported:

### Benefits of Source-Side Filtering

1. **Reduces data transfer**: Only the required data is moved
2. **Improves performance**: The database performs filtering before data leaves
3. **Enables complex transformations**: Database-specific functions can be leveraged

### Example Queries

**Filter by date**:

```sql
SELECT *
FROM CUSTOMERS
WHERE created_date >= CURRENT_DATE - 90
```

**Filter by status**:

```sql
SELECT *
FROM ORDERS
WHERE status IN ('COMPLETED', 'SHIPPED')
```

**Join multiple tables**:

```sql
SELECT
  o.order_id,
  o.order_date,
  c.customer_name,
  c.email,
  SUM(oi.quantity * oi.price) as total_amount
FROM ORDERS o
JOIN CUSTOMERS c ON o.customer_id = c.customer_id
JOIN ORDER_ITEMS oi ON o.order_id = oi.order_id
WHERE o.order_date >= CURRENT_DATE - 30
GROUP BY o.order_id, o.order_date, c.customer_name, c.email
```

**Select specific columns**:

```sql
SELECT
  customer_id,
  customer_name,
  email,
  phone,
  created_date,
  last_purchase_date
FROM CUSTOMERS
WHERE status = 'ACTIVE'
```

### Storing Custom Queries

Persist the query so it is available to the Glue ETL script:

**Option 1: As job parameter**:

```python
'--source_query': 'SELECT * FROM CUSTOMERS WHERE status = \'ACTIVE\''
```

**Option 2: In S3 file**:

```python
# Read query from S3
import boto3
s3 = boto3.client('s3')
obj = s3.get_object(Bucket='<bucket>', Key='queries/customer-import.sql')
source_query = obj['Body'].read().decode('utf-8')
```

## Type Mapping: Source Database → Iceberg

Convert source database types to their Iceberg equivalents for the target S3 Table.

### Common Type Mappings

| Source Type | Iceberg Type | Notes |
|-------------|--------------|-------|
| VARCHAR, CHAR, TEXT, STRING | STRING | Variable-length text |
| INTEGER, INT, SMALLINT | INTEGER | 32-bit signed integer |
| BIGINT, NUMBER(19) | BIGINT | 64-bit signed integer |
| DECIMAL, NUMERIC | DECIMAL(p,s) | Preserve precision/scale |
| FLOAT, REAL | FLOAT | 32-bit floating point |
| DOUBLE PRECISION, BINARY_DOUBLE | DOUBLE | 64-bit floating point |
| BOOLEAN, BIT | BOOLEAN | True/false |
| DATE | DATE | Date without time |
| TIMESTAMP, DATETIME, DATETIME2 | TIMESTAMP | Date and time |
| TIME | STRING | Convert to string (Iceberg has no TIME type) |
| BLOB, BYTEA, VARBINARY, BINARY | BINARY | Binary data |
| CLOB, TEXT | STRING | Large text |
| UUID | STRING | Store as string |
| JSON, JSONB | STRING | Store as JSON string |
| ARRAY | ARRAY\<T\> | If database supports arrays |
| MAP, HSTORE | MAP\<K,V\> | If database supports maps |

### Oracle-Specific Types

| Oracle Type | Iceberg Type | Notes |
|-------------|--------------|-------|
| NUMBER | DECIMAL or BIGINT | Use DECIMAL for precision, BIGINT if no scale |
| NUMBER(p,s) | DECIMAL(p,s) | Preserve precision and scale |
| VARCHAR2, NVARCHAR2 | STRING | Variable-length string |
| CHAR, NCHAR | STRING | Fixed-length string |
| DATE | TIMESTAMP | Oracle DATE includes time |
| TIMESTAMP | TIMESTAMP | Direct mapping |
| CLOB, NCLOB | STRING | Large text |
| BLOB | BINARY | Binary data |
| RAW | BINARY | Raw binary |

### SQL Server-Specific Types

| SQL Server Type | Iceberg Type | Notes |
|-----------------|--------------|-------|
| NVARCHAR, VARCHAR | STRING | Unicode or ASCII string |
| INT | INTEGER | 32-bit integer |
| BIGINT | BIGINT | 64-bit integer |
| SMALLINT | INTEGER | 16-bit → 32-bit |
| TINYINT | INTEGER | 8-bit → 32-bit |
| DECIMAL, NUMERIC | DECIMAL(p,s) | Preserve precision |
| MONEY, SMALLMONEY | DECIMAL(19,4) | Currency |
| DATETIME, DATETIME2 | TIMESTAMP | Date and time |
| DATE | DATE | Date only |
| TIME | STRING | Convert to string |
| BIT | BOOLEAN | True/false |
| UNIQUEIDENTIFIER | STRING | GUID as string |

### PostgreSQL-Specific Types

| PostgreSQL Type | Iceberg Type | Notes |
|-----------------|--------------|-------|
| INTEGER | INTEGER | 32-bit integer |
| BIGINT | BIGINT | 64-bit integer |
| SMALLINT | INTEGER | 16-bit → 32-bit |
| NUMERIC | DECIMAL(p,s) | Arbitrary precision |
| REAL | FLOAT | 32-bit floating |
| DOUBLE PRECISION | DOUBLE | 64-bit floating |
| TEXT, VARCHAR | STRING | Variable-length text |
| BOOLEAN | BOOLEAN | True/false |
| DATE | DATE | Date only |
| TIMESTAMP | TIMESTAMP | Date and time |
| TIMESTAMPTZ | TIMESTAMP | Timestamp with timezone |
| JSON, JSONB | STRING | Store as JSON string |
| UUID | STRING | UUID as string |
| BYTEA | BINARY | Binary data |
| ARRAY | ARRAY\<T\> | PostgreSQL arrays supported |

### MySQL-Specific Types

| MySQL Type | Iceberg Type | Notes |
|------------|--------------|-------|
| INT, INTEGER | INTEGER | 32-bit integer |
| BIGINT | BIGINT | 64-bit integer |
| SMALLINT | INTEGER | 16-bit → 32-bit |
| TINYINT | INTEGER | 8-bit → 32-bit (or BOOLEAN if TINYINT(1)) |
| DECIMAL, NUMERIC | DECIMAL(p,s) | Preserve precision |
| FLOAT | FLOAT | 32-bit floating |
| DOUBLE | DOUBLE | 64-bit floating |
| VARCHAR, CHAR, TEXT | STRING | Variable/fixed-length text |
| DATE | DATE | Date only |
| DATETIME, TIMESTAMP | TIMESTAMP | Date and time |
| TIME | STRING | Convert to string |
| BOOLEAN | BOOLEAN | True/false |
| BLOB, BINARY, VARBINARY | BINARY | Binary data |
| JSON | STRING | Store as JSON string |

## Proposing Target Schema

Using the source schema as input, propose a target S3 Table schema for the user to review.

### Example Schema Proposal

**Source table**: `CUSTOMERS` in Oracle database

- CUSTOMER_ID: NUMBER(10) → BIGINT
- CUSTOMER_NAME: VARCHAR2(200) → STRING
- EMAIL: VARCHAR2(255) → STRING
- PHONE: VARCHAR2(20) → STRING
- STATUS: VARCHAR2(20) → STRING
- CREDIT_LIMIT: NUMBER(10,2) → DECIMAL(10,2)
- CREATED_DATE: DATE → TIMESTAMP
- LAST_PURCHASE_DATE: DATE → TIMESTAMP

**Proposed S3 Table schema**:

```sql
CREATE TABLE "glue_catalog"."sales"."customers" (
  customer_id BIGINT,
  customer_name STRING,
  email STRING,
  phone STRING,
  status STRING,
  credit_limit DECIMAL(10,2),
  created_date TIMESTAMP,
  last_purchase_date TIMESTAMP,
  load_timestamp TIMESTAMP,  -- Added: track when record was loaded
  load_date DATE             -- Partition column for efficient queries
)
PARTITIONED BY (load_date)
TBLPROPERTIES ('table_type' = 'ICEBERG')
```

**Present to user**:

```
I've mapped the Oracle CUSTOMERS table to this Iceberg schema:

Source (Oracle)                  → Target (Iceberg)
CUSTOMER_ID (NUMBER(10))         → customer_id (BIGINT)
CUSTOMER_NAME (VARCHAR2(200))    → customer_name (STRING)
EMAIL (VARCHAR2(255))            → email (STRING)
PHONE (VARCHAR2(20))             → phone (STRING)
STATUS (VARCHAR2(20))            → status (STRING)
CREDIT_LIMIT (NUMBER(10,2))      → credit_limit (DECIMAL(10,2))
CREATED_DATE (DATE)              → created_date (TIMESTAMP)
LAST_PURCHASE_DATE (DATE)        → last_purchase_date (TIMESTAMP)

Added columns:
- load_timestamp (TIMESTAMP): Records when each row was ingested
- load_date (DATE): Partition column for efficient querying

Does this look correct? Any adjustments needed?
```

## Handling Complex Types

### JSON Columns

**Option 1**: Store as STRING (simplest approach)

```sql
json_data STRING
```

**Option 2**: Parse and flatten to STRUCT

```sql
metadata STRUCT<
  key1: STRING,
  key2: INT,
  key3: ARRAY<STRING>
>
```

Default to Option 1 unless the user explicitly needs to query nested fields.

### Array/List Columns

For source databases that support arrays (PostgreSQL, Oracle VARRAY):

**Option 1**: Retain as ARRAY

```sql
tags ARRAY<STRING>
```

**Option 2**: Serialize to STRING (comma-separated)

```sql
tags STRING  -- "tag1,tag2,tag3"
```

**Option 3**: Explode into a separate normalized table

### Binary/BLOB Columns

**Recommendation**: Import only when necessary, as binary data increases storage costs.

If importing:

```sql
document BINARY
```

For large binaries, consider storing them directly in S3 and keeping only the S3 key in the table:

```sql
document_s3_key STRING  -- "s3://docs-bucket/doc123.pdf"
```

## Best Practices

1. **Ask user to confirm schema**: Never assume type mappings are correct without verification
2. **Add metadata columns**: Include `load_timestamp`, `load_date`, and `source_system`
3. **Consider partitioning**: Partition by load date for efficient incremental queries
4. **Handle nullability**: Default most columns to nullable unless the user specifies otherwise
5. **Document type conversions**: Call out any lossy conversions (e.g., TIME → STRING)
6. **Test with sample data**: Ingest a small batch first to confirm that types behave as expected

## Summary

Schema discovery workflow:

1. **Identify source data** - Ask the user for the table or query
2. **Auto-discover tables** - Run a Glue crawler when the user is unsure what is available
3. **Inspect schema** - Retrieve column names and types
4. **Support custom SQL** - Allow source-side filtering and transformations
5. **Map types** - Translate source types to Iceberg equivalents
6. **Propose target schema** - Present the mapping to the user for confirmation
7. **Add metadata columns** - Include load_timestamp, load_date, and similar fields

With thorough schema discovery in place, data from external databases maps reliably to S3 Tables using Iceberg types.
