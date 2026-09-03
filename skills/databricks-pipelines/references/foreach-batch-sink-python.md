# ForEachBatch Sinks (Python, Public Preview)

Handle the stream as micro-batches using custom Python logic — for scenarios the built-in `delta` / `kafka` sinks don't cover: MERGE/upsert into Delta, fanning out to multiple destinations per batch, or writing to unsupported targets (JDBC, etc.).

## `@dp.foreach_batch_sink(name="...")`

```python
@dp.foreach_batch_sink(name="<sink_name>")        # name optional; defaults to function name
def my_sink(df, batch_id):
    # df: micro-batch DataFrame
    # batch_id: int, increments per trigger. 0 = first run OR start of full refresh.
    # Access SparkSession via df.sparkSession (NOT the module-level `spark`)
    ...
```

The handler returns no value. Write to a sink using `@dp.append_flow(target="<sink_name>")` — multiple flows can target the same sink, each maintaining its own checkpoint.

## Patterns

### MERGE/upsert into an existing Delta table

```python
@dp.foreach_batch_sink(name="upsert_sink")
def upsert_sink(df, batch_id):
    df.createOrReplaceTempView("batch_data")
    df.sparkSession.sql("""
        MERGE INTO target_catalog.schema.target_table AS t
        USING batch_data AS s ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET *
        WHEN NOT MATCHED THEN INSERT *
    """)

@dp.append_flow(target="upsert_sink")
def upsert_flow():
    return spark.readStream.table("source_events")
```

The target Delta table must exist prior to the MERGE running — create it externally or inside the handler when `batch_id == 0`.

### Fan out to multiple destinations (idempotent)

Use `txnVersion` + `txnAppId` to ensure partial-failure retries don't result in double-writes.

```python
APP_ID = "my-app-name"   # unique per application writing to the same target

@dp.foreach_batch_sink(name="multi_target_sink")
def multi_target_sink(df, batch_id):
    df.persist()         # avoid re-reading the source for each destination
    df.write.format("delta").mode("append") \
        .option("txnVersion", batch_id).option("txnAppId", APP_ID) \
        .saveAsTable("my_catalog.my_schema.table_a")
    df.write.format("json").mode("append") \
        .option("txnVersion", batch_id).option("txnAppId", APP_ID) \
        .save("/tmp/json_target")

@dp.append_flow(target="multi_target_sink")
def multi_target_flow():
    return spark.readStream.table("processed_events")
```

## Key rules

- Streaming only — append flows only. No batch DataFrames, no Auto CDC.
- The pipeline does NOT track sink data. On full refresh, checkpoints reset and `batch_id` restarts at 0 but **your target is NOT cleaned up** — truncate/drop manually if you want a clean slate.
- Use `df.sparkSession` to access the session, not the module-level `spark`.
- Multiple `@dp.append_flow`s can target the same sink; each maintains its own checkpoint.
- For Delta writes use `txnVersion`/`txnAppId` for idempotency. For multi-destination handlers, call `df.persist()` / `df.cache()` to avoid re-reading the source.
- Keep handlers lightweight — no threading, no heavy libraries, no large in-memory operations.
- **databricks-connect**: the handler must be serializable and must not call `dbutils`. Capture `dbutils.widgets.get(...)` values into variables *outside* the handler. Non-serializable handlers log a warning but may fail at runtime.
