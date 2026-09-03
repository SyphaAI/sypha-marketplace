# BigQuery Ingest

Transfer data from Google BigQuery into the data lake. Assumes a Glue `BIGQUERY` connection already exists. If it does not, delegate to `connecting-to-data-source`.

## Contents

- [Prerequisites](#prerequisites)
- [Read Pattern](#read-pattern)
- [Incremental Loading](#incremental-loading)
- [Partition Decorators](#partition-decorators)
- [Type Mapping](#type-mapping)
- [Further Reading](#further-reading)

## Prerequisites

- Glue connection of type `BIGQUERY` with service account credentials stored in Secrets Manager
- GCP project ID and source table reference (full form: `project.dataset.table`)
- Target table in the data lake
- Outbound network access from the Glue subnet to `bigquery.googleapis.com` (via public internet or Google Private Service Connect)

## Read Pattern

```python
bigquery_df = glueContext.create_dynamic_frame.from_options(
    connection_type="bigquery",
    connection_options={
        "connectionName": args['connection_name'],
        "parentProject": args['gcp_project'],
        "sourceType": "table",
        "table": "my_dataset.customers"
    }
).toDF()
```

For custom SQL:

```python
connection_options={
    "connectionName": args['connection_name'],
    "parentProject": args['gcp_project'],
    "sourceType": "query",
    "query": "SELECT id, name, updated_at FROM `project.dataset.customers` WHERE country = 'US'"
}
```

BigQuery billing note: charges are based on bytes read from table storage. Apply filters aggressively at the source to keep bytes scanned to a minimum.

## Incremental Loading

BigQuery provides reliable timestamp semantics. Commonly used watermark columns include:

- Application-managed `updated_at` / `last_modified`
- BigQuery-managed `_PARTITIONTIME` / `_PARTITIONDATE` on partitioned tables
- `INFORMATION_SCHEMA.PARTITIONS.last_modified_time` for partition-level freshness tracking

Example incremental read using a watermark filter:

```python
query = f"""
SELECT *
FROM `{project}.{dataset}.{table}`
WHERE updated_at > TIMESTAMP('{last_watermark}')
"""
```

See [incremental-loading.md](incremental-loading.md) for watermark storage.

## Partition Decorators

For time-partitioned BigQuery tables, partition decorators let you target specific partitions directly and cut down on bytes scanned:

```python
# Read only 2026-04 partitions
query = f"""
SELECT *
FROM `{project}.{dataset}.{table}`
WHERE _PARTITIONTIME BETWEEN TIMESTAMP('2026-04-01') AND TIMESTAMP('2026-04-30')
"""
```

Clustered tables gain the same advantage when filters are pushed down on clustering columns. Inspect clustering configuration with:

```sql
SELECT clustering_fields FROM `<project>.<dataset>.INFORMATION_SCHEMA.TABLES` WHERE table_name = '<table>';
```

## Type Mapping

| BigQuery | Iceberg | Notes |
|---|---|---|
| STRING | STRING | |
| INT64, INTEGER | BIGINT | All BQ integers are 64-bit |
| NUMERIC | DECIMAL(38,9) | BQ NUMERIC is fixed precision |
| BIGNUMERIC | STRING | Iceberg DECIMAL caps at (38,38); store as STRING, cast on read |
| FLOAT64, FLOAT | DOUBLE | |
| BOOL, BOOLEAN | BOOLEAN | |
| BYTES | BINARY | |
| DATE | DATE | |
| TIME | STRING | Iceberg has no TIME type |
| DATETIME | TIMESTAMP | No timezone |
| TIMESTAMP | TIMESTAMPTZ | UTC-anchored |
| GEOGRAPHY | STRING | WKT or GeoJSON |
| STRUCT | STRUCT | |
| ARRAY | ARRAY | |
| JSON | STRING | Parse if needed |

BIGNUMERIC (precision up to 76.38) exceeds the 38-digit limit of Iceberg DECIMAL. When full precision must be preserved, store the value as STRING and cast it at read time.

## Further Reading

- [AWS Glue: Creating a BigQuery connection](https://docs.aws.amazon.com/glue/latest/dg/creating-bigquery-connection.html)
- [AWS Glue: Creating a BigQuery source node](https://docs.aws.amazon.com/glue/latest/dg/creating-bigquery-source-node.html)
- [BigQuery partitioned tables](https://cloud.google.com/bigquery/docs/partitioned-tables)
- [BigQuery clustered tables](https://cloud.google.com/bigquery/docs/clustered-tables)
