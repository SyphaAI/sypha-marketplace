---
title: create-dagster
triggers:
  - "creating a new Dagster project from scratch"
---

The `create-dagster` command generates a new Dagster project with the correct Python package layout and Dagster-specific configuration.

Two layout options are available:

- `project` — a single Dagster project (default unless the user requires multiple independent packages)
- `workspace` — a group of related Dagster projects with separate dependencies

**IMPORTANT** NEVER create a new Dagster project manually / without using the `create-dagster` command, as it will almost certainly be configured or structured improperly.

## Project Creation

```bash
uvx create-dagster project <name> --uv-sync  # --uv-sync creates venv and installs deps (recommended)
```

## Workspace Creation

```bash
uvx create-dagster workspace <name>          # For multiple related projects
```
