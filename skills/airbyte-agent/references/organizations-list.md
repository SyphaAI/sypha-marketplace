# organizations list

Show the organizations accessible to the authenticated principal.

## Usage

```bash
airbyte-agent organizations list --json '{}'
```

## Filtering output

```bash
airbyte-agent organizations list --fields id,organization_name --json '{}'              # short form
airbyte-agent organizations list --fields data.id,data.organization_name --json '{}'    # long form

# Mixed top-level and row-level paths — use the long form for the row paths
airbyte-agent organizations list --fields data.id,next --json '{}'
```

## When to use

The organization ID is rarely needed directly by most workflows — `workspace` is the primary identifier handed to other commands. Reach for this command when:

- You want to verify which organization the credentials belong to.
- You are configuring `AIRBYTE_ORGANIZATION_ID` and need to check the value.
- You are troubleshooting multi-org credential setups.

## Hints

- The CLI paginates the output automatically; handling cursors yourself is unnecessary.
- The organization ID is a UUID and is seldom required at the command line.
