---
title: Asset Sensors
triggers:
  - "triggering on asset materialization events"
---

# Asset Sensors

Asset sensors watch for asset materializations and launch jobs whenever targeted assets are materialized.

## Basic Asset Sensor

Use `@asset_sensor` to watch a specific asset:

```python nocheckundefined
@dg.asset_sensor(asset_key=dg.AssetKey("daily_sales_data"), job=downstream_job)
def sales_data_sensor(context: dg.SensorEvaluationContext, asset_event: dg.EventLogEntry):
    # Triggered whenever daily_sales_data is materialized
    yield dg.RunRequest(run_key=context.cursor)
```

The sensor is invoked once per materialization event, with the event details available through `asset_event`.

## Cross-Job Dependencies

Asset sensors make it possible to wire dependencies between distinct jobs:

```python nocheckundefined
# Job A contains upstream_asset
@dg.asset
def upstream_asset():
    ...

job_a = dg.define_asset_job("job_a", selection=[upstream_asset])

# Job B is triggered when upstream_asset materializes
@dg.asset_sensor(asset_key=dg.AssetKey("upstream_asset"), job=job_b)
def cross_job_sensor(context, asset_event):
    return dg.RunRequest()
```

This pattern is well-suited to situations where logically separate jobs need to coordinate with each other.

## Cross-Code Location Dependencies

Asset sensors can observe assets that reside in different code locations:

```python nocheckundefined
@dg.asset_sensor(
    asset_key=dg.AssetKey("other_location_asset"),
    job=my_job,
)
def cross_location_sensor(context, asset_event):
    return dg.RunRequest()
```

The sensor does not need to share the same code location as the monitored asset.

## Custom Evaluation Logic

Include conditional logic to govern when a run should be triggered:

```python nocheckundefined
@dg.asset_sensor(asset_key=dg.AssetKey("daily_sales_data"), job=downstream_job)
def conditional_sensor(context, asset_event):
    # Access materialization metadata
    metadata = asset_event.dagster_event.event_specific_data.materialization.metadata

    row_count = metadata.get("row_count").value if "row_count" in metadata else 0

    if row_count > 1000:
        return dg.RunRequest()
    else:
        return dg.SkipReason(f"Row count {row_count} too low, threshold is 1000")
```

**Use cases for conditional logic**: Start downstream processing only when data volume meets a threshold, quality checks have passed, or particular metadata conditions are satisfied.

## Triggering with Custom Configuration

Supply runtime configuration to the job being triggered:

```python nocheckundefined
@dg.asset_sensor(asset_key=dg.AssetKey("source_data"), job=processing_job)
def config_sensor(context, asset_event):
    # Extract partition key from the materialization
    partition_key = asset_event.dagster_event.logging_tags.get("dagster/partition")

    return dg.RunRequest(
        run_key=partition_key,
        tags={"dagster/partition": partition_key},
    )
```

This lets you forward partition information or other metadata from the upstream asset into the triggered job.

## Asset Sensors vs Declarative Automation

**Use asset sensors when**:

- Invoking imperative side effects (notifications, external API calls)
- Launching jobs that require complex custom logic
- Handling cross-code location dependencies with conditional triggers
- Inspecting materialization metadata before committing to a trigger

**Use declarative automation when**:

- Coordinating asset-to-asset execution within the same code location
- Expressing dependencies in terms of asset freshness or missing status
- Composable conditions are needed to capture sophisticated dependency logic

Declarative automation is the preferred approach for asset-centric workflows. Asset sensors remain useful for initiating actions outside the asset graph or whenever imperative control is necessary.
