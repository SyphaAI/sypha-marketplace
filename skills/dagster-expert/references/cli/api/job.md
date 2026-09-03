---
title: dg api job
triggers:
  - "listing or inspecting jobs in Dagster Plus"
---

# dg api job Reference

Commands for querying jobs within a Dagster Plus deployment.

## dg api job list

```bash
dg api job list
```

Retrieves a list of all jobs in the deployment.

## dg api job get

```bash
dg api job get <JOB_NAME>
```

Returns the details of a particular job in the deployment.

## Launching jobs

To launch a job against a deployed Dagster Plus environment, refer to [`dg api run launch`](./run/launch.md). For local in-process execution while developing, refer to [`dg launch`](../launch.md).
