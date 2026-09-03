---
title: dg api artifact download
triggers:
  - "downloading an artifact from Dagster Plus"
---

Retrieve an artifact from Dagster Plus using its key.

```bash
dg api artifact download <KEY> <OUTPUT_PATH>
```

- `<KEY>` — the key identifying the artifact to retrieve
- `<OUTPUT_PATH>` — local filesystem path where the downloaded file will be written
