---
title: "dbt: Component-Based Integration"
triggers:
  - "configuring or customizing DbtProjectComponent"
---

# Component-Based Integration

The Component-based approach relies on `DbtProjectComponent` to declare dbt assets through YAML configuration.
This is the recommended path for new projects.

> For initial setup and scaffolding, see [Scaffolding](scaffolding.md).

## Overview

`DbtProjectComponent` is a StateBackedComponent that handles compilation and caching of your dbt
project's manifest. See
[StateBackedComponents](../../components/state-backed/using.md) for general
state management patterns.

### dbt-Specific State Management

**What state is managed**: The dbt `manifest.json` file, which holds all dbt models, tests,
sources, and their relationships.

**How it's compiled**: Executes `dbt parse` (and `dbt deps` when necessary) to produce the manifest.

**Configuration**: Use the `prepare_if_dev` setting to control whether the manifest is recompiled during
local development (defaults to `true`).

In CI/CD, run `dg utils refresh-defs-state` or `dg plus deploy refresh-defs-state` to compile the
manifest prior to deployment.

## Basic Configuration

### Selecting Models

Apply dbt selection syntax to restrict which models are included:

```yaml
attributes:
  select: "tag:daily"
  exclude: "tag:deprecated"
```

### CLI Arguments

Adjust the dbt command run during asset materialization:

```yaml
attributes:
  cli_args:
    - build
    - --full-refresh
```

CLI args accept template variables for dynamic values derived from the execution context.

## Translation and Customization

### Simple Customization: YAML Translation Block

For straightforward metadata adjustments, use the `translation` block:

```yaml
attributes:
  translation:
    group_name: analytics
    description: "dbt model {{ node.name }}"
```

Template variables can access the dbt node properties.

### Advanced Customization: Subclassing

For more involved customization, create a subclass and override `get_asset_spec()`:

```python
from collections.abc import Mapping
from typing import Any, Optional

import dagster as dg
from dagster_dbt import DbtProject, DbtProjectComponent


class CustomDbtComponent(DbtProjectComponent):
    def get_asset_spec(
        self,
        manifest: Mapping[str, Any],
        unique_id: str,
        project: Optional[DbtProject],
    ) -> dg.AssetSpec:
        base_spec = super().get_asset_spec(manifest, unique_id, project)
        dbt_props = self.get_resource_props(manifest, unique_id)

        return base_spec.merge_attributes(metadata={"model_name": dbt_props["name"]})
```

Then reference your custom component in `defs.yaml`:

```yaml
type: my_project.components.custom_dbt_component.CustomDbtComponent
```

### dbt Meta Config

Add custom metadata in your dbt project files for consumption by your custom
`get_asset_spec()` implementation:

```yaml
models:
  - name: customers
    meta:
      custom_field: custom_value
```

This metadata is available through the manifest in your translator code.

## Incremental Models and Partitioning

To set up partitioning for incremental dbt models:

1. Declare a partitions definition as a template variable
2. Attach it to assets via `post_processing`
3. Supply partition-specific vars through `cli_args`

```yaml
template_vars_module: .template_vars

attributes:
  cli_args:
    - build
    - --vars:
      min_date: "{{ context.partition_time_window.start.strftime('%Y-%m-%d') }}"
      max_date: "{{ context.partition_time_window.end.strftime('%Y-%m-%d') }}"

post_processing:
  assets:
    - target: "*"
      attributes:
        partitions_def: "{{ my_partitions_def }}"
```

The `context.partition_time_window` variable is available within `cli_args` at execution time. Dagster
automatically serializes the vars dict to JSON format for the dbt CLI.

When working with multiple partitions definitions, create separate `DbtProjectComponent` instances and use
`select` to scope models for each one.

## Metadata

Activate automatic metadata collection during materialization:

```yaml
attributes:
  include_metadata:
    - row_count
    - column_metadata
```

- `row_count`: Fetch row counts for tables
- `column_metadata`: Fetch column schema and lineage (extracted via sqlglot parsing)

Both metadata types are retrieved in parallel during dbt execution.

## Asset Checks

See [Asset Checks](asset-checks.md) for details on how dbt tests are loaded as Dagster asset checks.

## Dependencies

See [Dependencies](dependencies.md) for details on how Dagster parses dbt project dependencies and
patterns for defining additional dependencies.

### Referencing dbt Models in Other Components

Use the `asset_key_for_model` method to refer to dbt models from other components:

```yaml
type: dagster.PythonScriptComponent
attributes:
  script_path: export_customers.py
  dependencies:
    - "{{ context.load_component('dbt_component').asset_key_for_model('customers') }}"
```

## Scheduling

Use the standard Dagster scheduling mechanisms with asset selections:

```python
import dagster as dg

daily_dbt_job = dg.define_asset_job(
    name="daily_dbt_models",
    selection=dg.AssetSelection.groups("analytics"),
)

daily_schedule = dg.ScheduleDefinition(
    job=daily_dbt_job,
    cron_schedule="0 0 * * *",
)
```

For declarative automation, set up AutomationConditions through a custom `get_asset_spec()`
implementation.

## Runtime Configuration

Override the `execute()` method to adjust execution behavior:

```python
from collections.abc import Iterator

import dagster as dg
from dagster_dbt import DbtCliResource, DbtProjectComponent


class ConfigurableDbtComponent(DbtProjectComponent):
    @property
    def op_config_schema(self) -> type[dg.Config]:
        class DbtConfig(dg.Config):
            full_refresh: bool = False

        return DbtConfig

    def execute(
        self, context: dg.AssetExecutionContext, dbt: DbtCliResource
    ) -> Iterator:
        if context.op_config.get("full_refresh"):
            args = ["build", "--full-refresh"]
        else:
            args = self.get_cli_args(context)

        yield from dbt.cli(args, context=context).stream()
```

Declare the `op_config_schema` property to specify which config options are available.

## dbt Cloud

For dbt Cloud projects, see [dbt Cloud Integration](dbt-cloud.md).
