---
title: dg api asset get-evaluations
triggers:
  - "automation condition evaluation history for an asset"
---

```bash
dg api asset get-evaluations <ASSET_KEY>
```

`--include-nodes` — adds individual evaluation nodes to the response. Warning: the output will be dense, containing the complete condition tree evaluated for every record. Limit use to scenarios involving a small number of records.
