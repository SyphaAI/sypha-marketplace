# organizations use

Save a default organization ID into `~/.airbyte-agent/settings.json`. Once run, every API call issued by the CLI is scoped to that organization (through the `X-Organization-Id` header).

> [!NOTE]
> Before writing, the command checks that the UUID belongs to the authenticated account. Matching is case-insensitive, but the ID is stored exactly as it appears in the API response (typically lowercase).

## Usage

```bash
airbyte-agent organizations use --json '{"id": "11111111-1111-1111-1111-111111111111"}'
```

`id` is required and must be a UUID present in `airbyte-agent organizations list`.

## When to use

- **When you are a member of multiple organizations** and need to change the CLI's default without re-running `airbyte-agent login --org-id <uuid>`.
- **After `airbyte-agent login`** when the login flow auto-selected the wrong org (e.g. a previously single-org account just gained a second org).
- **In CI / agent harnesses** where the settings file was seeded in advance but the org must change between runs.

## Output

```jsonc
{
  "status": "saved",
  "organization_id": "11111111-1111-1111-1111-111111111111",
  "message": "default organization set to \"11111111-1111-1111-1111-111111111111\" in ~/.airbyte-agent/settings.json"
}
```

## Errors

| Error | Cause | Fix |
|---|---|---|
| `validation_error` (exit 4) | The `id` parameter was omitted | Supply `--json '{"id": "<uuid>"}'` |
| `not_found` (exit 3) on organization | The UUID is not owned by the authenticated account | Run `airbyte-agent organizations list --json '{}'` to view the actual UUIDs |
| `not_found` (exit 3) on settings file | `~/.airbyte-agent/settings.json` does not exist | Run `airbyte-agent login` first |
| `auth_error` (exit 2) | Invalid credentials | Refresh credentials with `airbyte-agent login` |

## Hints

- This command persists to disk. If your configuration comes from `AIRBYTE_ORGANIZATION_ID` rather than `settings.json`, the env var still takes precedence at runtime — the saved value only applies once you unset the env override.
- Run `airbyte-agent organizations list --fields id,organization_name --json '{}'` to locate the UUID you need.
