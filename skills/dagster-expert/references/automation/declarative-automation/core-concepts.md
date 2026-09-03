---
title: Core Concepts
triggers:
  - "using eager(), on_cron(), or on_missing() conditions"
---

# Declarative Automation: Core Concepts

For introductory examples, see the main SKILL.md Quick Reference section on Declarative Automation.

## The Three Main Conditions

Dagster ships three primary conditions tailored to common use cases. Begin with one of these instead of building conditions from scratch.

### eager()

Executes an asset whenever any dependency updates. Also materializes partitions that go missing after the condition is applied.

```python
import dagster as dg

@dg.asset(automation_condition=dg.AutomationCondition.eager())
def downstream_asset(upstream_asset):
    # Executes immediately when upstream_asset materializes
    ...
```

**Behavior**:

- Fires immediately when any upstream updates
- Waits until all upstreams are materialized or in-progress
- Will not execute if any dependency is missing
- **Will not execute if any dependency is currently in-progress** (waits for all deps to finish first)
- Will not execute if the asset itself is already in-progress
- For time-partitioned assets, only the latest partition is considered
- For static/dynamic-partitioned assets, all partitions are considered

**Full expanded form**:

```python
(
    dg.AutomationCondition.in_latest_time_window()          # latest partition only (time-partitioned)
    & (
        dg.AutomationCondition.newly_missing()
        | dg.AutomationCondition.any_deps_updated()
    ).since_last_handled()                                  # trigger event, persisted until handled
    & ~dg.AutomationCondition.any_deps_missing()            # no deps missing
    & ~dg.AutomationCondition.any_deps_in_progress()        # no deps currently running
    & ~dg.AutomationCondition.in_progress()                 # asset itself not running
).with_label("eager")
```

The `~any_deps_in_progress()` guard is critical: it holds the asset back until ALL upstream deps have finished materializing. Without it, the asset would fire each time an individual dep completes, leading to redundant executions when multiple deps update in rapid succession (e.g., from the same scheduled job).

**Use when**: You want upstream updates to propagate downstream immediately, without waiting for a schedule.

### on_cron()

Executes an asset on a cron schedule once all dependencies have updated since the most recent cron tick.

```python
@dg.asset(
    automation_condition=dg.AutomationCondition.on_cron("0 9 * * *", "America/Los_Angeles")
)
def daily_summary(hourly_data):
    # Executes at 9 AM only if hourly_data has updated since the previous 9 AM tick
    ...
```

**Behavior**:

- Waits for a cron tick
- After the tick, waits for all dependencies to update since that tick
- Executes immediately once all dependencies have been updated
- For time-partitioned assets, only the latest partition is considered
  **Full expanded form**:

```python
cron_schedule = "0 1 * * *"
cron_timezone = "US/Eastern"
(
    dg.AutomationCondition.in_latest_time_window()
    & dg.AutomationCondition.cron_tick_passed(
        cron_schedule, cron_timezone
    ).since_last_handled()
    & dg.AutomationCondition.all_deps_updated_since_cron(cron_schedule, cron_timezone)
).with_label(f"on_cron({cron_schedule}, {cron_timezone})")
```

**Use when**: You want scheduled execution but only after upstream data is available. More intelligent than plain schedules.

### on_missing()

Materializes missing asset partitions once all upstream partitions are available.

```python
@dg.asset(automation_condition=dg.AutomationCondition.on_missing())
def backfill_asset(upstream):
    # Executes for any missing partitions when upstream is ready
    ...
```

**Behavior**:

- Only processes partitions that are currently missing
- Only considers partitions added after the condition was applied (not historical ones)
- Waits until all upstream dependencies are available
- For time-partitioned assets, only the latest partition is considered
  **Full expanded form**:

```python
(
    dg.AutomationCondition.in_latest_time_window()
    & (
        dg.AutomationCondition.missing()
        .newly_true()
        .since_last_handled()
        .with_label("missing_since_last_handled")
    )
    & ~dg.AutomationCondition.any_deps_missing()
).with_label("on_missing")
```

**Use when**: You want missing partitions filled in as upstream data becomes available. Well suited for backfilling or catching up on historical data.

## Identifying Built-in vs Custom Conditions from the API

When debugging DA behavior via `dg api asset get`, the `automation_condition.expanded_label` field exposes the condition tree as a list of strings. Compare this against the full expanded forms above to determine whether the asset uses a built-in condition or a custom one with missing guards. When you encounter a condition that resembles but does not match a built-in, always identify the absent sub-conditions and explain how their omission changes the behavior.

## Evaluation by Sensor

The `AutomationConditionSensorDefinition` evaluates conditions at regular intervals.

**Default sensor**: A sensor named `default_automation_condition_sensor` is created automatically in code locations that have automation conditions.

**Configuration**:

- Evaluates all conditions every 30 seconds
- Must be enabled in the UI under **Automation → Sensors**
- Launches runs whenever conditions evaluate to true

**Important**: If the sensor is disabled, no conditions will be evaluated and no runs will be triggered.

## Basic Customization

All three main conditions are composed from smaller building blocks and can be adjusted.

### Modifying conditions

```python
# Remove sub-conditions
condition = dg.AutomationCondition.eager().without(
    ~dg.AutomationCondition.any_deps_missing()
)

# Replace sub-conditions
condition = dg.AutomationCondition.on_cron("0 9 * * *").replace(
    old=dg.AutomationCondition.all_deps_updated_since_cron("0 9 * * *"),
    new=dg.AutomationCondition.all_deps_updated_since_cron("0 0 * * *"),
)
```

### Boolean composition

```python
# AND: Both conditions must be true
condition = (
    dg.AutomationCondition.eager()
    & ~dg.AutomationCondition.in_progress()
)

# OR: Either condition can be true
condition = (
    dg.AutomationCondition.on_cron("0 9 * * *")
    | dg.AutomationCondition.any_deps_updated()
)
```

See [customization.md](customization.md) for detailed patterns and examples.

## When to Use Declarative Automation

**Prefer declarative automation when**:

- Working with asset-centric pipelines that have complex update logic
- Triggers depend on conditions such as data availability or freshness
- Dependency-aware execution is required
- A declarative style is preferred over imperative logic

**Prefer schedules when**:

- Time-based execution without dependency logic is sufficient
- Execution at predictable, fixed times is the only requirement

**Prefer sensors when**:

- Custom polling logic is needed for external systems
- Imperative actions beyond asset execution are required
- File watching or API event monitoring is involved
