# Planning dbt Models

Before building dbt models, a plan is required. Begin with the intended output and trace backwards to determine the necessary inputs.

## When to Use

Apply this approach when:

- Designing multi-step transformations spanning multiple models
- Getting ready to restructure an existing model or a series of models

## The planning process

### Step 1: Mock the final output

Build a spreadsheet or markdown table representing the **ideal output** you intend to produce. Include:

- Primary key (or surrogate key if one is not available)
- Column names that satisfy business requirements
- Sample data rows (values do not need to be exact)
- The grain/granularity you are targeting
- The materialization strategy that fits the cost and freshness expectations

**Example:** Daily inventory levels

_In practice, use `dbt_utils.generate_surrogate_key` for the surrogate key_

| inventory_level_id       | date       | product_id | product_name | quantity_on_hand | value_on_hand |
|--------------------------|------------|------------|--------------|------------------|---------------|
| 2024-01-01_SKU-001       | 2024-01-01 | SKU-001    | Widget A     | 100              | 2500.00       |
| 2024-01-01_SKU-002       | 2024-01-01 | SKU-002    | Widget B     | 50               | 1250.00       |
| 2024-01-02_SKU-001       | 2024-01-02 | SKU-001    | Widget A     | 95               | 2375.00       |

### Step 2: Mock the SQL query for this output

Write pseudocode or real SQL that would generate this table, even if the source table is not yet known:

```sql
select
  {{ dbt_utils.generate_surrogate_key(['date', 'product_id']) }} as inventory_level_id,
  date_trunc('day', ????) as date,
  product_id,
  sum(???) as quantity_on_hand  -- Need running total, not daily sum
from ???
group by 1, 2
```

**Key insight:** If the query logic cannot be written, the output table structure needs reworking.

### Step 3: Identify gaps and iterate

While writing the query, you will uncover what the **upstream model** must supply:

**Questions to ask:**

- Which date field should serve as the basis for inventory levels?
- Is a cumulative sum across transactions required?
- How should products with no transactions on a given day be handled?
- Is a running balance needed, or are daily aggregates sufficient?

**Example iteration:** Discovered that a running total is required rather than a daily sum. This means window functions over transaction history are needed instead of a simple GROUP BY.

### Step 4: Mock the required upstream models

Based on what the query requires, mock each table being selected from:

**Upstream model:** `product_transactions` (one record per inventory transaction)

| transaction_id | transaction_date | product_id | transaction_type | quantity | unit_cost |
|----------------|------------------|------------|------------------|----------|-----------|
| 1              | 2024-01-01       | SKU-001    | purchase         | 100      | 25.00     |
| 2              | 2024-01-01       | SKU-001    | sale             | -5       | 25.00     |
| 3              | 2024-01-02       | SKU-001    | return           | 3        | 25.00     |
| 4              | 2024-01-01       | SKU-002    | purchase         | 50       | 25.00     |

### Step 5: Update final model SQL based on new upstream structure

Write the query to produce the final output, selecting from the mocked upstream model:

```sql
with running_balance as (
  select
    transaction_date as date,
    product_id,
    transaction_type,
    quantity,
    unit_cost,
    sum(quantity) over (
      partition by product_id
      order by transaction_date, transaction_id
      rows between unbounded preceding and current row
    ) as quantity_on_hand
  from product_transactions
),

end_of_day_balance as (
  select
    date,
    product_id,
    quantity_on_hand,
    unit_cost,
    row_number() over (partition by product_id, date order by transaction_id desc) as rn
  from running_balance
)

select
  date,
  product_id,
  'Widget ' || right(product_id, 1) as product_name,  -- TODO: join to product dimension
  quantity_on_hand,
  quantity_on_hand * unit_cost as value_on_hand
from end_of_day_balance
where rn = 1
```

This exposes the need for:

- The upstream `product_transactions` table
- Logic to retrieve the last transaction of each day (running balance at EOD)
- A product dimension table to supply accurate product names

### Step 6: Match with input data

With the required inputs now identified, examine the actual resources available in the dbt project:

- Which tables exist?
- What grain do they use?
- Do multiple tables need to be unioned?
- What joins will be necessary?

Listed in order of preference, the possible outcomes are:

| Priority | Scenario | Behaviour |
|----------|----------|-----------|
| 1 | Exact match exists | Use it directly |
| 2 | Partial match exists | Extend it, plan changes recursively if needed |
| 3 | No match | Create a new model, recursively repeating the planning process |

### Step 7: Consider edge cases and produce failing unit tests

Address edge cases early rather than deferring them:

- What happens if multiple transactions occur on the same day for one product?
- What happens if a product has no transactions for several days?
- How should null transaction dates or quantities be handled?

Add unit tests for the planned models using mocked inputs from the identified dependencies. These tests should fail until the model is correctly implemented.

### Step 8: Implement the planned models

After tracing back to existing models or source data, implement using real code. Reuse existing models wherever possible.

Execute the unit tests to confirm the model meets requirements.

## Practical Tips

### Use placeholder columns

When building incrementally, use placeholder columns to establish the interface:

```sql
select
  transaction_date,
  product_id,
  quantity,
  null::integer as quantity_on_hand -- TODO: implement cumulative sum window function
from {{ ref('stg_inventory_transactions') }}
```

### Document your planning

Place a markdown file alongside your models:

```markdown
## Goal
Calculate daily inventory levels per product

## Final output grain
One row per product per day

## Intermediate model grain
One row per transaction with running balance

## Required transformations
1. Combine purchase, sale, and return transaction types
2. Add window function for cumulative quantity on hand
3. Filter to end-of-day balance per product

## Unit tests
- Running balance correctly accumulates across multiple transactions for same product
- End-of-day quantity reflects the last transaction when multiple occur on the same day
- Value on hand equals quantity on hand multiplied by unit cost
```

## Common Pitfalls

**Writing code before the output is understood**. Results in repeated refactoring and ambiguous model purposes.

**Failing to iterate on the mockup**. If the SQL cannot be written, revise the output structure.

**Neglecting data quality**. Account for null handling, duplicates, and edge cases during planning.

## Related Concepts

- **Test-Driven Development (TDD)**: Similar philosophy of defining expected output first
- **Kimball Methodology**: Start with business questions, work back to data requirements
- **Dimensional Modeling**: Understanding fact/dimension grain before implementation
