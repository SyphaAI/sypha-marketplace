---
title: "dbt: Cloud Integration"
triggers:
  - "integrating dbt Cloud with Dagster"
---

# dbt Cloud Integration

The dagster-dbt library supports integration with dbt Cloud through the v2 API (recommended) for
projects hosted on dbt Cloud.

## When to Use

Choose the dbt Cloud integration when:

- Your dbt project is managed and executed in dbt Cloud
- You need to launch dbt Cloud jobs from Dagster
- You want to pull dbt Cloud job metadata into Dagster as assets

For dbt Core projects (self-hosted), use the [Component-Based](component-based-integration.md) or
[Pythonic](pythonic-integration.md) integration instead.

## Key Components

- **`DbtCloudWorkspace`**: Resource for accessing a dbt Cloud workspace
- **`DbtCloudCredentials`**: Authentication credentials (account_id, token, access_url)
- **`dbt_cloud_assets`**: Decorator for defining assets from a dbt Cloud job
- **`load_dbt_cloud_asset_specs()`**: Load asset specs from dbt Cloud job
- **`build_dbt_cloud_polling_sensor()`**: Create a sensor that polls for dbt Cloud job completion

## Basic Setup

```python
import dagster as dg
from dagster_dbt import DbtCloudCredentials, DbtCloudWorkspace, dbt_cloud_assets

# Define credentials
dbt_cloud_credentials = DbtCloudCredentials(
    account_id=12345,
    token=dg.EnvVar("DBT_CLOUD_API_TOKEN"),
    access_url="https://cloud.getdbt.com",
)

# Define workspace resource
dbt_cloud = DbtCloudWorkspace(
    credentials=dbt_cloud_credentials,
    project_id=67890,
    environment_id=1,
)


# Define assets from dbt Cloud job
@dbt_cloud_assets(workspace=dbt_cloud)
def my_dbt_cloud_assets(context: dg.AssetExecutionContext):
    # Trigger the dbt Cloud job and wait for completion
    ...


defs = dg.Definitions(
    assets=[my_dbt_cloud_assets],
    resources={"dbt_cloud": dbt_cloud},
)
```

## Features

The dbt Cloud integration:

- Launches dbt Cloud jobs from Dagster
- Exposes dbt models as Dagster assets with accurate lineage
- Synchronizes metadata from dbt Cloud job runs
- Enables polling sensors to monitor externally triggered jobs

For detailed usage, refer to the dagster-dbt dbt Cloud documentation.
