# JDBC Database Ingest

Transfer data from a JDBC source (Oracle, SQL Server, PostgreSQL, MySQL, RDS, Aurora, Redshift) into the data lake. A Glue connection is assumed to already exist. If one has not been created, delegate to the `connecting-to-data-source` skill first.

## Contents

- [Prerequisites](#prerequisites)
- [Workflow](#workflow)
- [Parallel Reads](#parallel-reads)
- [Type Mapping](#type-mapping)
- [Connection Errors](#connection-errors)

## Prerequisites

- A verified Glue connection (set up through the `connecting-to-data-source` skill)
- The source table name, schema, and any optional filter SQL
- A target table (already existing or to be created via the `creating-data-lake-table` skill)
- A chosen target format (default is S3 Tables; see [iceberg-catalog-config-and-usage.md](iceberg-catalog-config-and-usage.md))

## Workflow

### 1. Confirm the connection exists

```bash
aws glue get-connection --name <CONNECTION_NAME> --region <REGION>
```

If the connection does not exist, stop and hand off to `connecting-to-data-source`.

### 2. Identify source scope

Ask the user which tables, views, or custom SQL query to use. See [jdbc-schema-discovery.md](jdbc-schema-discovery.md) for crawler-based discovery, direct schema inspection, and custom SQL patterns.

### 3. Decide load strategy

| Intent | Strategy | Reference |
|---|---|---|
| One-time full load | Full scan, write once | [glue-job-scripts.md](glue-job-scripts.md) full-refresh template |
| Recurring, append-only (events, logs) | Incremental append with watermark | [incremental-loading.md](incremental-loading.md) |
| Recurring, mutable (customers, products) | Incremental upsert with MERGE | [incremental-loading.md](incremental-loading.md) |
| Small dimension | Full refresh via `createOrReplace()` | [glue-job-scripts.md](glue-job-scripts.md) |

### 4. Create the target table if needed

If the target table does not yet exist, delegate to `creating-data-lake-table`. Never create it inline within this workflow.

### 5. Build the Glue 5.1 or higher job

Use the PySpark templates in [glue-job-scripts.md](glue-job-scripts.md) and apply the job configuration guidance from [glue-job-config.md](glue-job-config.md).

Reference the Glue connection through the job's `Connections` property:

```json
"Connections": {"Connections": ["<CONNECTION_NAME>"]}
```

In the script, read using the connection name -- credentials must never be embedded in the code:

```python
source_df = glueContext.create_dynamic_frame.from_options(
    connection_type="jdbc",
    connection_options={
        "useConnectionProperties": "true",
        "connectionName": args['connection_name'],
        "dbtable": args['source_table']
    }
).toDF()
```

### 6. Test, validate, schedule

- Execute the job manually for an initial test run
- Validate the output per [data-quality-validation.md](data-quality-validation.md): check row counts, null rates on critical columns, and spot-check sample records
- For recurring pipelines, set up a Glue Trigger as described in [testing-and-scheduling.md](testing-and-scheduling.md)

## Parallel Reads

For large tables, distribute the read across multiple Spark partitions using a numeric column:

```python
jdbc_conf = glueContext.extract_jdbc_conf(args['connection_name'])

source_df = spark.read.format("jdbc").options(
    url=jdbc_conf["url"],
    user=jdbc_conf["user"],
    password=jdbc_conf["password"],
    dbtable="<SCHEMA>.<TABLE>",
    numPartitions=10,
    partitionColumn="<numeric_column>",
    lowerBound=1,
    upperBound="<max_value>"
).load()
```

Best practices:

- Choose a numeric column with an even value distribution for `partitionColumn`
- Set `numPartitions` to the number of Glue workers multiplied by 2
- Ensure `lowerBound` and `upperBound` span the actual range of values in the column
- The source database must be capable of handling the resulting concurrent connections

Always retrieve credentials from the Glue connection at runtime rather than hardcoding them. See [connecting-to-data-source credential-security.md](../../connecting-to-data-source/references/credential-security.md) for IAM DB auth and Secrets Manager patterns.

## Type Mapping

Source-to-Iceberg type mappings for ingest. Apply the conversions using `.cast()` or column aliases in the Glue script.

### Oracle

| Oracle | Iceberg | Notes |
|---|---|---|
| VARCHAR2, CHAR | STRING | |
| NUMBER(p,s) | DECIMAL(p,s) | |
| NUMBER (no scale) | BIGINT | For integer values |
| DATE | TIMESTAMP | Oracle DATE includes time |
| TIMESTAMP | TIMESTAMP | |
| CLOB | STRING | |
| BLOB | BINARY | |

### SQL Server

| SQL Server | Iceberg | Notes |
|---|---|---|
| VARCHAR, NVARCHAR, CHAR | STRING | |
| INT, SMALLINT | INTEGER | |
| BIGINT | BIGINT | |
| DECIMAL, NUMERIC | DECIMAL(p,s) | |
| FLOAT, REAL | DOUBLE | |
| BIT | BOOLEAN | |
| DATE | DATE | |
| DATETIME, DATETIME2 | TIMESTAMP | |

### PostgreSQL

| PostgreSQL | Iceberg | Notes |
|---|---|---|
| VARCHAR, TEXT | STRING | |
| INTEGER, SMALLINT | INTEGER | |
| BIGINT | BIGINT | |
| NUMERIC, DECIMAL | DECIMAL(p,s) | |
| REAL | FLOAT | |
| DOUBLE PRECISION | DOUBLE | |
| BOOLEAN | BOOLEAN | |
| DATE | DATE | |
| TIMESTAMP, TIMESTAMPTZ | TIMESTAMP | |
| JSON, JSONB | STRING | Parse in Spark if needed |
| UUID | STRING | |

### MySQL

| MySQL | Iceberg | Notes |
|---|---|---|
| VARCHAR, CHAR, TEXT | STRING | |
| INT, SMALLINT, TINYINT | INTEGER | TINYINT(1) is BOOLEAN |
| BIGINT | BIGINT | |
| DECIMAL | DECIMAL(p,s) | |
| FLOAT | FLOAT | |
| DOUBLE | DOUBLE | |
| DATE | DATE | |
| DATETIME, TIMESTAMP | TIMESTAMP | |
| JSON | STRING | |

### Redshift

Follows the same mappings as PostgreSQL, with these Redshift-specific additions:

- `SUPER` -> STRING (serialize) or STRUCT (parse)
- `GEOMETRY` / `GEOGRAPHY` -> BINARY or STRING

## Connection Errors

When a Glue job fails with a connection-level error (timeout, authentication failure, driver not found, or SSL handshake error), delegate troubleshooting to `connecting-to-data-source`. Network or credential fixes are out of scope for this skill.

See [connecting-to-data-source troubleshooting.md](../../connecting-to-data-source/references/troubleshooting.md).
