---
title: "dbt: Asset Checks"
triggers:
  - "how dbt tests map to Dagster asset checks"
---

# Asset Checks

By default, dbt tests are automatically loaded as Dagster asset checks (this behavior is available starting in dagster-dbt 0.23.0+).

## Enabling Source Tests

Tests on dbt models are the only ones loaded as checks by default. To also include tests on sources:

**Component approach:**

```yaml
attributes:
  translator_settings:
    enable_source_tests_as_checks: true
```

**Pythonic approach:**

```python nocheck
from dagster_dbt import DagsterDbtTranslator, DagsterDbtTranslatorSettings

translator = DagsterDbtTranslator(
    settings=DagsterDbtTranslatorSettings(
        enable_source_tests_as_checks=True
    )
)

@dbt_assets(
    manifest=my_dbt_project.manifest_path,
    dagster_dbt_translator=translator
)
def my_dbt_assets(context, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()
```

## Singular Tests with Multiple Dependencies

When a singular test has dependencies on multiple models, declare the target model inside the test's config
block:

```sql
{{
    config(
        meta={
            'dagster': {
                'ref': {
                    'name': 'customers',
                    'package': 'my_dbt_assets',
                    'version': 1,
                },
            }
        }
    )
}}

SELECT ...
```

The `ref` structure follows the same shape as dbt's
[ref function](https://docs.getdbt.com/reference/dbt-jinja-functions/ref) parameters. If this
metadata is omitted, the test continues to execute but produces an AssetObservation rather than an asset check result.
