# Semantic Layer Best Practices

Drawn from the [dbt Semantic Layer best practices guide](https://docs.getdbt.com/best-practices/how-we-build-our-metrics/semantic-layer-1-intro).

## Core Principles

1. **Prefer normalization** - Allow MetricFlow to denormalize on demand for end users rather than pre-joining wide tables
2. **Compute in metrics, not rollups** - Place calculations inside metrics rather than frozen aggregations
3. **Start simple** - Begin with simple metrics before progressing to ratio and derived types

## Semantic Model Design

### Entities
- Every semantic model requires exactly **one primary entity**
- Use singular naming (`order` not `order_id`) and reference the column via `expr`
- Foreign entities allow joins across semantic models

### Dimensions
- Always define a **primary time dimension** when the model contains metrics or measures
- Choose granularity to match what time dimensions represent
- Apply computed expressions for derived dimensions (e.g., grouping records by threshold)

### Measures (Legacy Spec) / Simple Metrics (Latest Spec)

**Legacy spec** (dbt Core 1.6-1.11):
- Add measures for quantitative values that will be aggregated
- Use `expr: 1` with `agg: sum` to count records
- Measures serve as the foundation for all metric types
- Organize components consistently: **entities -> dimensions -> measures**

**Latest spec** (dbt Core 1.12+ / Fusion):
- Declare simple metrics directly on the model for quantitative aggregations
- Use `expr: 1` with `agg: count` or `agg: sum` to count records
- Simple metrics serve as the foundation for advanced metric types
- Organize components consistently: **entities (on columns) -> dimensions (on columns) -> simple metrics**

## Metric Design

### Required Properties
Each metric requires: `name`, `description`, `label`, and `type`

### Type Progression
1. **Simple** - Single aggregation with optional filters (begin here)
2. **Ratio** - Numerator divided by denominator
3. **Derived** - Calculations that combine multiple metrics
4. **Cumulative** - Running totals or windowed aggregations

### Naming
- Choose clear, business-friendly labels for downstream tools
- Separate ambiguous dimensions with double underscores (`orders__location`)

## Development Workflow

```bash
# Refresh manifest after changes
dbt parse

# List available dimensions for a metric
dbt sl list dimensions --metrics <metric_name>   # dbt Cloud CLI / Fusion CLI when using the dbt platform
mf list dimensions --metrics <metric_name>       # MetricFlow CLI

# Test metric queries
dbt sl query --metrics <metric_name> --group-by <dimension>
mf query --metrics <metric_name> --group-by <dimension>
```

## What to Avoid

| Anti-pattern | Better approach |
|--------------|-----------------|
| Building full semantic models on dimension-only tables | Pure dimensional tables only need a primary entity defined |
| Refactoring production code directly | Build in parallel, deprecate gradually |
| Pre-computing rollups in dbt models | Define calculations in metrics |
| Creating multiple time dimension buckets | Set minimum granularity, let MetricFlow handle the rest |
| Mixing legacy and latest spec syntax in the same project | Pick one spec and use it consistently |

## When to Use Marts

Use intermediate marts selectively for:
- Clustering related tables together
- Connecting metrics to dimensional tables
- Complex joins that gain from materialization

Build semantic models directly on staging when source data arrives already well-structured.
