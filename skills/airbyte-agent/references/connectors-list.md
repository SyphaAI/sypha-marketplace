# connectors list

Show the connectors that already exist in a given workspace.

## Usage

```bash
airbyte-agent connectors list --json '{"workspace": "my-workspace"}'

# workspace defaults to "default" when omitted
airbyte-agent connectors list --json '{}'
```

`workspace` is optional. When left out, the command falls back to the workspace called `default` and emits a JSON notice on stderr — the API call still goes ahead. To point at another workspace, include `"workspace": "<name>"` in the JSON payload.

## When to use

- Verifying a connector exists before invoking `inspect`, `skills docs`, or `execute`.
- Finding the exact connector names to hand to other commands.
- Reviewing the status of existing connectors.
- Inspecting a connector's context-store status (e.g. `loading`, `building`, `preview`, `ready`).

## Response fields

Every item under `data[]` includes the standard connector fields (`id`, `name`, `summarized_source_template`, `created_at`, `updated_at`) along with two enrichment fields merged in from the org credentials endpoint:

- `context_store_status` (string|null) — the current state of the connector's context store. Typical values include `loading`, `building`, `preview`, and `ready`. The field is `null` if no matching credential exists for the connector or if the enrichment lookup failed (see the stderr notice below).
- `context_store_entity_count` (int) — the count of entities currently materialized in the context store. Falls back to `0` when no credential is found or the enrichment fails.

Should the org credentials lookup fail, the command still returns the connector list but prints a JSON notice on stderr resembling the workspace-fallback notice. Each item in that response carries `context_store_status: null` and `context_store_entity_count: 0`.

## Filtering output

```bash
airbyte-agent connectors list --fields id,name --json '{}'              # short form
airbyte-agent connectors list --fields data.id,data.name --json '{}'    # long form

# Mixed top-level and row-level paths — use the long form for the row paths
airbyte-agent connectors list --fields data.id,next --json '{}'

# Just the context-store status per connector
airbyte-agent connectors list --fields data.id,data.context_store_status --json '{}'
```

## Related commands

- `connectors list-available` — lists templates available for installation (a different command with a different purpose).
- `connectors inspect` — inspects metadata and returns the `docs_skill_id` for `skills docs`.
- `skills docs` — reads connector usage docs ahead of `execute`.
- `connectors describe` — a legacy compatibility command for older workflows.
- `connectors create` — installs a new connector from a template.

## Hints

- The names returned here match in later commands against the connector instance name, template display name, OR template slug — all case-insensitively.
- When two connectors carry the same name, `inspect`/`execute`/`describe`/`delete` return a validation error — supply `"id": "<uuid>"` in the JSON payload instead.
