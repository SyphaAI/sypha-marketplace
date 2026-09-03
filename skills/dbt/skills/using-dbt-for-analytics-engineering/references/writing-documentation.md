# Writing project documentation

Never produce documentation that merely repeats the entity's name. Explain **why, not just what**.

Examine the data before writing documentation about it, using discovering-data.

## Table level

Describe the grain of the table, its purpose, and any edge cases

Bad:

```yml
models:
  - name: active_customers
    description: All customers who are active
```

Good:

```yml
models:
  - name: active_customers
    description: The `customers` table pre-filtered for easier analytics. One row per customer whose contract_expiry_date is null or in the future
```

## Column level

Calculated fields should carry a concise description of the transformation applied and its purpose.

Bad:

```yml
models:
  - name: customers
    columns:
      - name: customer_id
        description: The customer's identification number
```

Good:

```yml
models:
  - name: customers
    columns:
      - name: customer_id
        description: Users older than 2020-02-16 have `v1_` prefixed to their customer ID due to the platform migration.
```
