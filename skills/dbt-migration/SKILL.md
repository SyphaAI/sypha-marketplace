---
name: dbt-migration
description: >-
  Skills for migrating dbt projects — transitioning from dbt Core to the Fusion
  engine or across data platforms. Use when moving dbt projects between platforms
  or to dbt Fusion.
license: Apache-2.0
metadata:
  category: development
  author: dbt-labs
  source:
    repository: 'https://github.com/dbt-labs/dbt-agent-skills'
    path: skills/dbt-migration
    commit: f30da77590f0ec1a4c78ff03599c3c715077f1c1
---

# dbt Migration Skills

A set of skills for migrating dbt projects — whether from dbt Core to the Fusion engine or across data platforms.

## Included Skills

### migrating-dbt-core-to-fusion
Sorts dbt-core to Fusion migration errors into actionable categories (auto-fixable, guided fixes, needs input, blocked). Use when a user needs assistance triaging migration errors to determine what can be fixed in their project versus what requires Fusion engine updates.

### migrating-dbt-project-across-platforms
Use when moving a dbt project from one data platform or warehouse to another (e.g., Snowflake to Databricks, Databricks to Snowflake) by leveraging dbt Fusion's real-time compilation to surface and resolve SQL dialect differences.

## Source

- **Repository**: https://github.com/dbt-labs/dbt-agent-skills
- **License**: Apache-2.0
- **Author**: dbt Labs
