# connectors list-available

Show the connector templates this account can install. Every template carries a `name` (e.g. `salesforce`, `hubspot`) which you supply to `connectors create --json '{"name": "<name>"}'`.

## Usage

```bash
airbyte-agent connectors list-available --json '{}'
```

## When to use

Run this **before** every `connectors create` to learn the exact template `name` required. Template names are stable identifiers — never guess them.

## Workflow

```bash
airbyte-agent connectors list-available --json '{}'
airbyte-agent connectors create --json '{"workspace": "my-workspace", "name": "salesforce"}'
```

## Filtering output

```bash
airbyte-agent connectors list-available --fields id,name --json '{}'              # short form
airbyte-agent connectors list-available --fields data.id,data.name --json '{}'    # long form
```

## Hints

- The list only covers what your account has access to — it does not show every connector that exists in Airbyte's catalog.
