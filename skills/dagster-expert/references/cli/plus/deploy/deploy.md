---
title: dg plus deploy
triggers:
  - "ad-hoc deployment to Dagster Plus"
---

Push code to Dagster Plus. This command is usually triggered automatically by CI pipelines established through `dg plus deploy configure`, but it can also be executed manually for one-off deployments.

```bash
dg plus deploy
```

In most situations, use `dg plus deploy configure` to establish automated CI/CD deployments instead of invoking this command directly.
