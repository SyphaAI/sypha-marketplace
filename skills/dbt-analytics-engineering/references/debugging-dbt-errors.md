# How to debug dbt error messages

## Review logs and artifacts

When tasked with fixing a bug, begin by examining the logs and artifacts from the most recent dbt invocation. See `scripts/review_run_results.md` for an example.

- The `logs/dbt.log` file holds all queries dbt executed along with additional logging. Recent errors appear at the bottom of the file.
- The `target/run_results.json` file lists every model that ran during the most recent invocation and its success or failure status. See `scripts/review_run_results` for sample code.
- The `target/compiled` directory holds the rendered model code as a select statement.
- The `target/run` directory holds that same rendered code wrapped in DDL statements such as `CREATE TABLE AS SELECT`.

If the error originated from the console, read the error message directly.

The error messages dbt produces typically include the error type and the file where it occurred.

## Classify and resolve the error

dbt project errors may stem from several root causes:

### Invalid dbt project configuration

These are likely to be YAML or parsing errors:

```bash
error: dbt1013: YAML error: did not find expected key at line 14 column 7, while parsing a block mapping at line 11 column 5
  --> models/anchor_tests.yml:14:7
```

```bash
Encountered an error:
Parsing Error
  Error reading jaffle_shop: anchor_tests.yml - Runtime Error
    Syntax error near line 14
```

Resolve these by updating the affected files so they conform to the expected YAML structure.

### Invalid model code

These are likely to be compilation or SQL errors, or a failing unit test:

```bash
error: dbt1005: Found duplicate model 'my_first_model'
  --> models/my_first_model.sql
```

```bash
error: dbt0101: mismatched input 'orders' expecting one of 'SELECT', 'TABLE', '('
  --> models/marts/customers.sql:9:1 (target/compiled/models/marts/customers.sql:9:1)
```

```bash
03:16:39  Failure in unit_test test_does_location_opened_at_trunc_to_date (models/staging/stg_locations.yml)
03:16:39

actual differs from expected:

@@,location_id,location_name,tax_rate,opened_date
  ,1          ,Vice City    ,0.2     ,2016-09-01 00:00:00
→ ,2          ,San Andreas  ,0.1     ,2079-10-27 00:00:00→2079-10-27 23:59:59.999900
```

Address these by updating the files referenced in the error message. Correct invalid SQL and verify that the transformations produce the expected output as defined by tests and documentation.

### Invalid data

Invalid data is surfaced during project execution, for example during `dbt build`, `dbt test` or `dbt run`.

```bash
03:29:09  Failure in test accepted_values_customers_customer_type__new__returning (models/marts/customers.yml)
03:29:09    Got 1 result, configured to fail if != 0
03:29:09
03:29:09    compiled code at target/compiled/jaffle_shop/models/marts/customers.yml/accepted_values_customers_customer_type__new__returning.sql
```

Resolution typically requires transforming the underlying data so it aligns with the test's expectations. Apply transformations as early in the DAG as possible, preferably in a staging layer.

Never delete a test or alter a test to force it to pass without explicit permission.

## Check that the error is resolved

After applying the necessary project changes, run the most efficient command to confirm the problem is fixed.

- `dbt parse` is fast and requires no warehouse resources. It detects only dbt project misconfigurations. Since it runs implicitly in all other commands, invoke it explicitly only when the issue is a project misconfiguration rather than invalid models or data.
- `dbt compile --select broken_model` is comparatively fast and inexpensive. It detects SQL errors only when using the dbt Fusion engine (version 2.0 and above).
- `dbt build --select broken_model` is the most thorough way to confirm that a model and its tests are passing, but takes longer and consumes warehouse resources.

When running commands that connect to the warehouse (everything except dbt parse), **ALWAYS** use a `--select` flag to avoid processing the full dbt project and incurring unnecessary resource costs.
