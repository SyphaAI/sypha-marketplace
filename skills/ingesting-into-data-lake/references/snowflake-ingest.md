# Snowflake Ingest

Extract data from Snowflake and bring it into the data lake. Requires a Glue `SNOWFLAKE` connection to already exist. If one is absent, delegate to `connecting-to-data-source`.

## Contents

- [Prerequisites](#prerequisites)
- [Read Pattern](#read-pattern)
- [Incremental Loading](#incremental-loading)
- [Partition Pruning](#partition-pruning)
- [Type Mapping](#type-mapping)
- [Further Reading](#further-reading)

## Prerequisites

- A Glue connection of type `SNOWFLAKE` (not JDBC)
- Source database, schema, table, and an optional query
- Target table in the data lake
- Warehouse sized appropriately for the read workload (larger warehouse = faster reads, higher cost)

## Read Pattern

The Glue Snowflake connector internally uses Snowflake's COPY INTO mechanism — making it efficient for large extracts.

```python
snowflake_df = glueContext.create_dynamic_frame.from_options(
    connection_type="snowflake",
    connection_options={
        "connectionName": args['connection_name'],
        "sfDatabase": args['database'],
        "sfSchema": args['schema'],
        "dbtable": args['table']
    }
).toDF()
```

For custom SQL, use `query` instead of `dbtable`:

```python
connection_options={
    "connectionName": args['connection_name'],
    "query": "SELECT id, name, updated_at FROM SALES.ORDERS WHERE status = 'CLOSED'"
}
```

## Incremental Loading

Most Snowflake tables carry reliable timestamps. Common watermark columns include:

- Application-maintained `updated_at` / `modified_at`
- Snowflake-maintained `_FIVETRAN_SYNCED` when data originates from Fivetran
- `INFORMATION_SCHEMA.TABLES.LAST_ALTERED` for schema-level freshness tracking (not row-level)

For tables that lack an `updated_at` column, two options exist:

- Query `SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY` or `TABLE_STORAGE_METRICS` to detect changed tables and schedule full refreshes accordingly
- Use Snowflake Streams for CDC capture (advanced; requires configuration on the Snowflake side — see [Snowflake Streams docs](https://docs.snowflake.com/en/user-guide/streams-intro))

Apply a standard watermark filter inside the custom query:

```python
connection_options={
    "connectionName": args['connection_name'],
    "query": f"SELECT * FROM {source_table} WHERE updated_at > '{last_watermark}'"
}
```

See [incremental-loading.md](incremental-loading.md) for watermark storage and the broader incremental pattern.

## Partition Pruning

Snowflake automatically micro-partitions its tables. Push predicates down via the `query` option — avoid pulling full tables and filtering in Spark.

Clustered tables gain the most from filter push-down. Inspect cluster keys:

```sql
SHOW TABLES LIKE '<table>' IN SCHEMA <db>.<schema>;
-- Look at CLUSTER_BY column
```

When the source table is clustered on `created_date` and the query filters on `created_date >= '2026-01-01'`, Snowflake prunes irrelevant micro-partitions and returns only the matching data.

## Type Mapping

| Snowflake | Iceberg | Notes |
|---|---|---|
| VARCHAR, STRING, TEXT | STRING | |
| NUMBER(p,s) | DECIMAL(p,s) | |
| NUMBER (no scale) | BIGINT | |
| FLOAT, DOUBLE | DOUBLE | |
| BOOLEAN | BOOLEAN | |
| DATE | DATE | |
| TIME | STRING | Iceberg has no TIME type |
| TIMESTAMP_NTZ | TIMESTAMP | Naive timestamp |
| TIMESTAMP_LTZ, TIMESTAMP_TZ | TIMESTAMPTZ | Timezone-aware |
| VARIANT | STRING | Serialize as JSON |
| OBJECT | STRUCT or STRING | Flatten or serialize |
| ARRAY | ARRAY or STRING | |
| BINARY | BINARY | |
| GEOGRAPHY, GEOMETRY | STRING | GeoJSON or WKT |

## Further Reading

- [AWS Glue: Snowflake connections (programming)](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-connect-snowflake-home.html)
- [Snowflake Streams for CDC](https://docs.snowflake.com/en/user-guide/streams-intro)
- [Snowflake query profile and clustering](https://docs.snowflake.com/en/user-guide/ui-query-profile)
