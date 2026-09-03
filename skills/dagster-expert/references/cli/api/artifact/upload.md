---
title: dg api artifact upload
triggers:
  - "uploading an artifact to Dagster Plus"
---

Push an artifact to Dagster Plus and associate it with the given key.

```bash
dg api artifact upload <KEY> <FILE>
```

- `<KEY>` — the key under which the artifact will be stored
- `<FILE>` — path to the local file being uploaded
