---
title: Environment Variables
triggers:
  - "configuring environment variables across different environments"
---

# Environment Variables Reference

## Overview

Environment variables provide a clear separation between configuration and code, enabling the same Dagster project to function across different environments (development, staging, production) without any code changes.

## How `dg` Commands Handle Environment Variables

The `dg` CLI automatically reads environment variables from `.env` files in your project root before running commands. This means:

- No manual `export` or `source` commands are needed
- Commands like `dg launch`, `dg dev`, `dg check defs` automatically pick up `.env` values
- Behavior is consistent across local development and CI/CD environments

## Listing Available Environment Variables

Use the `dg list envs` command to inspect which environment variables your Dagster definitions reference:

```bash
dg list envs
```

This displays all `EnvVar` references in your code, helping you identify what needs to be configured.

## Basic .env File Pattern

```bash
# .env (at project root, never commit to git)
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=secret_key_here
SNOWFLAKE_ACCOUNT=myaccount
SNOWFLAKE_USER=myuser
SNOWFLAKE_PASSWORD=secret
```

**Important:** Add `.env` to your `.gitignore` to avoid committing secrets.

## Using Environment Variables in Dagster

### In Resources

```python
import dagster as dg

class DatabaseResource(dg.ConfigurableResource):
    connection_string: str = dg.EnvVar("DATABASE_URL")
    timeout: int = dg.EnvVar.int("DB_TIMEOUT")

# Dagster automatically loads DATABASE_URL and DB_TIMEOUT from .env
```

### In Component YAML Files

```yaml
# defs/my_component/defs.yaml
component: dagster_sling.SlingReplicationComponent

params:
  sling:
    connections:
      - name: MY_POSTGRES
        type: postgres
        host: "{{ env.DB_HOST }}"
        port: "{{ env.DB_PORT }}"
        database: "{{ env.DB_NAME }}"
```

## Environment-Specific Configuration

For multiple environments, maintain separate `.env` files:

```
my_project/
├── .env              # Local development (gitignored)
├── .env.example      # Template (committed to git)
├── .env.staging      # Staging config (gitignored)
└── .env.prod         # Production config (gitignored)
```

### .env.example Template

```bash
# .env.example (committed to git)
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=your_api_key_here
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
```

Developers copy `.env.example` to `.env` and substitute real values.

### Loading Environment-Specific Files

```bash
# Development (uses .env by default)
dg dev

# Staging
dg launch --env-file .env.staging --assets my_asset

# Production
dg launch --env-file .env.prod --assets my_asset
```

## Best Practices

1. **Never commit `.env` files** - Always add them to `.gitignore`
2. **Provide `.env.example`** - Serves as a template for required variables
3. **Use descriptive names** - `SNOWFLAKE_ACCOUNT` not `ACCT`
4. **Group related vars** - Prefix related variables (e.g., `SNOWFLAKE_*`, `S3_*`)
5. **Document required vars** - List required environment variables in README
6. **Use `dg list envs`** - Confirm all environment variables are configured

## References

- [CLI list envs reference](./cli/list/envs.md) - `dg list envs` command
- [Dagster EnvVar API](https://docs.dagster.io/api/dagster/dagster.EnvVar)
