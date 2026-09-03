# Temporary Views (Python)

Pipeline-scoped logical datasets that are not materialized and not published to UC. They are intended for shared intermediate transformations that feed multiple downstream tables.

`@dp.temporary_view()` is the current decorator. Legacy `@dlt.view()` (and `@dp.view()` found in older code) should be migrated — see [SKILL.md Legacy DLT Syntax](../SKILL.md#legacy-dlt-syntax--always-migrate).

```python
@dp.temporary_view(name="<name>", comment="<comment>")     # both optional
def my_view():
    return spark.read.table("source.data")          # batch — or spark.readStream.table(...) for streaming
```

Downstream tables reference the view by name using `spark.read.table("my_view")` or `spark.readStream.table("my_view")`.

## Example

```python
@dp.temporary_view()
def valid_events():
    return (spark.read.table("raw.events")
                 .filter("event_type IS NOT NULL")
                 .filter("timestamp IS NOT NULL"))

@dp.materialized_view()
def user_events():
    return spark.read.table("valid_events").filter("event_type = 'user_action'")
# Other downstream MVs follow the same shape.
```

Streaming variant: return `spark.readStream.*` from the temp view; downstream `@dp.table()` consumes it via `spark.readStream.table(...)`.

## Key rules

- Evaluated on demand — not materialized to storage.
- Can be either batch or streaming, depending on the type of DataFrame returned.
- Pipeline-scoped — not visible outside the pipeline run.
- Column masks, row filters, and `cluster_by` cannot be applied (it is not a table).
