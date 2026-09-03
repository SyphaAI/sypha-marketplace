# Sinks (Python only)

Sinks deliver pipeline output to targets not managed by the pipeline: Kafka / Event Hubs topics, externally-managed Delta tables, or volumes. Python-only. Streaming queries only. Exclusively compatible with `@dp.append_flow()`.

For custom per-batch Python logic (merge/upsert, multi-destination), see [foreach-batch-sink-python.md](foreach-batch-sink-python.md).

## `dp.create_sink(...)`

Invoke at the top level before any `@dp.append_flow` that references it.

```python
dp.create_sink(
    name="<sink_name>",          # required — referenced as target= in @dp.append_flow
    format="<format>",           # required — "delta", "kafka", or a custom format
    options={...},               # required — format-specific options
)
```

## Delta sinks

Writes to an externally-managed Delta table or a UC volume path. Use three-part names for UC tables.

```python
# Unity Catalog table
dp.create_sink(name="delta_sink", format="delta",
               options={"tableName": "main.sales.transactions"})
# OR volume path
dp.create_sink(name="delta_sink_path", format="delta",
               options={"path": "/Volumes/catalog/schema/transactions"})

@dp.append_flow(name="write_to_delta", target="delta_sink")
def write_transactions():
    return (spark.readStream.table("bronze_transactions")
                 .select("transaction_id", "customer_id", "amount", "timestamp"))
```

## Kafka / Event Hubs sinks

Uses `format="kafka"` for both — only the broker endpoint differs (Event Hubs uses `<namespace>.servicebus.windows.net:9093`).

The output DataFrame **must** include a `value` column containing the serialized payload. Optional output columns: `key`, `partition`, `headers`, `topic`.

```python
dp.create_sink(name="kafka_sink", format="kafka", options={
    "kafka.bootstrap.servers":      "kafka-broker:9092",
    "topic":                        "customer_events",
    "databricks.serviceCredential": "<service_credential_name>",   # UC service credential
})

@dp.append_flow(name="stream_to_kafka", target="kafka_sink")
def kafka_flow():
    return (spark.readStream.table("customer_events")
                 .selectExpr("cast(customer_id as string) AS key",
                             "to_json(struct(*)) AS value"))
```

Authenticate via `databricks.serviceCredential` (UC service credential) — do not hard-code keys or rely on raw `kafka.sasl.*` options for sinks.

## Limitations

- Streaming queries only; sinks are incompatible with batch DataFrames.
- Only `@dp.append_flow` can write to a sink — `@dp.table` cannot write directly to one.
- Pipeline expectations cannot be attached to a sink. Apply validation in upstream tables or views.
- Full refresh re-executes the flow and **appends** to the sink (prior writes are not cleaned up). Design downstream consumers to be idempotent, or manually pre-truncate the target.
- SQL does not support sinks.
