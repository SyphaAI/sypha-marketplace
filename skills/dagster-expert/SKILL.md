---
name: dagster-expert
description: >-
  Apply this skill to Dagster project work covering assets,
  components, integrations, or the dg CLI; consult the bundled
  command and API references before proposing implementation details.
metadata:
  category: data
  source:
    repository: 'https://github.com/dagster-io/skills'
    path: skills/dagster-expert/skills/dagster-expert
    license_path: LICENSE
    commit: fa3d023d6700767d3950f94ebe8ea73b5abbd015
---

## Core Dagster Concepts

Short definitions only (see reference files for detailed examples):

- **Asset**: Persistent object (table, file, model) produced by your pipeline
- **Component**: Reusable building block that generates definitions (assets, schedules, sensors, jobs, etc.) relevant to a particular domain.

## Integration Workflow

When integrating with ANY external tool or service, read the [Integration libraries index](./references/integrations/INDEX.md). This file describes which integration libraries are available, and includes guidance on creating new custom integrations for tools that lack a published library.

## dg CLI

The `dg` CLI is the preferred way to interact with Dagster programmatically (adding definitions, launching runs, exploring project structure, etc.). It is installed as part of the `dagster-dg-cli` package. If a relevant CLI command exists for a given task, always try to use it.

Explore the existing project structure ONLY when it is strictly required to accomplish the user's goal. In many cases, the existing CLI tools have enough awareness of the project structure, so listing and reading files is unnecessary and wasteful.

Nearly all `dg` commands that return information support a `--json` flag for machine-readable output. Prefer this over the default table format unless you are presenting the information directly to the user.

## UV Compatibility

Projects typically rely on `uv` for dependency management, and it is recommended to use it with `dg` commands when possible:

```bash
uv run dg list defs
uv run dg launch --assets my_asset
```

## CRITICAL: Always Read Reference Files Before Answering

NEVER answer from memory or guess at CLI commands, APIs, or syntax. ALWAYS read the relevant reference file(s) from the Reference Index below before responding.

For each question, determine which reference file(s) apply using the index descriptions, read those files, then base your answer on what you find.

## Reference Index

<!-- BEGIN GENERATED INDEX -->

- [Asset Selection Syntax](./references/asset-selection.md) — filtering assets by tag, group, kind, upstream, or downstream; AssetSelection in Python, UI search bar, or CLI
- [Environment Variables](./references/env-vars.md) — configuring environment variables across different environments
- [Asset Patterns](./references/assets/INDEX.md) — defining assets, dependencies, metadata, partitions, or multi-asset definitions
- [Choosing an Automation Approach](./references/automation/choosing-automation.md) — deciding between schedules, sensors, and declarative automation
- [Schedules](./references/automation/schedules.md) — time-based automation with cron expressions
- [Declarative Automation](./references/automation/declarative-automation/INDEX.md) — asset-centric condition-based automation using AutomationCondition
- [Asset Sensors](./references/automation/sensors/asset-sensors.md) — triggering on asset materialization events
- [Basic Sensors](./references/automation/sensors/basic-sensors.md) — event-driven automation with file watching or custom polling
- [Run Status Sensors](./references/automation/sensors/run-status-sensors.md) — reacting to run success, failure, or other status changes
- [dg check](./references/cli/check.md) — validating project configuration or definitions
- [create-dagster](./references/cli/create-dagster.md) — creating a new Dagster project from scratch
- [dg dev](./references/cli/dev.md) — starting a local Dagster development instance
- [dg launch](./references/cli/launch.md) — materializing assets or executing jobs locally
- [dg list components](./references/cli/list-components.md) — seeing available component types for scaffolding
- [dg list defs](./references/cli/list-defs.md) — listing or filtering registered definitions
- [Dagster Plus API](./references/cli/api/INDEX.md) — dg api, programmatically querying or managing Dagster Plus resources (assets, runs, deployments, code locations, schedules, sensors, secrets, issues, etc.)
- [dg list](./references/cli/list/INDEX.md) — exploring project structure (component tree, environment variables, workspace projects)
- [Dagster Plus CLI](./references/cli/plus/INDEX.md) — dg plus, Dagster Plus authentication, configuration, and deployment; logging in, setting config, creating API tokens, deploying code, pulling env vars, managing dbt manifests
- [dg scaffold component](./references/cli/scaffold/component.md) — creating a custom reusable component type
- [dg scaffold defs](./references/cli/scaffold/defs.md) — adding new definitions (assets, schedules, sensors, components) to a project
- [dg utilities](./references/cli/utils/INDEX.md) — dg utils, inspecting component types, viewing integrations, refreshing state-backed component cache
- [Creating Components](./references/components/creating-components.md) — building a new custom component from scratch
- [Designing Component Integrations](./references/components/designing-component-integrations.md) — designing a component that wraps an external service or tool; custom integrations
- [Resolved Framework](./references/components/resolved-framework.md) — defining custom YAML schema types using Resolver, Model, or Resolvable
- [Subclassing Components](./references/components/subclassing-components.md) — extending an existing component via subclassing; customize dagster integration component
- [Template Variables](./references/components/template-variables.md) — using Jinja2 template variables in component YAML (env, dg, context, or custom scopes)
- [Creating State-Backed Components](./references/components/state-backed/creating.md) — building a component that fetches and caches external state
- [Using State-Backed Components](./references/components/state-backed/using.md) — managing state-backed components in production, CI/CD, or refreshing state
- [Deployment Configuration Files](./references/deployment/config-files.md) — build.yaml, container_context.yaml, dagster_cloud.yaml; Dagster Plus deployment configuration; configuring Docker registry, container context, agent queue; Hybrid deployment files
- [Integration libraries index for 40+ tools and technologies (dbt, Fivetran, Snowflake, AWS, etc.).](./references/integrations/INDEX.md) — integration, external tool, dagster-\*; dbt, fivetran, airbyte, snowflake, bigquery, sling, aws, gcp
- [Migration Guides](./references/migration/INDEX.md) — sensor migration to declarative automation, sensor migration to automation condition
<!-- END GENERATED INDEX -->
