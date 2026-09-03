# Materialized Views (Python)

Batch processing with full refresh or incremental computation. For streaming tables, see [streaming-table-python.md](streaming-table-python.md). For the incremental-refresh operation-support table, see [materialized-view-sql.md](materialized-view-sql.md#incremental-refresh).

## `@dp.materialized_view()` — preferred

```python
@dp.materialized_view(
    name="<name>",
    comment="<comment>",
    spark_conf={...},
    table_properties={...},
    path="<storage-location>",
    cluster_by=["<col>", ...],          # Liquid Clustering — preferred
    cluster_by_auto=True,                # let Databricks pick keys
    partition_cols=["<col>"],            # legacy, prefer cluster_by — see performance.md#liquid-clustering
    schema="col1 TYPE, ...",             # supports GENERATED ALWAYS AS, MASK clauses, PK/FK constraints
    row_filter="ROW FILTER my_catalog.my_schema.func ON (col)",
    private=False,                       # True = pipeline-scoped, not published to UC
)
def my_mv():
    return spark.read.table("source.data")     # must be a batch DataFrame
```

`@dp.table()` with a batch DataFrame return type also creates a materialized view (legacy DLT shape), but `@dp.materialized_view()` is the recommended decorator. Reserve `@dp.table` for streaming tables going forward.

For detailed semantics of `row_filter` (UC SQL UDF returning BOOLEAN; forces full refresh of downstream MVs; cannot be defined inside the pipeline), see [streaming-table-python.md](streaming-table-python.md).

## Incremental refresh

Requires **serverless** + Delta row tracking on source tables (`delta.enableRowTracking = true`). Falls back to full recompute when those conditions aren't met. For the supported-operations matrix, see [materialized-view-sql.md](materialized-view-sql.md#incremental-refresh) — the same support applies to Python DataFrame equivalents.

For exactly-once semantics (Kafka, Auto Loader), use a streaming table instead.

## Patterns

### Aggregation with clustering

```python
@dp.materialized_view(name="daily_sales_summary", cluster_by=["sale_date", "region"])
def daily_sales_summary():
    return (spark.read.table("raw.orders")
                 .withColumn("sale_date", F.to_date("order_timestamp"))
                 .groupBy("sale_date", "region")
                 .agg(F.count("*").alias("order_count"),
                      F.sum("amount").alias("total_revenue")))
```

### Generated columns

```python
@dp.materialized_view(
    schema="""
        order_datetime STRING,
        order_day_of_week STRING GENERATED ALWAYS AS (dayofweek(order_datetime)),
        customer_id BIGINT,
        amount DECIMAL(10,2)
    """,
    cluster_by=["order_day_of_week", "customer_id"],
)
def orders_with_day():
    return spark.read.table("raw.orders")
```

### Row filter / column masking (UC, Public Preview)

```python
@dp.materialized_view(
    name="employees",
    schema="emp_id INT, emp_name STRING, dept STRING, salary DECIMAL(10,2)",
    row_filter="ROW FILTER my_catalog.my_schema.filter_by_dept ON (dept)",
)
def employees():
    return spark.read.table("source.employees")
```

Column masking uses `MASK ... USING COLUMNS (...)` inside the `schema=` string — the same form as in SQL.

## Key rules

- MVs use `spark.read` (batch); streaming tables use `spark.readStream`.
- Never call `.write`, `.save()`, `.saveAsTable()`, or `.toTable()` — Databricks manages all writes.
- Generated columns, PK/FK constraints, and MASK clauses require an explicit `schema=`.
- Row filters on source tables force a full refresh of downstream MVs.
