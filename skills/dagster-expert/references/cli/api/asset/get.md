---
title: dg api asset get
triggers:
  - "details about a specific asset"
---

```bash
dg api asset get <ASSET_KEY>
```

When the asset key contains a prefix, supply it using slash-separated syntax: `dg api asset get my_prefix/my_asset`.

`--status` — appends materialization status information to the output. Omitted by default because it requires extra API calls.
