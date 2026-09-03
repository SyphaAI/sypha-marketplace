# skills search

Search for connector and static skill docs by task, connector, or keyword.

## Usage

```bash
airbyte-agent skills search --json '{"workspace": "default", "query": "post a slack message", "limit": 20}'
airbyte-agent skills search --json '{"workspace": "default", "query": "hubspot contacts", "cursor": "<next_cursor>"}'
```

The `query` field is required. `workspace` is optional; when absent, the configured workspace is used, then `default`.

## When to use

- Finding the right docs when you don't yet know the connector or skill ID.
- Discovering static agent docs starting from a task description.
- Narrowing a large set of installed connectors to the likely target.

## Do NOT

- Do NOT rely on search snippets by themselves. Open `skills docs` for the exact skill and section first.
- Do NOT use search in place of `connectors inspect` when you already have the connector instance.
