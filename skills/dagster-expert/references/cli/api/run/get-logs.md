---
title: dg api run get-logs
triggers:
  - "fetching stdout stderr compute logs for a run; downloading step output logs"
---

```bash
dg api run get-logs <RUN_ID>
```

- `--step-key` — limit output to a specific step.
- `--link-only` — return download URLs rather than log content.
- `--max-bytes` — byte limit for log content per step.
- `--cursor` — cursor for paginating through log content.
- `--json` — produce output in JSON format.
