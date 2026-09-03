---
title: Customization
triggers:
  - "customizing conditions with without(), replace(), allow(), or ignore()"
---

# Declarative Automation: Customization

Begin from one of the three main conditions (`eager()`, `on_cron()`, `on_missing()`) and tailor it using the patterns below.

## Pattern 1: Removing Sub-conditions with without()

Strip unwanted sub-conditions from composite conditions.

**Allow missing upstreams**: By default, `eager()` waits for all dependencies. Drop this requirement:

```python
import dagster as dg

condition = (
    dg.AutomationCondition.eager()
    .without(~dg.AutomationCondition.any_deps_missing())
    .with_label("eager_allow_missing")
)
```

**Update all time partitions**: By default, `eager()` targets only the latest time partition. Drop this restriction:

```python
condition = (
    dg.AutomationCondition.eager()
    .without(dg.AutomationCondition.in_latest_time_window())
    .with_label("eager_all_partitions")
)
```

## Pattern 2: Replacing Sub-conditions with replace()

Substitute one sub-condition for another with different parameters.

**Multiple cron schedules**: Trigger execution at 9 AM but require dependencies to have updated since midnight:

```python
NINE_AM_CRON = "0 9 * * *"
MIDNIGHT_CRON = "0 0 * * *"

condition = dg.AutomationCondition.on_cron(NINE_AM_CRON).replace(
    old=dg.AutomationCondition.all_deps_updated_since_cron(NINE_AM_CRON),
    new=dg.AutomationCondition.all_deps_updated_since_cron(MIDNIGHT_CRON),
)
```

**Partition lookback window**: Broaden `on_missing()` to cover the last 24 hours of partitions:

```python
import datetime

condition = dg.AutomationCondition.on_missing().replace(
    old=dg.AutomationCondition.in_latest_time_window(),
    new=dg.AutomationCondition.in_latest_time_window(
        lookback_delta=datetime.timedelta(hours=24)
    ),
)
```

## Pattern 3: Filtering Dependencies with allow() and ignore()

Restrict which dependencies are taken into account.

**Only specific dependencies**: Trigger only on updates from assets in the "abc" group:

```python
condition = dg.AutomationCondition.eager().allow(
    dg.AssetSelection.groups("abc")
)
```

**Exclude specific dependencies**: Disregard updates from the "foo" asset:

```python
condition = dg.AutomationCondition.eager().ignore(
    dg.AssetSelection.assets("foo")
)
```

## Pattern 4: Boolean Composition

Join multiple conditions using AND (`&`), OR (`|`), NOT (`~`).

**Scheduled with dependency-driven fallback**: Execute every 5 minutes or whenever dependencies update (provided they updated today):

```python
daily_success_condition = dg.AutomationCondition.newly_updated().since(
    dg.AutomationCondition.cron_tick_passed("0 0 * * *")
)

condition = (
    dg.AutomationCondition.cron_tick_passed("*/5 * * * *")
    | (
        dg.AutomationCondition.any_deps_updated()
        & daily_success_condition
        & ~dg.AutomationCondition.any_deps_missing()
        & ~dg.AutomationCondition.any_deps_in_progress()
    )
)
```

**Only execute when checks pass**: Require that all blocking checks on dependencies succeed:

```python
condition = (
    dg.AutomationCondition.eager()
    & dg.AutomationCondition.all_deps_match(
        dg.AutomationCondition.all_checks_match(
            dg.AutomationCondition.check_passed(),
            blocking_only=True,
        )
    )
)
```

## Pattern 5: Custom Event-Based Conditions

Construct conditions from operands and operators to address specific scenarios.

**On code version change**: Execute when the code version changes:

```python
condition = (
    dg.AutomationCondition.code_version_changed().since_last_handled()
    & ~dg.AutomationCondition.any_deps_missing()
)
```

**After upstream success**: Execute only when a specific upstream asset updates:

```python
condition = (
    dg.AutomationCondition.any_deps_match(
        dg.AutomationCondition.newly_updated()
    ).allow(dg.AssetSelection.assets("critical_upstream"))
    .since_last_handled()
)
```

## Combining Patterns

Several patterns can be composed together to handle complex requirements:

```python
condition = (
    dg.AutomationCondition.eager()
    .without(dg.AutomationCondition.in_latest_time_window())  # Pattern 1
    .ignore(dg.AssetSelection.assets("staging_data"))         # Pattern 3
    & dg.AutomationCondition.all_checks_match(                # Pattern 4
        dg.AutomationCondition.check_passed(),
        blocking_only=True,
    )
).with_label("custom_backfill_with_checks")
```

This condition starts from `eager()`, removes the latest partition restriction, excludes a specific dependency, and adds a check requirement.
