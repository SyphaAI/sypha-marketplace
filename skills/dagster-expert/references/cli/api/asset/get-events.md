---
title: dg api asset get-events
triggers:
  - "materialization or observation event history for an asset"
---

```bash
dg api asset get-events <ASSET_KEY>
```

- `--event-type` — restrict results to a specific event type (e.g. `ASSET_MATERIALIZATION`, `ASSET_OBSERVATION`)
- `--partition` — narrow events to those belonging to a particular partition key
- `--before` — include only events that occurred before the given timestamp; combine with `--limit` for chronological pagination
