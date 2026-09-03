---
title: dg api sensor get-ticks
triggers:
  - "viewing sensor tick history; checking sensor evaluation results and failures"
---

```bash
dg api sensor get-ticks <SENSOR_NAME>
```

- `--status` — restrict results to a specific tick status: STARTED, SKIPPED, SUCCESS, FAILURE. Can be specified more than once.
- `--limit` — cap on the number of ticks returned (default: 25).
- `--cursor` — cursor value for paginating through results.
- `--before` — include only ticks that occurred before this Unix timestamp.
- `--after` — include only ticks that occurred after this Unix timestamp.
- `--json` — emit results in JSON format.
