---
title: Operands
triggers:
  - "base condition building blocks like missing() or newly_updated()"
---

# Declarative Automation: Operands

Operands are elementary conditions that resolve to true or false for a given asset or asset partition. They capture fundamental states and occurrences.

## Complete List of Operands

| Operand                                                     | Description                                                            | Type   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| `AutomationCondition.missing()`                             | Target has not been executed                                           | Status |
| `AutomationCondition.in_progress()`                         | Target is part of an in-progress run or backfill                       | Status |
| `AutomationCondition.execution_failed()`                    | Target failed in its latest run                                        | Status |
| `AutomationCondition.newly_updated()`                       | Target was updated since the previous evaluation                       | Event  |
| `AutomationCondition.newly_requested()`                     | Target was requested on the previous evaluation                        | Event  |
| `AutomationCondition.code_version_changed()`                | Target has a new code version since the previous evaluation            | Event  |
| `AutomationCondition.cron_tick_passed(schedule, timezone)`  | A new tick of the cron schedule occurred since previous evaluation     | Event  |
| `AutomationCondition.in_latest_time_window(lookback_delta)` | Target falls within the latest time window of the PartitionsDefinition | Status |
| `AutomationCondition.will_be_requested()`                   | Target will be requested in this tick                                  | Status |
| `AutomationCondition.initial_evaluation()`                  | This is the first evaluation of this condition                         | Event  |

## Status vs Event Operands

**Status operands** are durable and hold true across multiple evaluations:

- `missing()` - Stays true until the asset is materialized
- `in_progress()` - True while a run is executing
- `execution_failed()` - True until the asset succeeds or is re-requested
- `in_latest_time_window()` - True for the latest time partition(s)
- `will_be_requested()` - True during the tick when a request will be made

**Event operands** are short-lived and true for a single evaluation only:

- `newly_updated()` - True only on the tick when the update occurs
- `newly_requested()` - True only on the tick when the request is made
- `code_version_changed()` - True only on the first tick after the change
- `cron_tick_passed()` - True only on the first tick after the cron tick
- `initial_evaluation()` - True only on the very first evaluation

## Detailed Descriptions

**`missing()`**: True when the asset partition has not yet been materialized or observed.

**`in_progress()`**: True when the asset partition belongs to an in-progress run or backfill. Combines `run_in_progress()` and `backfill_in_progress()`.

**`execution_failed()`**: True when the most recent execution of the asset partition did not succeed.

**`newly_updated()`**: True when the asset partition was materialized or observed after the previous evaluation. For observations, this is only true if the data version changed.

**`newly_requested()`**: True when the asset partition was requested during the previous evaluation tick.

**`code_version_changed()`**: True when the asset's code version has been updated since the last evaluation.

**`cron_tick_passed(cron_schedule, cron_timezone)`**: True on the first evaluation that follows a tick of the given cron schedule.

Parameters:

- `cron_schedule` (str): Cron expression
- `cron_timezone` (str): Timezone string (default: "UTC")

**`in_latest_time_window(lookback_delta)`**: True for time partitions that fall within the latest time window. For unpartitioned or non-time-partitioned assets, always true.

Parameter:

- `lookback_delta` (Optional[timedelta]): If provided, returns partitions within this delta of the latest window end. For daily partitions with `lookback_delta=timedelta(hours=48)`, returns the latest 2 partitions.

**`will_be_requested()`**: True when the asset partition will be requested during the current tick. Used internally for run grouping (see [advanced.md](advanced.md)).

**`initial_evaluation()`**: True exclusively on the first evaluation after the condition is applied or modified.

## Composite Conditions

Built from base operands for convenience:

| Composite Condition                                                   | Expansion                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AutomationCondition.any_deps_updated()`                              | `any_deps_match((newly_updated() & ~executed_with_root_target()) \| will_be_requested())` |
| `AutomationCondition.any_deps_missing()`                              | `any_deps_match(missing() & ~will_be_requested())`                                        |
| `AutomationCondition.any_deps_in_progress()`                          | `any_deps_match(in_progress())`                                                           |
| `AutomationCondition.all_deps_updated_since_cron(schedule, timezone)` | `all_deps_match(newly_updated().since(cron_tick_passed(schedule, timezone)))`             |

## Usage

Operands are assembled using operators (see [operators.md](operators.md)) to construct complex conditions:

```python
import dagster as dg

# Using operands directly
condition = dg.AutomationCondition.missing() & ~dg.AutomationCondition.in_progress()

# Using composite conditions
condition = dg.AutomationCondition.any_deps_updated()
```
