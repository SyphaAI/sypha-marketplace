---
title: Declarative Automation
type: index
triggers:
  - "asset-centric condition-based automation using AutomationCondition"
---

# Declarative Automation Reference

Declarative automation relies on `AutomationCondition` objects to specify when assets should execute. Rather than scheduling jobs, you attach conditions to assets and the system evaluates them automatically.

## Overview

**Modern automation pattern**: Place conditions directly on assets instead of creating separate schedules or sensors. The system evaluates conditions every 30 seconds and triggers runs whenever conditions are satisfied.

**Benefits**:

- Asset-native: No separate job definitions required
- Dependency-aware: Upstream state is considered automatically
- Composable: Complex conditions are built from simple building blocks
- Declarative: Easier to reason about than imperative sensors

**Basic examples**: See the main SKILL.md Quick Reference for `eager()`, `on_cron()`, and `on_missing()` examples.

## Requirements

- **Assets only**: Declarative automation is not compatible with ops or graphs
- **Sensor must be enabled**: The `default_automation_condition_sensor` must be turned on in the Dagster UI under **Automation → Sensors**

## Core Concepts

### The Three Main Conditions

Begin with one of these three conditions instead of building conditions from scratch:

- **`eager()`**: Execute immediately when dependencies update
- **`on_cron()`**: Execute on a schedule after dependencies update
- **`on_missing()`**: Execute missing partitions when dependencies are ready

### Customization

Each of the three main conditions can be customized:

- Remove sub-conditions with `.without()`
- Replace sub-conditions with `.replace()`
- Filter dependencies with `.allow()` and `.ignore()`
- Combine using boolean operators: `&` (AND), `|` (OR), `~` (NOT)

### Advanced Concepts

- **Status vs Events**: Conditions can represent persistent states or transient moments
- **Operands**: Base building blocks such as `missing()` and `newly_updated()`
- **Operators**: Composition tools like `since()` and `any_deps_match()`

## Reference Files Index

<!-- BEGIN GENERATED INDEX -->

- [Advanced](./advanced.md) — status vs events, run grouping, or filtering in declarative automation
- [Core Concepts](./core-concepts.md) — using eager(), on_cron(), or on_missing() conditions
- [Customization](./customization.md) — customizing conditions with without(), replace(), allow(), or ignore()
- [Operands](./operands.md) — base condition building blocks like missing() or newly_updated()
- [Operators](./operators.md) — combining conditions using since, any_deps_match, or boolean operators
<!-- END GENERATED INDEX -->
