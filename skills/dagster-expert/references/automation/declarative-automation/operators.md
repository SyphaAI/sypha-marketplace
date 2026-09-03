---
title: Operators
triggers:
  - "combining conditions using since, any_deps_match, or boolean operators"
---

# Declarative Automation: Operators

Operators take operands and other conditions and compose them into more elaborate expressions through boolean logic and transformations.

## Boolean Operators

**`&` (AND)**: Both conditions must be true:

```python
import dagster as dg

condition = (
    dg.AutomationCondition.newly_updated()
    & ~dg.AutomationCondition.in_progress()
)
```

**`|` (OR)**: Either condition must be true:

```python
condition = (
    dg.AutomationCondition.missing()
    | dg.AutomationCondition.newly_updated()
)
```

**`~` (NOT)**: Negates the condition:

```python
condition = ~dg.AutomationCondition.any_deps_missing()
```

## Transformation Operators

### since(reset_condition)

Lifts events into status. Becomes true when the operand becomes true and stays true until the reset condition becomes true.

```python
# True from when dependency updates until asset is requested
condition = dg.AutomationCondition.any_deps_updated().since(
    dg.AutomationCondition.newly_requested()
)
```

**Pattern**: `A.since(B)` means "A has occurred more recently than B"

**Use case**: Derive persistent states from transient events. "Upstream updated" is an event, but "upstream updated since I was last requested" is a status.

### newly_true()

Converts status into an event. True only on the tick when the operand transitions from false to true.

```python
# True only on the tick when the asset becomes missing
condition = dg.AutomationCondition.missing().newly_true()
```

**Use case**: Avoid repeated actions while a state persists. `missing()` remains true across many ticks, but `missing().newly_true()` fires only once.

### since_last_handled()

Convenience method equivalent to `.since(newly_requested() | newly_updated() | initial_evaluation())`.

```python
condition = dg.AutomationCondition.any_deps_updated().since_last_handled()
```

True from when the condition becomes true until the asset is requested, updated, or the condition is first applied.

## Dependency Operators

### any_deps_match(condition)

True when the condition holds for at least one partition of any upstream dependency.

```python
condition = dg.AutomationCondition.any_deps_match(
    dg.AutomationCondition.missing()
)
```

Supports filtering with `.allow()` and `.ignore()`.

### all_deps_match(condition)

True when the condition holds for at least one partition of every upstream dependency.

```python
condition = dg.AutomationCondition.all_deps_match(
    dg.AutomationCondition.newly_updated()
)
```

Every upstream asset must have at least one partition satisfying the condition.

## Dependency Filtering

### allow(selection)

Narrows the set of checked dependencies to only those in the `AssetSelection`:

```python
# Only consider dependencies in the "important" group
condition = dg.AutomationCondition.any_deps_match(
    dg.AutomationCondition.missing()
).allow(dg.AssetSelection.groups("important"))
```

Creates an intersection: `dep_keys & allowed_selection`

### ignore(selection)

Removes dependencies in the `AssetSelection` from consideration:

```python
# Ignore the "foo" asset when checking for updates
condition = dg.AutomationCondition.any_deps_updated().ignore(
    dg.AssetSelection.assets("foo")
)
```

Creates a subtraction: `dep_keys - ignored_selection`

### Propagation Through Boolean Operators

When applied to `AND`/`OR` conditions, `.allow()` and `.ignore()` propagate to all sub-conditions:

```python
# Applies allow() to all dependency checks within eager()
condition = dg.AutomationCondition.eager().allow(
    dg.AssetSelection.groups("critical")
)
```

## Check Operators

### any_checks_match(condition, blocking_only)

True if any of the asset's checks match the condition.

```python
condition = dg.AutomationCondition.any_checks_match(
    dg.AutomationCondition.check_failed(),
    blocking_only=True,
)
```

Parameters:

- `condition`: Condition to evaluate against checks
- `blocking_only` (bool): If True, only considers blocking checks (default: False)

### all_checks_match(condition, blocking_only)

True if all of the asset's checks match the condition.

```python
condition = dg.AutomationCondition.all_checks_match(
    dg.AutomationCondition.check_passed(),
    blocking_only=True,
)
```

## Labeling

### with_label(label)

Attaches a human-readable label to a condition for debugging and UI display:

```python
condition = (
    dg.AutomationCondition.any_deps_updated()
    .since(dg.AutomationCondition.newly_requested())
).with_label("updated_since_requested")
```

Labels surface in condition evaluation traces within the Dagster UI, making it easier to interpret complex conditions.
