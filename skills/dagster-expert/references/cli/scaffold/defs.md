---
title: dg scaffold defs
triggers:
  - "adding new definitions (assets, schedules, sensors, components) to a project"
---

`dg scaffold defs` is the recommended approach for adding new definitions to a project. It automatically places new code in the appropriate location.

## Python Definition Objects

Generates a single `.py` file at the given path (relative to `defs/`). ALWAYS include the `.py` extension.

```bash
dg scaffold defs dagster.asset assets/my_asset.py
dg scaffold defs dagster.schedule schedules/daily.py
dg scaffold defs dagster.sensor sensors/watcher.py
```

## Component Types

Creates a component directory containing a `defs.yaml` file. Extra arguments can be supplied through flags or `--json-params`.

**Important**: After scaffolding a custom component with `dg scaffold component`, run `dg list components` to obtain the exact registered type path. The path incorporates the file module name — e.g. `my_project.components.my_component.MyComponent`, not `my_project.components.MyComponent`.

```bash
dg scaffold defs some_lib.SomeComponent my_component

# With flags
dg scaffold defs dagster_dbt.DbtProjectComponent my_dbt --project-dir dbt_project

# With JSON params
dg scaffold defs dagster_dbt.DbtProjectComponent my_dbt --json-params '{"project_dir": "dbt_project"}'
```

## Inline Components

For single-use components, use `inline-component` to place the component class definition directly under `defs/` alongside its `defs.yaml`. If the component will be reused, use `dg scaffold component` instead.

```bash
dg scaffold defs inline-component
```

## Important: Always run `dg list defs` to confirm the definitions were scaffolded correctly

## Inspecting Components Before Scaffolding

To review a component's scaffold parameters or `defs.yaml` schema prior to scaffolding, use [`dg utils inspect-component`](../utils/inspect-component.md).
