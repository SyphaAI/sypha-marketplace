# connectors inspect

Examine a connector's metadata and readiness, and obtain the `docs_skill_id` consumed by `skills docs`.

## Usage

```bash
airbyte-agent connectors inspect --json '{"workspace": "my-workspace", "name": "my-source"}'

# workspace defaults to "default" when omitted
airbyte-agent connectors inspect --json '{"name": "my-source"}'

# By connector ID instead of name
airbyte-agent connectors inspect --json '{"id": "<connector-id>"}'
```

## When to use

- Ahead of the first `connectors execute` on an unfamiliar connector.
- Whenever you need the authoritative `docs_skill_id` for the connector's usage docs.
- When verifying context-store readiness and warnings before deciding between `context_store_search` and `list`.

## Workflow

```bash
airbyte-agent connectors inspect --json '{"workspace": "default", "name": "hubspot"}'
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>"}' --fields data.markdown
airbyte-agent skills docs --json '{"id": "<docs_skill_id from inspect>", "section": "<exact-section-id>"}' --fields data.markdown
```

Pass the `docs_skill_id` precisely as it was returned. Never assemble `connector-source:<id>` yourself unless you are debugging the current backend convention.

## Do NOT

- Do NOT run `execute` on an unfamiliar connector without first reading the relevant docs section.
- Do NOT rely on `inspect` alone as usage documentation — it directs you to the docs through `docs_skill_id`.
