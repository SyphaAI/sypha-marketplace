# Streaming Tables (Python)

Streaming tables support incremental processing of continuously arriving data. For materialized views (batch with `spark.read`), see [materialized-view-python.md](materialized-view-python.md).

## `@dp.table()` — streaming or batch depending on return type

```python
@dp.table(
    name="<name>",
    comment="<comment>",
    spark_conf={...},
    table_properties={...},
    path="<storage-location>",
    cluster_by=["<col>", ...],       # Liquid Clustering — preferred
    cluster_by_auto=True,             # let Databricks pick keys
    partition_cols=["<col>"],         # legacy, prefer cluster_by — see performance.md#liquid-clustering
    schema="col1 TYPE, ...",          # supports GENERATED ALWAYS AS, MASK clauses, PK/FK constraints
    row_filter="ROW FILTER my_catalog.my_schema.func ON (col)",   # Public Preview
    private=False,                    # True = pipeline-scoped, not published to UC
)
def my_table():
    return spark.readStream.table("source.data")     # streaming → streaming table
    # or spark.read.table(...)                        # batch → materialized view (prefer @dp.materialized_view)
```

`row_filter` notes: `func_name` must be a UC SQL UDF that returns BOOLEAN; rows where it returns FALSE/NULL are dropped. This forces a full refresh of downstream MVs. The UDF cannot be defined inside the pipeline itself.

## `dp.create_streaming_table()` — empty target for flows

Use this when a single target receives data from multiple `@dp.append_flow`s or from `dp.create_auto_cdc_flow()`. Call it at the top level; it does NOT return a value.

```python
dp.create_streaming_table(
    name="<table-name>",
    cluster_by=[...],
    schema="...",
    expect_all={"name": "cond"},                # warn
    expect_all_or_drop={"name": "cond"},        # drop row
    expect_all_or_fail={"name": "cond"},        # fail update
    row_filter="...",
)
```

Accepts the same parameters as `@dp.table()` except `private`, and additionally accepts the three `expect_all*` dicts.

## `@dp.append_flow()` — fan multiple sources into one table

```python
@dp.append_flow(target="<target>", name="<flow_name>", once=False)
def my_flow():
    return spark.readStream.table("source.data")    # once=False → streaming
    # or spark.read.table("archive.historical")     # once=True  → batch (one-shot)
```

- `target` (required): name of the target table (created via `dp.create_streaming_table()`).
- `name`: defaults to the function name. Use distinct names when multiple flows target the same table.
- `once=True`: one-shot batch mode. Use `spark.read` — NOT `cloudFiles`, which is streaming-only.
- `spark_conf`: per-flow Spark configuration (e.g. `{"spark.sql.shuffle.partitions": "10"}`).

## Single source vs multi-source

- **Single source** → `@dp.table()` with `spark.readStream.*` and the transformation in the function body. Continuous processing is handled automatically.
- **Multi-source / AUTO CDC target** → `dp.create_streaming_table(...)` (empty target) + one `@dp.append_flow` per source (or `dp.create_auto_cdc_flow` for CDC).

Do not combine the two: if you have an `@dp.table` definition, do not add a separate `@dp.append_flow` targeting the same table — the decorator already provides continuous processing, making the flow redundant.

## Common Patterns

### Auto Loader + filter

```python
@dp.table()
def bronze():
    return (spark.readStream.format("cloudFiles")
                 .option("cloudFiles.format", "json").load("/path/to/data"))

@dp.table()
def silver():
    return spark.readStream.table("bronze").filter("id IS NOT NULL")
```

### Multi-source append

```python
dp.create_streaming_table(name="all_events")

@dp.append_flow(target="all_events", name="mobile")
def mobile():
    return spark.readStream.table("mobile.events")
# Add @dp.append_flow(target="all_events", name="web") ... for additional sources.
```

### Backfill + live stream into the same table

```python
dp.create_streaming_table(name="transactions")

@dp.append_flow(target="transactions", name="live_stream")
def live_transactions():
    return spark.readStream.table("source.transactions")

@dp.append_flow(target="transactions", name="historical_backfill", once=True)
def backfill_transactions():
    return spark.read.table("archive.historical_transactions")   # batch, no cloudFiles
```

### Row filter for data security

```python
@dp.table(
    name="employees",
    schema="emp_id INT, emp_name STRING, dept STRING, salary DECIMAL(10,2)",
    row_filter="ROW FILTER my_catalog.my_schema.filter_by_dept ON (dept)",
)
def employees():
    return spark.readStream.table("source.employees")
```

### Stream-static join (enrich with dimension)

```python
@dp.table()
def enriched_transactions():
    transactions = spark.readStream.table("transactions")
    customers    = spark.read.table("customers")            # static snapshot at stream start
    return transactions.join(customers, transactions.customer_id == customers.id)
```

### Reading from a streaming table that has updates/deletes

```python
@dp.table()
def downstream():
    return spark.readStream.option("skipChangeCommits", "true").table("upstream_with_deletes")
```

Without `skipChangeCommits`, update/delete commits from the upstream (e.g. GDPR purges, Auto CDC targets) will cause errors.

## Key rules

- Streaming tables use `spark.readStream`; materialized views use `spark.read`.
- Never call `.writeStream`, `.start()`, or pass checkpoint options — Databricks owns those.
- Generated columns, masks, and PK/FK constraints require an explicit `schema=` argument.
- Row filters on source tables force a full refresh of downstream MVs.
