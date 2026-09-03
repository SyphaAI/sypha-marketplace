---
title: dg scaffold component
triggers:
  - "creating a custom reusable component type"
---

Generate a new custom Dagster component type class. This command must be run from within a Dagster project directory. The generated scaffold is placed at `<project_name>.components.<name>`.

Choose `dg scaffold component` when the component is intended for reuse across multiple locations. For components that are only needed once, use `dg scaffold defs inline-component` instead — this places the component class definition directly under `defs/` next to its `defs.yaml`:

```bash
dg scaffold defs inline-component
```

```bash
dg scaffold component <class-name>
```

`--model / --no-model` — controls whether the generated class inherits from `dagster.components.Model` (default: `--model`).

## Inspecting Components

To review an existing component type's description, scaffold parameters, or `defs.yaml` schema, use [`dg utils inspect-component`](../utils/inspect-component.md).
