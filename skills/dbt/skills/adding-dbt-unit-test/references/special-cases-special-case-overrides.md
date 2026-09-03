# Unit test overrides

While setting up your unit test, you have the option to override the output of macros, project variables, or environment variables for that specific unit test.

`models/schema.yml`

```yml

 - name: test_my_model_overrides
    model: my_model
    given:
      - input: ref('my_model_a')
        rows:
          - {id: 1, a: 1}
      - input: ref('my_model_b')
        rows:
          - {id: 1, b: 2}
          - {id: 2, b: 2}
    overrides:
      macros:
        type_numeric: override
        invocation_id: 123
      vars:
        my_test: var_override
      env_vars:
        MY_TEST: env_var_override
    expect:
      rows:
        - {macro_call: override, var_call: var_override, env_var_call: env_var_override, invocation_id: 123}

```

## Macros

The output of any macro in your unit test definition can be overridden.

When the model under test uses the following macros, an override is required:
  - `is_incremental`: When unit testing an incremental model, you must explicitly set `is_incremental` to `true` or `false`.

`models/schema.yml`

  ```yml

  unit_tests:
    - name: my_unit_test
      model: my_incremental_model
      overrides:
        macros:
          # unit test this model in "full refresh" mode
          is_incremental: false
      ...

  ```

  - `dbt_utils.star`: When unit testing a model that uses the `star` macro, you must explicitly set `star` to a list of columns. This is necessary because `star` only accepts a relation for its `from` argument; unit test mock input data is injected directly into the model SQL in place of the `ref()` or `source()` function, which causes the `star` macro to fail unless it is overridden.

`models/schema.yml`

  ```yml

  unit_tests:
    - name: my_other_unit_test
      model: my_model_that_uses_star
      overrides:
        macros:
          # explicity set star to relevant list of columns
          dbt_utils.star: col_a,col_b,col_c
      ...

  ```
