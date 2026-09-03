# workspaces use

Persist a default workspace name to `~/.airbyte-agent/settings.json`. After it is set, any command that takes a `workspace` parameter but is called without one falls back to this value (in place of the literal `"default"`).

> [!NOTE]
> The command verifies with the API that the workspace exists before saving. The value written is the API's canonical-cased name (typing `production` therefore stores `Production` if that is how it is recorded).

## Usage

```bash
airbyte-agent workspaces use --json '{"name": "Production"}'
```

The `name` field is required. It is matched case-insensitively against the workspace's actual `name` field.

## When to use

- **Immediately after `airbyte-agent login`** — typically the second step of onboarding once you know the target workspace.
- **When moving between projects** — configure it once instead of adding `--json '{"workspace": "..."}'` to every command.
- **After a new workspace is created** and should become the default going forward.

## Output

```jsonc
{
  "status": "saved",
  "workspace": "Production",
  "message": "default workspace set to \"Production\" in ~/.airbyte-agent/settings.json"
}
```

## Errors

| Error | Cause | Fix |
|---|---|---|
| `validation_error` (exit 4) | Missing `name` parameter | Provide `--json '{"name": "<workspace>"}'` |
| `not_found` (exit 3) on workspace | The account has no workspace by that name | Run `airbyte-agent workspaces list --json '{}'` to view actual names |
| `not_found` (exit 3) on settings file | `~/.airbyte-agent/settings.json` does not exist | Run `airbyte-agent login` first |
| `auth_error` (exit 2) | Invalid credentials | Run `airbyte-agent login` to obtain fresh credentials |

## Hints

- This command writes to disk. When configuration is supplied through `AIRBYTE_*` env vars instead of `settings.json`, the env vars still win at runtime — the persisted value takes effect only after the env override is removed.
- To clear the default and go back to the literal `"default"` fallback, delete the `workspace` field from the file or assign it the value `"default"`.
