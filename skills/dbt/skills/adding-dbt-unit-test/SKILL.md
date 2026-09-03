---
name: adding-dbt-unit-test
description: Generates unit test YAML definitions that mock upstream model inputs and validate expected outputs. Use when adding unit tests for a dbt model or practicing test-driven development (TDD) in dbt.
user-invocable: false
metadata:
  author: dbt-labs
---

# Add unit test for a dbt model

## Additional Resources

- [Spec Reference](references/spec.md) - All required and optional YAML keys for unit tests
- [Examples](references/examples.md) - Unit test examples across formats (dict, csv, sql)
- [Incremental Models](references/special-cases-incremental-model.md) - Unit testing incremental models
- [Ephemeral Dependencies](references/special-cases-ephemeral-dependency.md) - Unit testing models depending on ephemeral models
- [Special Case Overrides](references/special-cases-special-case-overrides.md) - Introspective macros, project variables, environment variables
- [Versioned Models](references/special-cases-versioned-model.md) - Unit testing versioned SQL models
- [BigQuery Caveats](references/warehouse-bigquery-caveats.md) - BigQuery-specific caveats
- [BigQuery Data Types](references/warehouse-bigquery-data-types.md) - BigQuery data type handling
- [Postgres Data Types](references/warehouse-postgres-data-types.md) - Postgres data type handling
- [Redshift Caveats](references/warehouse-redshift-caveats.md) - Redshift-specific caveats
- [Redshift Data Types](references/warehouse-redshift-data-types.md) - Redshift data type handling
- [Snowflake Data Types](references/warehouse-snowflake-data-types.md) - Snowflake data type handling
- [Spark Data Types](references/warehouse-spark-data-types.md) - Spark data type handling

## What are unit tests in dbt

dbt unit tests verify SQL modeling logic against static inputs before the model is materialized in production. If any unit test for a model fails, dbt will not materialize that model.

## When to use

Unit test a model when:
- Defining Model-Input-Output scenarios for the intended behavior of the model as well as edge cases to prevent regressions if the model logic is modified at a later date.
- Confirming that a bug fix resolves a bug report for an existing dbt model.

Additional examples:
- When your SQL contains complex logic:
    - Regex
    - Date math
    - Window functions
    - `case when` statements when there are many `when`s
    - Truncation
    - Complex joins (multiple joins, self-joins, or joins with non-trivial conditions)
- When you are writing custom logic to process input data, analogous to writing a function.
- Logic for which bugs have been reported previously.
- Edge cases not yet present in your actual data that you want to be sure are handled correctly.
- Before refactoring transformation logic (particularly when the refactor is significant).
- Models with high "criticality" (public, contracted models or models directly upstream of an exposure).

## When not to use

Cases where creating unit tests is not recommended:
- Built-in functions that are already thoroughly tested by the warehouse provider. When an unexpected issue arises, it is more likely caused by problems in the underlying data than in the function itself. In those situations, fixture data in the unit test will not provide useful information.
    - common SQL spec functions like `min()`, etc.

## General format

dbt unit tests are structured around a trio of the model, given inputs, and expected outputs (Model-Inputs-Outputs):

1. `model` - when building this model
2. `given` inputs - given a set of source, seeds, and models as preconditions
3. `expect` output - then expect this row content of the model as a postcondition

### Workflow

### 1. Choose the model to test

Self explanatory -- the title says it all!

### 2. Mock the inputs

- Create an input for each node the model depends on.
- Specify the mock data it should use.
- Specify the `format` if it differs from the default (YAML `dict`).
  - See the "Data `format`s for unit tests" section below to determine which `format` to use.
- The mock data only needs to include the subset of columns used within this test case.

**Tip:** Use `dbt show` to inspect existing data from upstream models or sources. This helps you understand realistic input structures. However, always sanitize the sample data to remove any sensitive or PII information before using it in your unit test fixtures.

```shell
# Preview upstream model data
dbt show --select upstream_model --limit 5
```

### 3. Mock the output

- Specify the data you expect the model to produce given those inputs.
- Specify the `format` if it differs from the default (YAML `dict`).
  - See the "Data `format`s for unit tests" section below to determine which `format` to use.
- The mock data only needs to include the subset of columns used within this test case.

## Minimal unit test

Suppose you have this model:

```sql
-- models/hello_world.sql

select 'world' as hello
```

Minimal unit test for that model:

```yaml
# models/_properties.yml

unit_tests:
  - name: test_hello_world

    # Always only one transformation to test
    model: hello_world

    # No inputs needed this time!
    # Most unit tests will have inputs -- see the "real world example" section below
    given: []

    # Expected output can have zero to many rows
    expect:
      rows:
        - {hello: world}
```

## Executing unit tests

Run the unit tests, build the model, and execute the data tests for the `hello_world` model:

```shell
dbt build --select hello_world
```

This conserves warehouse spend because the model will only be materialized and proceed to data tests if the unit tests pass successfully.

Or run only the unit tests without building the model or running the data tests:

```shell
dbt test --select "hello_world,test_type:unit"
```

Or choose a specific unit test by name:

```shell
dbt test --select test_is_valid_email_address
```

### Excluding unit tests from production builds

dbt Labs strongly recommends restricting unit tests to development or CI environments. Because the unit test inputs are static, there is no value in consuming additional compute cycles by running them in production. Use them during development for a test-driven approach and in CI to confirm that changes do not break them.

Use the `--resource-type` flag `--exclude-resource-type` or the `DBT_EXCLUDE_RESOURCE_TYPES` environment variable to omit unit tests from your production builds and reduce compute usage.

## More realistic example

```yaml
unit_tests:

  - name: test_order_items_count_drink_items_with_zero_drinks
    description: >
      Scenario: Order without any drinks
        When the `order_items_summary` table is built
        Given an order with nothing but 1 food item
        Then the count of drink items is 0

    # Model
    model: order_items_summary

    # Inputs
    given:
      - input: ref('order_items')
        rows:
          - {
              order_id: 76,
              order_item_id: 3,
              is_drink_item: false,
            }
      - input: ref('stg_orders')
        rows:
          - { order_id: 76 }

    # Output
    expect:
      rows:
        - {
            order_id: 76,
            count_drink_items: 0,
          }
```

For more examples of unit tests, see [references/examples.md](references/examples.md)

## Supported and unsupported scenarios

- dbt only supports unit testing SQL models.
    - Unit testing Python models is not supported.
    - Unit testing non-model nodes like snapshots, seeds, sources, analyses, etc. is not supported.
- dbt only supports adding unit tests to models in your _current_ project.
    - Unit testing cross-project models or models imported from a package is not supported.
- dbt _does not_ support unit testing models that use the `materialized view` materialization.
- dbt _does not_ support unit testing models that use recursive SQL.
- dbt _does not_ support unit testing models that use introspective queries.
- dbt _does not_ support an `expect` output for final state of the database table after inserting/merging for incremental models.
- dbt _does_ support an `expect` output for what will be merged/inserted for incremental models.

## Handy to know

- Unit tests must be defined in a YAML file in your `model-paths` directory (`models/` by default)
- Fixture files for unit tests must be defined in a SQL or CSV file in your `test-paths` directory (`tests/fixtures` by default)
- Include all `ref` or `source` model references in the unit test configuration as `input`s to prevent "node not found" errors during compilation.
- When your model has multiple versions, the unit test runs on *all* versions by default.
- To unit test a model that depends on an ephemeral model, you must use `format: sql` for the ephemeral model input.
- Table names within the model must be aliased in order to unit test `join` logic

## YAML for specifying unit tests

- For all the required and optional keys in the YAML definition of unit tests, see [references/spec.md](references/spec.md)

# Inputs for unit tests

Use `input`s in your unit tests to point to a specific model or source:

-  For `input:`, use a string that represents a `ref` or `source` call:
    - `ref('my_model')` or `ref('my_model', v='2')` or `ref('dougs_project', 'users')`
    - `source('source_schema', 'source_name')`
- For seed inputs:
    - If you do not supply an input for a seed, we will use the seed's CSV file _as_ the input.
    - If you do supply an input for a seed, we will use that input instead.
- Use “empty” inputs by setting rows to an empty list `rows: []`
    - This is useful if the model has a `ref` or `source` dependency, but its values are irrelevant to this particular unit test. Just beware if the model has a join on that input that would cause rows to drop out!

`models/schema.yml`

```yaml
unit_tests:
  - name: test_is_valid_email_address  # this is the unique name of the test
    model: dim_customers  # name of the model I'm unit testing
    given:  # the mock data for your inputs
      - input: ref('stg_customers')
        rows:
         - {email: cool@example.com,     email_top_level_domain: example.com}
         - {email: cool@unknown.com,     email_top_level_domain: unknown.com}
         - {email: badgmail.com,         email_top_level_domain: gmail.com}
         - {email: missingdot@gmailcom,  email_top_level_domain: gmail.com}
      - input: ref('top_level_email_domains')
        rows:
         - {tld: example.com}
         - {tld: gmail.com}
      - input: ref('irrelevant_dependency')  # dependency that we need to acknowlege, but does not need any data
        rows: []
...

```

# Data `format`s for unit tests

dbt supports three formats for specifying mock data within unit tests:

1. `dict` (default): Inline YAML dictionary values.
2. `csv`: Inline CSV values or a CSV file.
3. `sql`: Inline SQL query or a SQL file.

For examples of each format, see [references/examples.md](references/examples.md)

## How to choose the `format`

- Use the `dict` format by default, falling back to another format only when necessary.
- Use the `sql` format when testing a model that depends on an `ephemeral` model
- Use the `sql` format when unit testing a column whose data type is not supported by the `dict` or `csv` formats.
- Use the `csv` or `sql` formats when working with a fixture file. Prefer `csv`, but fall back to `sql` if any column data types are not supported by the `csv` format.
- The `sql` format is the least readable and requires supplying mock data for _all_ columns, so prefer other formats where possible. It is also the most flexible and should serve as the fallback when `dict` or `csv` cannot be used.

Notes:
- For the `sql` format you must supply mock data for _all columns_, whereas `dict` and `csv` require only a subset.
- Only the `sql` format supports unit testing a model that depends on an ephemeral model — `dict` and `csv` cannot be used in that case.
- No format supports Jinja.

### Fixture files

The `dict` format only supports inline YAML mock data, but you can also use `csv` or `sql` either inline or in a separate fixture file. Store your fixture files in a `fixtures` subdirectory in any of your `test-paths`. For example, `tests/fixtures/my_unit_test_fixture.sql`.

When using the `dict` or `csv` format, you only have to define the mock data for the columns relevant to you. This enables you to write succinct and _specific_ unit tests. For the `sql` format _all_ columns need to be defined.

## Special cases

- Unit testing incremental models. See [references/special-cases-incremental-model.md](references/special-cases-incremental-model.md).
- Unit testing a model that depends on ephemeral model(s). See [references/special-cases-ephemeral-dependency.md](references/special-cases-ephemeral-dependency.md).
- Unit test a model that depends on any introspective macros, project variables, or environment variables. See [references/special-cases-special-case-overrides.md](references/special-cases-special-case-overrides.md).
- Unit testing versioned SQL models. See [references/special-cases-versioned-model.md](references/special-cases-versioned-model.md).

### Platform/adapter-specific caveats

Platform-specific details are required when implementing on Redshift, BigQuery, and similar platforms. Read the caveats file for your database if one exists:

- [references/warehouse-bigquery-caveats.md](references/warehouse-bigquery-caveats.md)
- [references/warehouse-redshift-caveats.md](references/warehouse-redshift-caveats.md)

# Platform/adapter-specific data types

Unit tests are intended to verify expected _values_, not data types themselves. dbt takes the value you supply and attempts to cast it to the data type inferred from the input and output models.

The way you specify input and expected values in unit test YAML definitions is largely consistent across data warehouses, with some variation for more complex data types.

Read the data types file for your database:

- [references/warehouse-bigquery-data-types.md](references/warehouse-bigquery-data-types.md)
- [references/warehouse-postgres-data-types.md](references/warehouse-postgres-data-types.md)
- [references/warehouse-redshift-data-types.md](references/warehouse-redshift-data-types.md)
- [references/warehouse-snowflake-data-types.md](references/warehouse-snowflake-data-types.md)
- [references/warehouse-spark-data-types.md](references/warehouse-spark-data-types.md)

# Disabling a unit test

By default, all specified unit tests are enabled and will be included based on the `--select` flag.

To prevent a unit test from running, set:
```yaml
    config:
      enabled: false
```

This is useful when a unit test is failing incorrectly and must be disabled until the underlying issue is resolved.

### When a unit test fails

When a unit test fails, a log message reading "actual differs from expected" is produced, and a "data diff" is displayed between the two outputs:

```
actual differs from expected:

@@ ,email           ,is_valid_email_address
→  ,cool@example.com,True→False
   ,cool@unknown.com,False
```

There are two primary reasons a unit test can fail:

1. There was an error in how the unit test was constructed (false positive)
2. There is a bug in the model (true positive)

Distinguishing between the two requires expert judgement.

### The `--empty` flag

The direct parents of the model that you’re unit testing need to exist in the warehouse before you can execute the unit test. The `run` and `build` commands supports the `--empty` flag for building schema-only dry runs. The `--empty` flag limits the `ref`s and `sources` to zero rows. dbt will still execute the model SQL against the target data warehouse but will avoid expensive reads of input data. This validates dependencies and ensures your models will build properly.

Use the `--empty` flag to build an empty version of the models to save warehouse spend.

```bash

dbt run --select "stg_customers top_level_email_domains" --empty

```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Testing simple SQL using built-in functions | Only unit test complex logic: regex, date math, window functions, multi-condition case statements |
| Mocking all columns in input data | Only include columns relevant to the test case |
| Using `sql` format when `dict` works | Prefer `dict` (most readable), fall back to `csv` or `sql` only when needed |
| Missing `input` for a `ref` or `source` | Include all model dependencies to avoid "node not found" errors |
| Testing Python models or snapshots | Unit tests only support SQL models |
