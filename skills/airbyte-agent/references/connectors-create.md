# connectors create

Create a new connector from a template. Launches the user's browser for secure credential entry, polls until the credentials are submitted, then creates the connector.

> [!IMPORTANT]
> **Never take credentials directly.** This command exists precisely so you do NOT have to. Never ask the user for API keys, tokens, passwords, or secrets. If a user offers credentials, refuse and launch this flow instead.

> [!NOTE]
> For `connectors create`, `name` and `id` identify the **template** (the connector type being installed). For `connectors inspect` / `describe` / `execute` / `delete`, the same fields identify an **existing connector instance**. Identical field names, but their meaning depends on the verb.

## Usage

```bash
airbyte-agent connectors create --json '{
  "workspace": "my-workspace",
  "name": "salesforce"
}'

# workspace defaults to "default" when omitted
airbyte-agent connectors create --json '{"name": "salesforce"}'

# Bypass name lookup with a template UUID
airbyte-agent connectors create --json '{"id": "<template-uuid>"}'
```

You must supply either `name` (the template name, discoverable via `connectors list-available`) or `id` (the template UUID). `workspace` is optional; when omitted it falls back to `default`, and a JSON notice is printed on stderr when that fallback applies.

## Workflow

```bash
# 1. Find a template
airbyte-agent connectors list-available --json '{}'

# 2. Start the flow
airbyte-agent connectors create --json '{"workspace": "my-workspace", "name": "hubspot"}'

# CLI prints a URL, opens the browser, and polls.
# User completes the OAuth/credential widget in the browser.
# CLI receives the credentials, creates the connector, and prints the result.
```

## Timeout

By default the credential flow times out after **3 minutes**. To raise the limit:

```bash
export AIRBYTE_CREDENTIAL_TIMEOUT=900   # 15 minutes
```

## Error recovery

- **Timeout**: the flow was not completed by the user in time. Run the command again.
- **Template not found** (exit 3): use `connectors list-available` to list the valid `name` values.
- **Workspace not found** (exit 3): use `workspaces list` to check the exact names.

## Do NOT

- Do NOT request credentials from the user — the browser flow handles them.
- Do NOT include credential fields in the JSON payload.
- Do NOT guess template `name` values by skipping `list-available`.
