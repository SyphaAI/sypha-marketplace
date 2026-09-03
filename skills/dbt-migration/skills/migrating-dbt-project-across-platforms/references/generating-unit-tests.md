# Generating Unit Tests for Cross-Platform Migration

## PROBLEM

Prior to migrating to a target platform, it is necessary to capture expected data outputs from the source platform. dbt unit tests function as a "golden dataset" that demonstrates data consistency after migration — when identical inputs yield identical outputs on both platforms, the migration has preserved business logic.

## SOLUTION

### Which models to test

The primary criterion is **DAG position**, not naming convention. Focus on:

1. **Leaf nodes** — Models at the very end of the DAG that no other **model** depends on (exposures, metrics, and semantic models don't count — only model-to-model `ref()` dependencies matter). These are the final outputs consumed by BI tools, reverse ETL, exports, and downstream systems. **Every leaf node must have a unit test** — no exceptions. See the "Identifying leaf nodes" section below for reliable methods.
2. **Models with significant transformation logic** — Even if mid-DAG, any model containing complex joins, calculations, or case statements should be tested. The greater the business logic a model holds, the more critical verification becomes.

**Skip**:
- **Staging models** — Simple 1:1 source mappings; when sources are correct, staging will also be correct
- **Pass-through models** — Models that only rename columns or filter rows without any business logic

**If leaf nodes follow common naming conventions** (e.g., `fct_*`, `dim_*`, `agg_*`), that provides a useful heuristic — but it should not be relied on exclusively. A model named `customer_summary` at the end of the DAG is equally important to test as one named `dim_customers`.

### Identifying leaf nodes

**Do not guess leaf nodes from naming conventions.** They must be derived programmatically. A leaf node is an enabled model that is not referenced via `ref()` by any other enabled model. Exposures, metrics, and semantic models referencing a model do NOT disqualify it as a leaf node.

**Method 1: Set difference with `dbt ls` (recommended)**

```bash
# Step 1: Get all enabled model unique IDs
dbt ls --resource-type model --output json | jq -r '.unique_id' | sort > /tmp/all_models.txt

# Step 2: Get all model unique IDs that appear as a dependency of another model
dbt ls --resource-type model --output json | jq -r '.depends_on.nodes[]?' | grep '^model\.' | sort -u > /tmp/parent_models.txt

# Step 3: Leaf nodes = all models minus those that are parents
comm -23 /tmp/all_models.txt /tmp/parent_models.txt
```

**Method 2: Read the model SQL files directly**

If `dbt ls` is unavailable or impractical, scan all `.sql` files under `models/` and construct the ref graph manually:

1. List all enabled model file names (check `dbt_project.yml` for `+enabled: false` to exclude disabled models)
2. For each model, extract all `ref('model_name')` calls
3. Build a set of "referenced models" — any model name that appears inside a `ref()` in another model's SQL
4. Leaf nodes = all enabled models whose name does NOT appear in the "referenced models" set

**Method 3: dbt MCP tools (if available)**

Use `get_model_children` for each model. Models with no children (or children that consist only of exposures/metrics/semantic models) are leaf nodes.

**Important**: After identifying leaf nodes, enumerate all of them explicitly and confirm the count before writing unit tests. Do not assume 2-3 leaf nodes simply because only `fct_*` and `dim_*` names are visible — utility models, aggregates, incremental variants, and unconventionally named models are all potential leaf nodes.

### How to select test rows

Use `dbt show` to preview model outputs on the source platform:

```bash
dbt show --select fct_orders --limit 10
```

**Choose rows that exercise key logic**:
- Rows that hit different branches of `CASE WHEN` statements
- Rows with NULL values in columns that contain COALESCE/NVL logic
- Rows with edge case values (zero quantities, negative amounts, boundary dates)
- At a minimum, 2-3 rows per model

### Writing unit tests

Place unit tests in the model's YAML file or a dedicated `_unit_tests.yml` file within the same directory. Use the `dict` format for readability:

```yaml
unit_tests:
  - name: test_fct_orders_basic
    description: "Verify core order calculations"
    model: fct_orders
    given:
      - input: ref('stg_orders')
        rows:
          - {order_key: 1, customer_key: 100, order_date: '1998-01-01', status_code: 'F', total_price: 150.00}
          - {order_key: 2, customer_key: 200, order_date: '1998-06-15', status_code: 'O', total_price: 0.00}
      - input: ref('stg_line_items')
        rows:
          - {order_key: 1, line_number: 1, extended_price: 100.00, discount: 0.05, tax: 0.08}
          - {order_key: 1, line_number: 2, extended_price: 50.00, discount: 0.00, tax: 0.08}
          - {order_key: 2, line_number: 1, extended_price: 0.00, discount: 0.00, tax: 0.00}
    expect:
      rows:
        - {order_key: 1, customer_key: 100, order_status: 'fulfilled', gross_amount: 150.00}
        - {order_key: 2, customer_key: 200, order_status: 'open', gross_amount: 0.00}
```

For detailed unit test authoring guidance, refer to the `adding-dbt-unit-test` skill if it is available.

### Verify tests pass on source platform

Before beginning migration, confirm that all unit tests pass on the source:

```bash
dbt test --select test_type:unit
```

All tests must pass. If any fail, resolve them before proceeding — failures on the source platform point to a test authoring issue, not a migration issue.

## CHALLENGES

### Large or complex models

For models with many input sources or complex joins:
- Begin with a minimal test that covers the primary join path
- Add additional tests for specific business logic branches
- Every column does not need testing — focus on calculated/derived columns

### Handling platform-specific functions in test data

When the source model uses platform-specific functions that produce particular data types:
- Use literal values in test expectations rather than function calls
- Concentrate on the business-meaningful output values, not intermediate representations

### Models with many columns

Every column does not need to appear in the `expect` block. Include only those columns where business logic has been applied — columns that are simple pass-throughs from inputs do not require explicit verification.

### Incremental models

For incremental models, unit tests should validate the transformation logic rather than the incremental behavior. Supply input rows and verify the output — the incremental strategy is a materialization concern, not a logic concern.

### Using dbt show for quick validation

Before authoring formal unit tests, use `dbt show` to examine what a model produces:

```bash
# Preview output
dbt show --select model_name --limit 5

# Preview with inline filter for specific scenarios
dbt show --inline "select * from {{ ref('model_name') }} where status = 'returned'" --limit 5
```

This helps in selecting representative test rows and understanding the expected output format.
