# Writing Data Tests in dbt

Write high-value tests that surface real data problems without consuming warehouse credits on low-signal checks. Testing should prompt action, not accumulate noise.

## When to Use

- Adding tests to new or existing models
- Reviewing test coverage for cost optimization
- After completing data discovery (use discovering-data skill first)
- When stakeholders report data quality issues

## Understanding Data Quality

### Data Hygiene

Issues corrected in the staging/bronze layer. Hygienic data satisfies expectations around formatting (correct values and structure), completeness (no unexpected nulls), and granularity (no duplicates).

### Business-Focused Anomalies

Unexpected behavior relative to what is considered normal in your business. These tests require periodic updates as business context evolves. Revenue swings or user retention changes might stem from a promotion, but could equally indicate a data ingestion problem or transformation logic that is no longer valid.

## Where Tests Belong in the Pipeline

Different pipeline layers require different tests. Avoid duplicating tests for pass-through columns.

### Staging

Detect data hygiene issues and basic anomalies.

```yaml
models:
  - name: stg_orders
    columns:
      - name: order_id
        data_tests:
          - unique
          - not_null
      - name: customer_id
        data_tests:
          - not_null
          - relationships:
              arguments:
                to: ref('stg_customers')
                field: customer_id
      - name: status
        data_tests:
          - accepted_values:
              arguments:
                values: ['pending', 'completed', 'cancelled']
```

### Intermediate

Add tests when grain changes or joins introduce new risks.

```yaml
models:
  - name: int_orders_enriched
    columns:
      - name: order_customer_key
        description: "Composite key created by join"
        data_tests:
          - unique
          - not_null
```

### Marts

Safeguard end-user-facing data. Validate business expectations and newly calculated fields.

```yaml
models:
  - name: fct_orders
    data_tests:
      # Small number of critical business rules
      - dbt_utils.expression_is_true:
          arguments:
            expression: "total_amount >= 0 OR is_refund = true"

```

## The Priority Framework

Not all tests deliver equal value. Use this framework to determine priorities:

### Tier 1: Always Add (Structural Integrity)

| Situation | Test | Why |
|-----------|------|-----|
| Primary key column | `unique` | Broken PKs break everything downstream |
| Primary key column | `not_null` | Broken PKs break everything downstream |
| Foreign key referencing another table | `relationships` | Catches broken joins early |

### Tier 2: Add When Discovery Warrants (Data Quality)

| Situation | Test | Why |
|-----------|------|-----|
| Enum column with known set of values found via proactive discovery or `dbt show` | `accepted_values` | Catches new invalid values |
| Non-PK column used in logic, proactive discovery or `dbt show` confirmed 0% nulls | `not_null` | Catches regressions |

### Tier 3: Selective Use (Business Logic)

| Situation | Test | Why |
|-----------|------|-----|
| Logic spans multiple columns | `expression_is_true` | Detects subtle logic bugs |
| Constrained value set such as ages or dates | `accepted_range` | Avoids illogical values like 200 year old person or login before account creation |

### Tier 4: Avoid Unless Justified

| Test | Problem |
|------|---------|
| `not_null` on every column | Low signal, high cost |
| Multiple `expression_is_true` per model | Expensive, hard to read and maintain |
| `unique` on non-PK columns | Unnecessary and likely wrong |

## Before Writing Tests

Confirm that required packages are installed (see [managing-packages](./managing-packages.md)).

### Review Discovery Findings

If you followed the instructions in [discovering-data](./discovering-data.md), your findings will indicate exactly what to test:

| Discovery Finding | Test Action |
|-------------------|-------------|
| "Verified unique, no nulls" | Add `unique` + `not_null` |
| "X% orphan records" | Add `relationships` with `severity: warn` if >1% |
| "Small number of well-known values present" | Add `accepted_values` |
| "Y% null rate" | Do NOT add `not_null` - nulls are expected |
| "Creation date always in the past" | Add `dbt_utils.accepted_range` |

## Document Debugging Steps

Non-obvious tests should include documented initial debugging steps. Add these to test descriptions or to a shared framework document.

```yaml
models:
  - name: fct_orders
    data_tests:
      - dbt_utils.expression_is_true:
          arguments:
            expression: "total_amount >= 0 OR is_refund = true"
          description: |
            Negative totals indicate calculation errors.
            Debug steps:
            1. Query failed rows using test SQL
            2. Check line_items for same orders in staging
            3. Verify discount logic in int_orders_discounted
```

## Cost-Conscious Testing

### For Large Tables (millions of rows)

Use `where` to constrain scope:

```yaml
- relationships:
    arguments:
      to: ref('dim_users')
      field: user_id
    config:
      where: "created_at >= current_date - interval '7 days'"
```

## Common Mistakes

### Over-testing business logic

Rather than verifying that the SQL executed correctly, focus on assumptions about the data itself that could be wrong and write tests to catch those failures.

```yaml
# WRONG: 10 expression tests for one model
data_tests:
  - dbt_utils.expression_is_true:
      arguments:
        expression: "a > 0"
  - dbt_utils.expression_is_true:
      arguments:
        expression: "b > 0"
  # ... 8 more

# RIGHT: One critical invariant
data_tests:
  - dbt_utils.expression_is_true:
      arguments:
        expression: "total = subtotal + tax + shipping"
```

To validate business logic, write a unit test instead.

### Assuming that you know the contents of a table

```yaml
# WRONG: Guessing at values without context
- name: order_status
  data_tests:
    - accepted_values:
        arguments:
          values: ['placed', 'shipped', 'completed', 'returned']

# RIGHT: Checked actual values during data discovery
- name: order_status
  data_tests:
    - accepted_values:
        arguments:
          values: ['created', 'processing', 'shipped', 'delivered', 'refunded']
```
