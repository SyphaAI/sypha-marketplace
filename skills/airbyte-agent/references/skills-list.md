# skills list

List the connector and static skill docs available in a workspace.

## Usage

```bash
airbyte-agent skills list --json '{"workspace": "default", "limit": 20}'
airbyte-agent skills list --json '{"workspace": "default", "limit": 20, "cursor": "<next_cursor>"}'
```

The `workspace` field is optional; when omitted it defaults to the configured workspace, falling back to `default` after that.

## When to use

- Discovering which connector and agent skill docs are available.
- Confirming that a static skill such as `agent:mcp` exists.
- Walking through pages of docs metadata via `next_cursor`.

## Do NOT

- Do NOT use the list output as execution guidance. Retrieve the exact docs with `skills docs`.
- Do NOT invent connector skill IDs. Rely on the `docs_skill_id` that `connectors inspect` returns.
