---
title: "dbt: Scaffolding"
triggers:
  - "scaffolding a new dbt component in a Dagster project"
---

# Scaffolding a dbt Component

This guide walks through the complete process of setting up a new `DbtProjectComponent` in a Dagster project.
To configure or customize an existing component, see
[Component-Based Integration](component-based-integration.md).

## Prerequisites

Confirm that `dagster-dbt` is installed in the project:

```bash
uv add dagster-dbt
```

## Scaffold the Component

### Colocated dbt Project

If the dbt project resides inside the Dagster repository:

```bash
dg scaffold defs dagster_dbt.DbtProjectComponent <component name> --project-path <path to dbt project>
```

### Remote Git Repository

If the dbt project resides in a separate git repository:

```bash
dg scaffold defs dagster_dbt.DbtProjectComponent <component name> --git-url <git url> --project-path <repo-relative path to dbt project, default '.'>
```

## Install the Adapter Library (Required)

dbt requires a database-specific adapter library to compile the project manifest. **Without it,
`dbt parse` will fail and no assets will be loaded.**

1. Inspect the `profiles.yml` file in the dbt project for the adapter type (look for the `type:` field
   under the target configuration).
2. If the adapter type cannot be determined from `profiles.yml`, ask the user which database they are
   targeting.
3. Install the adapter:

```bash
uv add dbt-<adapter>
```

Common adapters:

| Adapter    | Package         |
| ---------- | --------------- |
| DuckDB     | `dbt-duckdb`    |
| Snowflake  | `dbt-snowflake` |
| BigQuery   | `dbt-bigquery`  |
| PostgreSQL | `dbt-postgres`  |
| Redshift   | `dbt-redshift`  |

## Verify

Always run `dg list defs` to confirm the manifest compiled successfully and assets are visible:

```bash
dg list defs
```

If this returns no definitions, verify that:

- The adapter library is installed
- The dbt project path is correct
- `profiles.yml` is properly configured
