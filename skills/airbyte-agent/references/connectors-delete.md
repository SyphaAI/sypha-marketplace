# connectors delete

Remove a connector from a workspace permanently.

> [!IMPORTANT]
> Deletion cannot be undone. Unless the user has explicitly authorized it, confirm with them before running this command.

## Usage

```bash
airbyte-agent connectors delete --json '{"workspace": "my-workspace", "name": "my-source"}'

# By connector ID instead of name
airbyte-agent connectors delete --json '{"id": "<connector-id>"}'
```

`workspace` is optional. When it is omitted alongside `name`, the command falls back to the workspace called `default` and emits a JSON notice on stderr. **Before depending on that fallback for a delete, check with the user** — deleting the wrong workspace's connector is hard to recover from.

## Confirmation prompt

Delete prompts `Type 'yes' to confirm:` on stderr by default and reads the answer from stdin. Any input other than an exact `yes` aborts the operation.

Agents driving the CLI usually cannot respond to the prompt. Non-interactive deletes can be enabled in two ways:

1. **Per-machine permission (recommended)**: add `"allow_destructive": true` to `~/.airbyte-agent/settings.json`. This must be granted explicitly by the user — never enable it silently.
2. **Per-invocation env var**: `AIRBYTE_ALLOW_DESTRUCTIVE=true airbyte-agent connectors delete ...`.

When neither is configured and stdin is not a TTY, the command refuses to run, returning a `validation_error` plus a hint about the setting (exit 4).

## Error recovery

- **Not found** (exit 3): use `connectors list` to verify the name actually exists in the workspace.
- **Ambiguous name** (exit 4): two connectors have the same name — supply `"id": "<uuid>"` in the JSON payload instead.
- **`destructive action requires confirmation but no TTY is available`** (exit 4): stdin is not a terminal and `allow_destructive` is not enabled. Have the user grant the permission in settings.json (or run it again interactively).
- **`destructive action cancelled by user`** (exit 4): the user entered something other than `yes`. Do not retry before checking with them.

## Do NOT

- Do NOT remove a connector without the user's explicit confirmation.
- Do NOT treat this command as a way to "reset" a connector's credentials — delete and recreate instead, or update the credentials directly through the connector configuration flow.
