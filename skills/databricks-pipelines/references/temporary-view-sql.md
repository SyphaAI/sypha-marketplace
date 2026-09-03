# Temporary Views (SQL)

Pipeline-scoped logical datasets that are not materialized and not published to UC. Used for shared intermediate transformations that feed multiple downstream tables.

```sql
CREATE TEMPORARY VIEW view_name
  [ (col_name [COMMENT 'col_comment'], ...) ]
  [ COMMENT 'view_comment' ]
  [ TBLPROPERTIES (key = 'value', ...) ]
AS query           -- batch or streaming
```

## Example

```sql
-- Shared filtering logic, consumed by multiple downstream MVs
CREATE TEMPORARY VIEW valid_events
AS SELECT * FROM raw.events
WHERE event_type IS NOT NULL AND timestamp IS NOT NULL;

CREATE OR REFRESH MATERIALIZED VIEW user_events
AS SELECT * FROM valid_events WHERE event_type = 'user_action';
-- Other downstream MVs follow the same shape.
```

Streaming source: `CREATE TEMPORARY VIEW ... AS SELECT ... FROM STREAM(bronze.events) WHERE ...` — downstream streaming tables consume it via `FROM STREAM(view_name)`.

## Using Expectations with Temporary Views

`CREATE TEMPORARY VIEW` does NOT support `CONSTRAINT` clauses. In the rare case where expectations on a temp view are required, use `CREATE LIVE VIEW` (older syntax, retained specifically for this purpose):

```sql
CREATE LIVE VIEW view_name (
  CONSTRAINT constraint_name EXPECT (condition) [ON VIOLATION DROP ROW | FAIL UPDATE]
) AS query
```

See [expectations-sql.md](expectations-sql.md) for complete constraint semantics. In general, prefer attaching constraints to a downstream streaming table or MV instead.

## Key rules

- Evaluated on demand — not materialized to storage.
- Pipeline-scoped — not published to UC and removed after the pipeline run.
- Reference in downstream queries as `FROM view_name` (batch) or `FROM STREAM(view_name)` (streaming).
- A temp view name takes precedence over any same-named catalog object within the pipeline.
- For UC-published views, use `CREATE VIEW` ([view-sql.md](view-sql.md)).
