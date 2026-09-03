# Expectations (SQL)

Data-quality constraints defined within `CREATE OR REFRESH STREAMING TABLE` / `MATERIALIZED VIEW` / `CREATE LIVE VIEW` statements. Each constraint is a SQL Boolean expression evaluated on every row; the action taken on a violation is either the default (warn), `DROP ROW`, or `FAIL UPDATE`.

> `CREATE TEMPORARY VIEW` does NOT support `CONSTRAINT` clauses. For the edge case of a "temporary view with expectations," use `CREATE LIVE VIEW` — see [temporary-view-sql.md#using-expectations-with-temporary-views](temporary-view-sql.md#using-expectations-with-temporary-views).

## Syntax

```sql
CREATE OR REFRESH STREAMING TABLE table_name (
  CONSTRAINT name1 EXPECT (cond1),                                  -- warn (default)
  CONSTRAINT name2 EXPECT (cond2) ON VIOLATION DROP ROW,            -- drop violating rows
  CONSTRAINT name3 EXPECT (cond3) ON VIOLATION FAIL UPDATE          -- fail pipeline on first violation
) AS SELECT ...
```

- `constraint_name` must be unique within the dataset and should describe what is being validated.
- `condition` is a SQL Boolean expression. Built-in functions (`year(...)`, `current_date()`, `CASE`, etc.) are allowed. **No** Python UDFs, external calls, or subqueries.
- Multiple `CONSTRAINT` clauses are written as comma-separated entries; each can specify a different action.
- Action semantics:
  - **warn (default)**: violations are logged, but invalid rows are still written to the target. Metrics are collected.
  - **`DROP ROW`**: violating rows are discarded before the write. Metrics are collected.
  - **`FAIL UPDATE`**: the first violation fails the pipeline atomically; the transaction is rolled back and requires a manual fix.

## Patterns

### Mixed actions in one dataset

```sql
CREATE OR REFRESH STREAMING TABLE customers_clean (
  CONSTRAINT valid_email EXPECT (email LIKE '%@%')      ON VIOLATION DROP ROW,
  CONSTRAINT required_id EXPECT (id IS NOT NULL)        ON VIOLATION FAIL UPDATE,
  CONSTRAINT valid_age   EXPECT (age BETWEEN 0 AND 120)                          -- warn only
) AS SELECT * FROM STREAM(raw_customers);
```

### With SQL functions / complex predicates

```sql
CREATE OR REFRESH STREAMING TABLE transactions (
  CONSTRAINT valid_date          EXPECT (year(transaction_date) >= 2020),
  CONSTRAINT non_negative_price  EXPECT (price >= 0),
  CONSTRAINT recent_purchase     EXPECT (transaction_date <= current_date())
) AS SELECT * FROM STREAM(raw_transactions);

CREATE OR REFRESH MATERIALIZED VIEW active_subscriptions (
  CONSTRAINT valid_dates EXPECT (
    start_date <= end_date
    AND end_date <= current_date()
    AND start_date >= '2020-01-01'
  ) ON VIOLATION DROP ROW
) AS SELECT * FROM subscriptions WHERE status = 'active';
```

### Temporary view + expectation (only via `CREATE LIVE VIEW`)

```sql
CREATE LIVE VIEW high_value_customers (
  CONSTRAINT valid_total EXPECT (total_purchases > 0)
) AS
SELECT customer_id, SUM(amount) AS total_purchases
FROM orders
GROUP BY customer_id
HAVING total_purchases > 1000;
```

## Monitoring

Metrics appear in the pipeline UI under the **Data quality** tab and in the event log. They are available for `warn` and `DROP ROW` actions, but not when the pipeline fails before completing.

## Best Practices

- Use unique, descriptive constraint names — they are displayed in metrics.
- Apply `FAIL UPDATE` for critical business invariants (data that must never reach downstream consumers).
- Use `DROP ROW` for data-cleansing operations where losing some rows is acceptable.
- Use the default (warn) for soft quality metrics you want to *track* without blocking the pipeline.
- Keep predicates simple — no Python, subqueries, or UDFs.
