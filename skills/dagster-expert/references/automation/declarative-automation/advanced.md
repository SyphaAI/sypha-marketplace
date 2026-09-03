---
title: Advanced
triggers:
  - "status vs events, run grouping, or filtering in declarative automation"
---

# Declarative Automation: Advanced Concepts

This document addresses advanced topics for a thorough understanding of the declarative automation system.

## Status vs Events

Grasping the difference between statuses and events is essential for writing correct automation conditions.

### Statuses

**Statuses** are persistent conditions that hold true across multiple evaluation ticks.

Examples:

- `AutomationCondition.missing()` - Remains true until the partition is materialized
- `AutomationCondition.in_progress()` - True while a run is executing
- `AutomationCondition.in_latest_time_window()` - True for the latest time partition(s)

**Characteristic**: If the underlying state has not changed, the status evaluates to true on consecutive ticks.

### Events

**Events** are transient conditions that are true only on a single evaluation tick.

Examples:

- `AutomationCondition.newly_updated()` - True only on the tick when materialization happens
- `AutomationCondition.code_version_changed()` - True only on the first tick after a code change
- `AutomationCondition.cron_tick_passed()` - True only on the first tick after the cron fires

**Characteristic**: Evaluated immediately again, the event would be false (assuming no further change).

### Converting Between Status and Event

**Status → Event with `newly_true()`**:

```python
# missing() is a status (stays true for many ticks)
# newly_true() converts it to an event (true only when becoming missing)
condition = dg.AutomationCondition.missing().newly_true()
```

**Use case**: Avoid repeated requests during persistent states. A partition remains missing while a run is in progress. Using `newly_true()` ensures it is only requested once.

**Two Events → Status with `since()`**:

```python
# Both newly_updated() and newly_requested() are events
# since() converts them to a status: "updated more recently than requested"
condition = dg.AutomationCondition.newly_updated().since(
    dg.AutomationCondition.newly_requested()
)
```

**Use case**: Build persistent states from transient events. This condition becomes true when an update occurs and remains true until a request is made.

### Example: Preventing Duplicate Requests

The default `eager()` condition uses this pattern:

```python
(
    dg.AutomationCondition.newly_missing()
    | dg.AutomationCondition.any_deps_updated()
).since_last_handled()
```

- `newly_missing()` and `any_deps_updated()` are events
- `since_last_handled()` converts them into a status that persists until the asset is requested or updated
- Without this conversion, the condition would be true for only a single tick, potentially missing the chance to launch a run

## Run Grouping

Run grouping lets multiple assets execute within a single run even when downstream assets' dependencies have not yet been materialized.

### The Problem

Consider assets A → B → C, all with `eager()` conditions:

1. A's upstream updates, triggering A
2. A is requested and starts executing
3. On the next tick, B sees that A has not finished materializing
4. Without run grouping, B waits for A to complete
5. This produces three separate runs instead of one

### The Solution: will_be_requested()

The `will_be_requested()` operand is true for assets scheduled to be requested in the current tick. Dependency conditions use this to group assets:

```python
# From any_deps_updated() definition:
dg.AutomationCondition.any_deps_match(
    (
        dg.AutomationCondition.newly_updated()
        & ~dg.AutomationCondition.executed_with_root_target()
    )
    | dg.AutomationCondition.will_be_requested()  # Enables run grouping
)
```

When evaluating B:

1. B checks whether any dependencies have updated OR will be requested this tick
2. A is marked as "will be requested" this tick
3. B treats A as though it were already updated
4. B is also scheduled for execution in the same run as A

### Requirements for Same-Run Execution

Two assets can run together if:

1. **Same repository**: Both must be in the same code location
2. **Compatible partitions**: Both must share matching `PartitionsDefinition` objects
3. **Compatible partition mapping**: Must use `TimeWindowPartitionMapping` or `IdentityPartitionMapping`

If these conditions are not satisfied, assets execute in separate runs even when run grouping logic is in place.

## Dependency Filtering with allow() and ignore()

Dependency operators (`any_deps_match()`, `all_deps_match()`) evaluate conditions against upstream assets. Filtering determines which upstreams are included in that evaluation.

### allow() Creates Intersection

Only dependencies within the selection are evaluated:

```python
condition = dg.AutomationCondition.any_deps_match(
    dg.AutomationCondition.missing()
).allow(dg.AssetSelection.groups("critical"))
```

If the asset has 10 upstreams but only 2 belong to the "critical" group, only those 2 are checked.

### ignore() Creates Subtraction

Dependencies in the selection are excluded from evaluation:

```python
condition = dg.AutomationCondition.any_deps_updated().ignore(
    dg.AssetSelection.assets("test_data", "staging_data")
)
```

Updates to "test_data" and "staging_data" will not trigger the condition.

### Propagation Through Operators

When applied to composite conditions (AND/OR), filtering cascades to all sub-conditions:

```python
# Applies to both any_deps_missing() and any_deps_in_progress() within eager()
condition = dg.AutomationCondition.eager().allow(
    dg.AssetSelection.groups("production")
)
```

**What gets filtered**: All `any_deps_match()` and `all_deps_match()` calls

**What does not get filtered**: Direct operands like `missing()` applied to the asset itself

## Understanding since_last_handled()

`since_last_handled()` is a convenience method that promotes events to a persistent status:

```python
condition = dg.AutomationCondition.newly_missing()

# These are equivalent:
condition.since_last_handled()

condition.since(
    dg.AutomationCondition.newly_requested()
    | dg.AutomationCondition.newly_updated()
    | dg.AutomationCondition.initial_evaluation()
)
```

**Behavior**:

- Becomes true when `condition` first becomes true
- Remains true until the asset is requested, updated, or the condition is first applied
- Resets on initial evaluation to accommodate condition changes

**Use case**: Keep an event alive until it is "handled" by requesting or materializing the asset. This guards against duplicate requests while preventing the event from being dropped.

## Composite Conditions Deep Dive

### any_deps_updated()

```python
dg.AutomationCondition.any_deps_match(
    (dg.AutomationCondition.newly_updated() & ~dg.AutomationCondition.executed_with_root_target())
    | dg.AutomationCondition.will_be_requested()
)
```

Evaluates whether any dependency has been newly updated (excluding same-run updates) OR will be requested in the current tick.

### any_deps_missing()

```python
dg.AutomationCondition.any_deps_match(
    dg.AutomationCondition.missing() & ~dg.AutomationCondition.will_be_requested()
)
```

Evaluates whether any dependency is missing AND will NOT be requested in the current tick. Dependencies scheduled for a request are not treated as blocking.

### all_deps_updated_since_cron()

```python nocheckundefined
dg.AutomationCondition.all_deps_match(
    dg.AutomationCondition.newly_updated().since(
        dg.AutomationCondition.cron_tick_passed(cron_schedule, cron_timezone)
    )
)
```

For each dependency, verifies whether it has been updated since the last cron tick. Every dependency must have at least one partition updated since that tick.
