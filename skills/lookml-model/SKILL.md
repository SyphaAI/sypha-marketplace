---
name: lookml-model
description: >-
  Use this skill when creating or modifying a LookML Model file
  (.model.lkml). Covers defining connections, includes, and configuring
  model-level settings.
metadata:
  category: data
  source:
    repository: 'https://github.com/looker-open-source/looker-skills'
    path: skills/lookml-model
    license_path: LICENSE
    commit: c530d1b7efee1db49851a04563ce946adfd191a8
---

# Instructions

1.  **Define the Model File**: A model file typically maps to a single database connection and contains Explores.
2.  **Required Parameters**:
    - `connection: "connection_name"`: Must correspond to a connection defined in Looker Admin.
    - `include: "pattern"`: Specifies which view and dashboard files the model can access.
3.  **Best Practices**:
    - **Includes**: Avoid `include: "*.view"` where possible to prevent performance degradation and namespace pollution. Prefer specific paths or targeted wildcards such as `include: "/views/users.view"` or `include: "/views/marketing/*.view"`.
    - **Label**: Use `label:` to give the model a human-readable name in the Looker UI.
    - **Week Start Day**: Set `week_start_day:` when business logic requires a non-default start day (e.g., `monday`).
    - **Datagroups & Caching**: ALWAYS use datagroups for cache invalidation policies to keep Looker synchronized with your ETL/ELT processes.

## 4. Datagroups & Caching

Datagroups are the recommended approach for managing caching policies.

- **Definition**: Declared in the model file.
- **sql_trigger**: A query returning a single value (e.g., max timestamp). A change in this value invalidates the cache.
- **max_cache_age**: A fallback TTL used when the trigger value has not changed.
- **persist_with**: Applies the datagroup to individual Explores or to the model as a whole.

### Datagroups vs `persist_for`

| Feature        | Datagroups (Recommended)                   | `persist_for`                         |
| :------------- | :----------------------------------------- | :------------------------------------ |
| **Trigger**    | SQL Query (Smart)                          | Fixed Time (Dumb)                     |
| **Alignment**  | Aligns with ETL/ELT completion             | Misaligned (guesswork)                |
| **Management** | Centralized in Model file                  | Scattered in Explores/Models          |
| **Use Case**   | Production dashboards, ETL synchronization | Ad-hoc queries, Real-time (<1h) needs |

> [!TIP]
> Reserve `persist_for` for real-time dashboards that require a forced cache refresh at a fixed interval (e.g., stock tickers, fast-moving inventory). Use **Datagroups** in all other situations.

## 5. Include Patterns

Apply strict patterns to manage scope and avoid performance issues.

| Pattern | Description | Use Case |
| :--- | :--- | :--- |
| `include: "/views/*.view"` | All views in specific folder | Standard modularity |
| `include: "/views/marketing/users.view"` | Specific file | Precise control, avoids conflicts |
| `include: "/**/*.view"` | **Recursive** (all views in project) | **Avoid** unless small project |
| `include: "/dashboards/*.dashboard"` | All dashboards in folder | Importing dashboards |

# Examples

## Basic Model

```lookml
connection: "thelook"

# Include all views in the views/ folder
include: "/views/*.view"

# Include all dashboards
include: "/*.dashboard"

# Define an Explore (usually better to define in separate files for large projects, but acceptable here for small ones)
explore: orders {
  join: users {
    type: left_outer
    sql_on: ${orders.user_id} = ${users.id} ;;
    relationship: many_to_one
  }
}
```

## Model with Specific Settings

````lookml
connection: "snowlooker"

label: "eCommerce Analytics"

# Set valid week start day
week_start_day: monday

# Include specific folders
include: "/views/finance/*.view"
include: "/views/marketing/*.view"

## Model with Datagroup (Best Practice)

```lookml
connection: "thelook"

# Define the caching policy
datagroup: ecommerce_etl {
  description: "Triggers when the max created_at date changes in the events table."
  sql_trigger: SELECT MAX(created_at) FROM `project.dataset.events` ;;
  max_cache_age: "24 hours" # Fallback
}

# Apply default caching to all Explores in this model
persist_with: ecommerce_etl

include: "/views/*.view"

explore: orders {
  # This explore inherits 'persist_with: ecommerce_etl' from the model default
}

explore: real_time_dashboard {
  # Override with a different policy if needed
  persist_for: "5 minutes"
}
```
