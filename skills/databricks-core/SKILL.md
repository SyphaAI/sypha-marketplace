---
name: databricks-core
description: >-
  Databricks CLI operations and the primary entry-point skill for all Databricks
  work: authentication, profile selection, data exploration, bundles, and Genie
  natural-language data Q&A. Load this before any Databricks task (CLI, auth,
  profiles, catalog/table exploration), then load the relevant product skill.
  Provides current guidelines for Databricks-related CLI tasks.
metadata:
  category: data
  source:
    repository: 'https://github.com/databricks/databricks-agent-skills'
    path: skills/databricks-core
    license_path: LICENSE
    commit: 3985599b8efaf0bb155be7e60847a3975bf45331
---

# Databricks

Foundational skill covering Databricks CLI, authentication, and data exploration.

## Product Skills

For specific products, load the corresponding dedicated skill:
- **databricks-jobs** - Lakeflow Jobs development and deployment
- **databricks-pipelines** - Lakeflow Spark Declarative Pipelines (batch and streaming data pipelines)
- **databricks-apps** - Full-stack TypeScript app development and deployment
- **databricks-lakebase** - Lakebase Postgres Autoscaling project management
- **databricks-model-serving** - Model Serving endpoint management and inference

## Prerequisites

1. **CLI installed**: Verify by running `databricks --version`.
   - **If the CLI is absent or outdated (< v0.292.0): STOP. Do not continue or attempt workarounds for a missing CLI.**
   - **Read the [CLI Installation](databricks-cli-install.md) reference file and follow the steps to guide the user through installation.**
   - Note: In sandboxed or containerized environments, install commands write outside the workspace and may be restricted. Provide the install command to the user and ask them to execute it in their own terminal.
   - **Exception:** If CLI installation is blocked (sandboxed containers, restricted environments), ask the user whether to fall back to direct REST API calls using `DATABRICKS_HOST` and `DATABRICKS_TOKEN` environment variables when present in the shell. See the [Databricks REST API docs](https://docs.databricks.com/api/workspace/introduction).

2. **Authenticated**: `databricks auth profiles`
   - If not authenticated: see [CLI Authentication](databricks-cli-auth.md)

## Profile Selection - CRITICAL

**NEVER auto-select a profile.**

1. List profiles: `databricks auth profiles`
2. Show ALL profiles to the user with their workspace URLs
3. Let the user choose (even when only one profile exists)
4. Offer to create a new profile if required

## Agent Shell Behavior

Every Bash command runs in a **separate shell session**.

```bash
# WORKS: --profile flag
databricks apps list --profile my-workspace

# WORKS: chained with &&
export DATABRICKS_CONFIG_PROFILE=my-workspace && databricks apps list

# DOES NOT WORK: separate commands
export DATABRICKS_CONFIG_PROFILE=my-workspace
databricks apps list  # profile not set!
```

## Data Exploration — Use AI Tools

**Use these commands instead of manually traversing catalogs/schemas/tables:**

```bash
# discover table structure (columns, types, sample data, stats)
databricks experimental aitools tools discover-schema catalog.schema.table --profile <PROFILE>

# run ad-hoc SQL queries
databricks experimental aitools tools query "SELECT * FROM table LIMIT 10" --profile <PROFILE>

# find the default warehouse
databricks experimental aitools tools get-default-warehouse --profile <PROFILE>
```

**Names are literal.** Use catalog/schema/table names precisely as provided — never convert a
hyphen to an underscore or alter them in any way. In SQL, backtick-quote any name segment
containing special characters (e.g. `` `my-catalog`.schema.table ``); unquoted hyphens cause a
parse error.

See [Data Exploration](data-exploration.md) for details.

## Quick Reference

**⚠️ CRITICAL: Some commands use positional arguments, not flags**

```bash
# current user
databricks current-user me --profile <PROFILE>

# list resources
databricks apps list --profile <PROFILE>
databricks jobs list --profile <PROFILE>
databricks clusters list --profile <PROFILE>
databricks warehouses list --profile <PROFILE>
databricks pipelines list --profile <PROFILE>
databricks serving-endpoints list --profile <PROFILE>

# ⚠️ Unity Catalog — POSITIONAL arguments (NOT flags!)
databricks catalogs list --profile <PROFILE>

# ✅ CORRECT: positional args
databricks schemas list <CATALOG> --profile <PROFILE>
databricks tables list <CATALOG> <SCHEMA> --profile <PROFILE>
databricks tables get <CATALOG>.<SCHEMA>.<TABLE> --profile <PROFILE>

# ❌ WRONG: these flags/commands DON'T EXIST
# databricks schemas list --catalog-name <CATALOG>    ← WILL FAIL
# databricks tables list --catalog <CATALOG>           ← WILL FAIL
# databricks sql-warehouses list                       ← doesn't exist, use `warehouses list`
# databricks execute-statement                         ← doesn't exist, use `experimental aitools tools query`
# databricks sql execute                               ← doesn't exist, use `experimental aitools tools query`

# When in doubt, check help:
# databricks schemas list --help

# get details
databricks apps get <NAME> --profile <PROFILE>
databricks jobs get --job-id <ID> --profile <PROFILE>
databricks clusters get --cluster-id <ID> --profile <PROFILE>

# bundles
databricks bundle init --profile <PROFILE>
databricks bundle validate --profile <PROFILE>
databricks bundle deploy -t <TARGET> --profile <PROFILE>
databricks bundle run <RESOURCE> -t <TARGET> --profile <PROFILE>
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| `cannot configure default credentials` | Supply the `--profile` flag or authenticate first |
| `configuration does not support OAuth tokens` | The command requires OAuth (e.g., `databricks apps logs`). Re-authenticate with `databricks auth login --host <URL> --profile <PROFILE>`. See [CLI Authentication](databricks-cli-auth.md). |
| `PERMISSION_DENIED` | Verify workspace/UC permissions |
| `RESOURCE_DOES_NOT_EXIST` | Confirm the resource name/id and the active profile |

## Required Reading by Task

| Task | READ BEFORE proceeding |
|------|------------------------|
| Initial setup | [CLI Installation](databricks-cli-install.md) |
| Auth issues / new workspace | [CLI Authentication](databricks-cli-auth.md) |
| Browsing tables/schemas | [Data Exploration](data-exploration.md) |
| Deploying jobs/pipelines | Use `/databricks-dabs` |

## Reference Guides

- [CLI Installation](databricks-cli-install.md)
- [CLI Authentication](databricks-cli-auth.md)
- [Data Exploration](data-exploration.md)
