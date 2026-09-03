---
title: dg utils inspect-component
triggers:
  - "inspecting a component type's description, schema, or examples"
---

# dg utils inspect-component

Retrieve detailed information about a registered component type, including its description, scaffold parameters, and configuration schema.

## Usage

```bash
dg utils inspect-component <COMPONENT_TYPE>
```

## Flags

All flags are mutually exclusive — only one may be specified at a time.

- **`--description`** — Output the component's description text only.
- **`--scaffold-params-schema`** — Output the JSON schema for scaffold parameters (i.e. the flags/params that `dg scaffold defs` accepts for this component type).
- **`--defs-yaml-json-schema`** — Output the full JSON schema for the component's `defs.yaml` file. This encompasses `type`, `attributes`, `template_vars_module`, `requirements`, and `post_processing`.
- **`--defs-yaml-schema`** — Output an LLM-optimized YAML template with inline documentation and type hints. Helpful for understanding the overall structure at a glance.
- **`--defs-yaml-example-values`** — Output a YAML template filled with example values, which is useful for code generation.

When no flags are provided, all available metadata is printed (description + scaffold params schema + component schema).
