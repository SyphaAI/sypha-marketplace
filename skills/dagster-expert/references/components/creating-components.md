---
title: Creating Components
triggers:
  - "building a new custom component from scratch"
---

# Creating Custom Components

Components serve as the fundamental unit of reuse in Dagster projects. A component is a Python class that translates YAML configuration into Dagster definitions through the [Resolved framework](./resolved-framework.md). The central method is `build_defs()`, which produces a `dg.Definitions` object.

## Scaffolding

Use the CLI to generate boilerplate for a new component:

```bash
dg scaffold component MyComponent
```

This generates the class file and registers it. Confirm it appears in the component list, and record its full path (e.g. `my_project.components.my_component.MyComponent`) for future scaffolding:

```bash
dg list components
```

## Component Structure

A component inherits from `dg.Component` and `dg.Resolvable`, along with a base class for field definitions.

Refer to the [Resolved Framework](./resolved-framework.md#nested-resolution) for guidance on structuring your component fields.

ALWAYS use the built-in resolved types for asset-related fields rather than raw strings or dicts:

- **`dg.ResolvedAssetKey`** — for a single asset key (accepts `"a/b/c"` string in YAML)
- **`dg.ResolvedAssetSpec`** — for a full asset spec (accepts structured mapping in YAML)
- **`dg.ResolvedAssetCheckSpec`** — for asset check specs

These types handle YAML-to-Python resolution automatically.

## Building Definitions

`build_defs()` returns `dg.Definitions` — this is the main responsibility of a component.

Prefer `@dg.multi_asset(specs=[...])` even when producing a single asset. This approach lets you supply `AssetSpec` objects directly via `specs=` rather than mapping every spec subfield to individual `@dg.asset()` kwargs:

```python
import dagster as dg


class MyComponent(dg.Component, dg.Resolvable, dg.Model):
    spec: dg.ResolvedAssetSpec
    query: str

    def build_defs(self, context: dg.ComponentLoadContext) -> dg.Definitions:
        spec = self.spec

        @dg.multi_asset(specs=[spec])
        def my_asset(context: dg.AssetExecutionContext):
            context.log.info(f"Running query: {self.query}")
            # ... materialize the asset ...

        return dg.Definitions(assets=[my_asset])
```

Corresponding YAML:

```yaml
type: my_project.components.MyComponent

attributes:
  spec:
    key: my_database/my_schema/orders
    group_name: ingestion
    kinds:
      - sql
  query: "SELECT * FROM orders"
```

## Subsettable Multi-Assets

When a component emits multiple assets and the underlying tool can execute an arbitrary subset independently, add `can_subset=True` to `@dg.multi_asset()` and mark each `AssetSpec` with `skippable=True`. Use `context.selected_asset_keys` to decide which assets to run.

See [Designing Component Integrations](./designing-component-integrations.md#pattern-subsettable-multi-assets) for the complete pattern, including guidance on when to use subsetting versus atomic execution.

## Expensive Operations

If constructing definitions involves costly work — querying a database, calling an API, cloning a repo, compiling artifacts — ALWAYS use [StateBackedComponent](./state-backed/creating.md). It decouples state-fetching from definition-building, keeping code server loads fast.

If the external system is already covered by a [Dagster integration](../integrations/INDEX.md), prefer [subclassing](./subclassing-components.md) the existing component rather than building one from scratch.

```python
# Use StateBackedComponent instead of Component when external state is involved
class MyApiComponent(dg.StateBackedComponent, dg.Model, dg.Resolvable):
    ...
```

See [State-Backed Components](./state-backed/creating.md) for full implementation details.

## References

- [Resolved Framework](./resolved-framework.md)
- [Template Variables](./template-variables.md)
- [State-Backed Components](./state-backed/creating.md)
- [`dg scaffold component`](../cli/scaffold/component.md)
- [`dg list components`](../cli/list-components.md)
