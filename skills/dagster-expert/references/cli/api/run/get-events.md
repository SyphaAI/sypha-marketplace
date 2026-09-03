---
title: dg api run get-events
triggers:
  - "debugging a run by reading its logs; filtering run events by level or step"
---

```bash
dg api run get-events <RUN_ID>
```

- `--level` — restrict results to a specific log level: DEBUG, INFO, WARNING, ERROR, CRITICAL. Repeatable.
- `--event-type` — restrict results to a specific event type (e.g. `STEP_FAILURE`, `RUN_START`). Repeatable.
- `--step` — restrict results to a specific step key. Supports partial matching — `--step my_asset` will match any step key containing that substring. Repeatable.
- `--limit` — maximum number of events to return.
- `--cursor` — pagination cursor used to retrieve additional events.
