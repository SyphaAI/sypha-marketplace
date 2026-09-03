# Persistent Views (SQL, UC)

`CREATE VIEW` publishes a virtual table to Unity Catalog. In contrast to `CREATE TEMPORARY VIEW` (pipeline-private), persistent views are accessible outside the pipeline and remain in the catalog. The query executes on access — no data is stored.

For pipeline-private views, use `CREATE TEMPORARY VIEW` ([temporary-view-sql.md](temporary-view-sql.md)). For materialized output, use `CREATE OR REFRESH MATERIALIZED VIEW` ([materialized-view-sql.md](materialized-view-sql.md)).

## Syntax

```sql
CREATE VIEW view_name
  [COMMENT 'view_comment']
  [TBLPROPERTIES (key = 'value', ...)]
AS query           -- must be batch (no STREAM)
```

## Example

```sql
CREATE VIEW valid_orders
COMMENT 'Orders with valid data for analysis'
TBLPROPERTIES ('quality' = 'silver', 'owner' = 'analytics-team')
AS SELECT *
FROM raw.orders
WHERE order_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND order_date IS NOT NULL;
```

Downstream MVs can reference `valid_orders` directly by name.

## Key rules

- Not materialized — the query runs each time it is accessed.
- Published to UC; requires a UC pipeline with the default publishing mode.
- Batch only — `STREAM(...)` is not permitted.
- `CONSTRAINT` clauses are not supported (no expectations).
- Explicit column lists with `COMMENT` are not supported — comments can be set at the view level only.
- Permissions required: `SELECT` on source tables and `CREATE TABLE` on the target schema.
