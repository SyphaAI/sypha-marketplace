# connectors update

Send the user's browser to the credentials page so they can edit an existing connector's configuration. Credentials are never taken by the CLI directly — entry occurs in the browser-based widget.

## When to use

- A connector's OAuth token has expired and `connectors execute` has begun returning `auth_error`.
- The user has rotated the API key for a SaaS source.
- The user explicitly asks to change a connector's configuration (auth, entity selection, etc.).

Do NOT reach for this command to rename a connector or make other metadata-only edits — those require a real PUT call, which this command never issues.

## Usage

```bash
airbyte-agent connectors update --json '{"workspace": "my-workspace", "name": "my-source"}'

# By connector ID instead of name
airbyte-agent connectors update --json '{"id": "<connector-id>"}'
```

`workspace` is optional when used alongside `name` — the command falls back to the configured default workspace (then to `default`), printing a JSON notice to stderr.

## What happens

1. The CLI resolves the connector by name within the workspace (or takes the `id` directly).
2. It constructs the URL `<webapp>/organizations/<org_id>/credentials`, then writes the action message plus a confirmation prompt to stderr: `Open <URL> in your browser? Type 'yes' to confirm (skips after 10s): `.
3. **If** `yes` is typed by the user (case-insensitive, whitespace-trimmed) within 10 seconds, the CLI launches the URL in their default browser.
4. **Otherwise** (`no`, any other input, EOF, or a timeout — the usual case for MCP/CI/piped invocations with empty stdin), no browser is opened. The exit code remains 0 and the URL is still returned.
5. The CLI emits a JSON object on stdout containing `url`, `connector_id`, `browser_opened: bool`, and `message` (which starts with **"Connectors cannot be edited through the CLI. Visit the link below to update the connector config"** followed by the pencil-icon hint).
6. The user opens the link, locates the named connector in the credentials list, and clicks the pencil icon — this opens the embedded edit dialog where the credentials get re-entered.

**Agent guidance**: when running the CLI from an MCP/automation context, expect `browser_opened: false` (stdin is closed → immediate EOF → nothing opens). Pass the `url` along to the human so they can open it themselves.

For staging/preview environments, `AIRBYTE_WEBAPP_URL` overrides the base URL.

## Workflows

**Credential rotation after `auth_error`**

```bash
# 1. Identify the failing connector
airbyte-agent connectors list --json '{"workspace": "my-workspace"}'

# 2. Launch the edit flow
airbyte-agent connectors update --json '{"workspace": "my-workspace", "name": "my-source"}'

# 3. Wait for the user to confirm they completed the browser flow, then re-run the failing call
airbyte-agent connectors execute --json '{"workspace": "my-workspace", "name": "my-source", "entity": "...", "action": "..."}'
```

## Error recovery

- **`auth_error`** (exit 2) — the CLI session token has expired. Run `airbyte-agent login`, then retry.
- **`not_found`** (exit 3) — no such name exists in that workspace. Run `connectors list --json '{"workspace": "..."}'` to view what is actually present.
- **`validation_error: provide either 'id' or 'name', not both`** (exit 4) — choose one of the two.
- **`validation_error: either 'name' + 'workspace' or 'id' is required`** (exit 4) — supply at least one form of identification.
- **`validation_error: ambiguous: N connectors named "X" in workspace "Y"`** (exit 4) — switch to `"id": "<uuid>"`.
- **`validation_error: no organization_id configured`** (exit 4) — run `airbyte-agent login` (the login flow stores the org id in settings.json).

## Do NOT

- Do NOT have the user paste credentials into the chat or the CLI. Credentials are not accepted as CLI parameters — entry happens exclusively in the browser-based widget.
- Do NOT hand-build a PUT request to `/api/v1/integrations/connectors/{id}` as a "shortcut". Secret handling belongs to the widget, and a direct PUT bypasses it.
- Do NOT apply this command to irreversible operations such as deleting/replacing a connector — use `connectors delete` and `connectors create` for that.
