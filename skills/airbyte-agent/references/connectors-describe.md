# connectors describe

A legacy compatibility command that reports a connector's available entities and actions via the older rich describe flow.

> [!IMPORTANT]
> For new workflows, prefer `connectors inspect` plus `skills docs`. Reach for `connectors describe` only if the new inspect/docs endpoints are unavailable or an existing legacy script relies on the old merged schema shape.

## Usage

```bash
airbyte-agent connectors describe --json '{"workspace": "my-workspace", "name": "my-source"}'

# workspace defaults to "default" when omitted
airbyte-agent connectors describe --json '{"name": "my-source"}'

# By connector ID instead of name
airbyte-agent connectors describe --json '{"id": "<connector-id>"}'
```

`workspace` is optional; when omitted together with `name`, the command falls back to the workspace called `default` and emits a JSON notice on stderr.

## When to use

- You maintain an existing script that consumes the old `schema` field.
- You are working in an environment where `connectors inspect` or `skills docs` is unavailable.
- You are comparing legacy schema output while migrating.

## Workflow

```bash
# 1. Find the connector
airbyte-agent connectors list --json '{"workspace": "my-workspace"}'

# 2. Preferred: inspect and read docs
airbyte-agent connectors inspect --json '{"workspace": "my-workspace", "name": "my-source"}'
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>"}' --fields data.markdown

# Legacy fallback: describe it
airbyte-agent connectors describe --json '{"workspace": "my-workspace", "name": "my-source"}'

# 3. Execute the discovered entity + action
airbyte-agent connectors execute --json '{
  "workspace": "my-workspace",
  "name": "my-source",
  "entity": "users",
  "action": "context_store_search",
  "select_fields": ["id", "email"]
}'
```

Before composing an `execute` call for new executions, open [`connectors-inspect.md`](connectors-inspect.md), [`skills-docs.md`](skills-docs.md), and [`connectors-execute.md`](connectors-execute.md).

## Do NOT

- Do NOT make this the default discovery path for new workflows — rely on `connectors inspect` plus `skills docs`.
- Do NOT keep describe output cached across CLI versions — connector updates can change the schema.
