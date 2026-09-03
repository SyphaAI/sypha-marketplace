---
title: dg plus integrations dbt
triggers:
  - "managing dbt manifests with Dagster Plus"
  - "downloading dbt manifest for dbt --defer or slim CI"
---

Commands for handling dbt integrations with Dagster Plus.

## `dg plus integrations dbt manage-manifest`

Handles dbt manifest uploads and downloads automatically based on the deployment context. This enables dbt's `--defer` flag (slim CI) by supplying a production state manifest. In branch deployments, the prod manifest is downloaded; in the source deployment (default: "prod"), the manifest is uploaded. A `dg plus deploy` session (`DAGSTER_BUILD_STATEDIR`) is required.

## `dg plus integrations dbt download-manifest`

Retrieves a dbt manifest from Dagster Plus for use during local development. No deploy session is needed. Use `--components` to locate DbtProject instances within a dg project, or `--file` to specify a Python file that contains DbtProject definitions. Use `--output` to change the download destination (not compatible with multiple projects).
