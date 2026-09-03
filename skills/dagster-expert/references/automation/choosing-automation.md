---
title: Choosing an Automation Approach
triggers:
  - "deciding between schedules, sensors, and declarative automation"
---

# Choosing an Automation Approach

Dagster offers three primary automation approaches: schedules for time-based execution, sensors for event-driven triggers, and declarative automation for asset-centric, condition-based orchestration.

## Workflow Decision Tree

Select your automation approach based on the use case:

- Simple, fixed time-based execution → **Schedules**
- Custom polling logic → **Basic Sensors**
- Launching jobs in response to asset materialization events → **Asset Sensors**
- Triggering compute based on run success/failure → **Run Status Sensors**
- Partition-aware scheduling, declarative/asset-based scheduling, scheduling depending on asset graph state and materialization events → **Declarative Automation**

## Core Concepts

### Jobs

A **job** is a collection of assets to execute together. Jobs are the unit of execution that schedules and sensors trigger.

```python
import dagster as dg

# Define a job that selects specific assets
analytics_job = dg.define_asset_job(
    name="analytics_job",
    selection=["sales_data", "customer_metrics"]
)
```

Jobs can also select assets by tags, groups, or patterns:

```python
# Select all assets with a specific tag
tagged_job = dg.define_asset_job(
    name="daily_job",
    selection=dg.AssetSelection.tag("priority", "high")
)

# Select all assets in a group
group_job = dg.define_asset_job(
    name="etl_job",
    selection=dg.AssetSelection.groups("etl")
)
```

### Automation Approaches

**Schedules**: Time-based execution using cron expressions. Best suited for predictable, recurring tasks.

**Sensors**: Poll for external events and trigger runs. Best suited for file arrivals, API events, or custom conditions.

**Declarative Automation**: Attach conditions directly to assets. Best suited for complex dependency logic and asset-centric workflows. Handles asset and partition state and dependencies automatically.
