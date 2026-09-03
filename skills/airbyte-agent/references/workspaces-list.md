# workspaces list

List the organization's workspaces. Since a workspace name serves as the identifier for almost all connector commands, this tends to be the first command executed in a session.

> [!IMPORTANT]
> If only one workspace exists, use it directly rather than prompting the user. Most accounts have exactly one workspace.

> [!NOTE]
> Pagination is handled automatically — all workspaces are returned in a single response regardless of the server-side page size.

## Usage

```bash
airbyte-agent workspaces list --json '{}'
airbyte-agent workspaces list --json '{"name_contains": "production"}'
airbyte-agent workspaces list --json '{"status": "active"}'
```

Run `airbyte-agent schema workspaces list` to see the full parameter schema.

## Filtering output

```bash
airbyte-agent workspaces list --fields name,status --json '{}'              # short form
airbyte-agent workspaces list --fields data.name,data.status --json '{}'    # long form

# Mixed top-level and row-level paths — use the long form for the row paths
airbyte-agent workspaces list --fields data.name,next --json '{}'
```

## Discovery flow

1. `airbyte-agent workspaces list --json '{}'` — see all workspaces.
2. Note the exact `name` value.
3. From there, either:
   - Pass that name into every command: `--json '{"workspace": "<name>"}'`, or
   - Persist it once as the default: `airbyte-agent workspaces use --json '{"name": "<name>"}'`. Any later command that omits `workspace` will use this value.

## Do NOT

- Do NOT prompt the user to pick a workspace when there is only one.
- Do NOT guess at workspace names — always discover them beforehand.
- Do NOT pass workspace UUIDs into commands that accept `workspace` — the CLI expects the human-readable name.

## Hints

- Use `name_contains` for partial matching when you don't know the exact name.
- `limit` controls the server-side page size, but you still get the complete result set.
