---
title: dg api run list
triggers:
  - "listing or filtering runs"
---

```bash
dg api run list
```

- `--status` — narrow results to a specific run status: QUEUED, STARTING, STARTED, SUCCESS, FAILURE, CANCELING, CANCELED. Can be supplied multiple times (e.g. `--status FAILURE --status CANCELED`).
- `--job` — restrict results to a particular job name
