## Unit testing incremental models

During unit test configuration, you have the ability to override the output of macros, vars, or environment variables. This allows you to unit test your incremental models in both "full refresh" and "incremental" modes.

### Note
Incremental models must be present in the database before unit tests can run. Use the `--empty` flag to build an empty version of the models and avoid unnecessary warehouse spend. You may also narrow the selection to only your incremental models by using the `--select` flag.

  ```shell
  dbt run --select "config.materialized:incremental" --empty
  ```

  Once that command completes, you can proceed with a regular `dbt build` for that model and then execute your unit test.

When testing an incremental model, the expected output represents the __result of the materialization__ (the rows that will be merged/inserted), not the final state of the model itself (what the table looks like after the merge/insert has occurred).

As an example, consider an incremental model in your project:

`my_incremental_model.sql`

```sql

{{
    config(
        materialized='incremental'
    )
}}

select * from {{ ref('events') }}
{% if is_incremental() %}
where event_time > (select max(event_time) from {{ this }})
{% endif %}

```

Unit tests can be defined on `my_incremental_model` to verify that your incremental logic behaves correctly:

```yml

unit_tests:
  - name: my_incremental_model_full_refresh_mode
    model: my_incremental_model
    overrides:
      macros:
        # unit test this model in "full refresh" mode
        is_incremental: false
    given:
      - input: ref('events')
        rows:
          - {event_id: 1, event_time: 2020-01-01}
    expect:
      rows:
        - {event_id: 1, event_time: 2020-01-01}

  - name: my_incremental_model_incremental_mode
    model: my_incremental_model
    overrides:
      macros:
        # unit test this model in "incremental" mode
        is_incremental: true
    given:
      - input: ref('events')
        rows:
          - {event_id: 1, event_time: 2020-01-01}
          - {event_id: 2, event_time: 2020-01-02}
          - {event_id: 3, event_time: 2020-01-03}
      - input: this
        # contents of current my_incremental_model
        rows:
          - {event_id: 1, event_time: 2020-01-01}
    expect:
      # what will be inserted/merged into my_incremental_model
      rows:
        - {event_id: 2, event_time: 2020-01-02}
        - {event_id: 3, event_time: 2020-01-03}

```

At this time, there is no mechanism to unit test whether the dbt framework correctly inserted/merged records into the existing model, though support for this is being explored in GitHub issue #8664.
