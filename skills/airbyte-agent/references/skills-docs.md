# skills docs

Retrieve a skill's usage documentation. When you need connector docs, pass the `docs_skill_id` obtained from `connectors inspect`.

## Usage

```bash
# Outline plus default guidance
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>"}' --fields data.markdown

# Exact section from the outline
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>", "section": "<exact-section-id>"}' --fields data.markdown

# Static docs are workspace-scoped by default
airbyte-agent skills docs --json '{"workspace": "default", "id": "agent:mcp"}' --fields data.markdown

# Raw backend envelope for scripts
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>", "format": "json"}'
```

The default output format is JSON, with the rendered markdown found under `data.markdown`. Passing `format: "json"` returns the backend docs envelope unchanged.

## Workspace scoping

- For `connector-source:*` IDs, omit `workspace` unless the user explicitly asks for a workspace-scoped read.
- If `workspace` is given, the CLI resolves it and passes along `workspace_id`.
- With static/non-connector skill IDs such as `agent:mcp`, the CLI resolves and sends the workspace you supplied, or otherwise the default.

## Workflow

```bash
airbyte-agent connectors inspect --json '{"workspace": "default", "name": "slack"}'
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>"}' --fields data.markdown
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>", "section": "actions.messages.create"}' --fields data.markdown
```

Only pass the exact section IDs that appear in the outline — they are stable identifiers rather than display titles.

## Do NOT

- Do NOT construct connector docs IDs manually when `docs_skill_id` is available from `connectors inspect`.
- Do NOT pass a section title in `section`; the exact section ID is required.
- Do NOT invoke `connectors execute` until you have read the section for the entity/action you plan to use.
