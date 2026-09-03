---
title: dg check
triggers:
  - "validating project configuration or definitions"
---

## dg check defs

Confirm that all definitions load successfully without errors.

```bash
dg check defs
dg check defs --verbose    # Detailed output
```

## dg check yaml

Check `defs.yaml` files for syntax errors and correct component configuration.

```bash
dg check yaml
```

## dg check toml

Check `pyproject.toml` and `dg.toml` for syntax errors.

```bash
dg check toml
```
