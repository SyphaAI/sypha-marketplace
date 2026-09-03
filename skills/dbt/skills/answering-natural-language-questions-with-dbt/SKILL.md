---
name: answering-natural-language-questions-with-dbt
description: Generates and runs SQL queries against the data warehouse via dbt's Semantic Layer or ad-hoc SQL to respond to business questions. Trigger when a user asks about analytics, metrics, KPIs, or data (e.g., "What were total sales last quarter?", "Show me top customers by revenue"). NOT for validating, testing, or building dbt models during development.
user-invocable: false
metadata:
  author: dbt-labs
---

# Answering Natural Language Questions with dbt

## Overview

Respond to data questions by applying the best available method: start with the semantic layer, then fall back to SQL modification, then model discovery, and finally manifest analysis. Always try every option before concluding that a question "cannot be answered."

**Use for:** Business questions from users that require data-driven answers
- "What were total sales last month?"
- "How many active customers do we have?"
- "Show me revenue by region"

**Not for:**
- Validating model logic during development
- Testing dbt models or semantic layer definitions
- Building or modifying dbt models
- `dbt run`, `dbt test`, or `dbt build` workflows

## Decision Flow

```mermaid
flowchart TD
    start([Business question received])
    check_sl{Semantic layer tools available?}
    list_metrics[list_metrics]
    metric_exists{Relevant metric exists?}
    get_dims[get_dimensions]
    sl_sufficient{SL can answer directly?}
    query_metrics[query_metrics]
    answer([Return answer])
    try_compiled[get_metrics_compiled_sql<br/>Modify SQL, execute_sql]
    check_discovery{Model discovery tools available?}
    try_discovery[get_mart_models<br/>get_model_details<br/>Write SQL, execute]
    check_manifest{In dbt project?}
    try_manifest[Analyze manifest/catalog<br/>Write SQL]
    cannot([Cannot answer])
    suggest{In dbt project?}
    improvements[Suggest semantic layer changes]
    done([Done])

    start --> check_sl
    check_sl -->|yes| list_metrics
    check_sl -->|no| check_discovery
    list_metrics --> metric_exists
    metric_exists -->|yes| get_dims
    metric_exists -->|no| check_discovery
    get_dims --> sl_sufficient
    sl_sufficient -->|yes| query_metrics
    sl_sufficient -->|no| try_compiled
    query_metrics --> answer
    try_compiled -->|success| answer
    try_compiled -->|fail| check_discovery
    check_discovery -->|yes| try_discovery
    check_discovery -->|no| check_manifest
    try_discovery -->|success| answer
    try_discovery -->|fail| check_manifest
    check_manifest -->|yes| try_manifest
    check_manifest -->|no| cannot
    try_manifest -->|SQL ready| answer
    answer --> suggest
    cannot --> done
    suggest -->|yes| improvements
    suggest -->|no| done
    improvements --> done
```

## Quick Reference

| Priority | Condition | Approach | Tools |
|----------|-----------|----------|-------|
| 1 | Semantic layer active | Query metrics directly | `list_metrics`, `get_dimensions`, `query_metrics` |
| 2 | SL active but minor modifications needed (missing dimension, custom filter, case when, different aggregation) | Modify compiled SQL | `get_metrics_compiled_sql`, then `execute_sql` |
| 3 | No SL, discovery tools active | Explore models, write SQL | `get_mart_models`, `get_model_details`, then `show`/`execute_sql` |
| 4 | No MCP, in dbt project | Analyze artifacts, write SQL | Read `target/manifest.json`, `target/catalog.json` |

## Approach 1: Semantic Layer Query

When `list_metrics` and `query_metrics` are available:

1. `list_metrics` - locate the relevant metric
2. `get_dimensions` - confirm the required dimensions are present
3. `query_metrics` - run with the appropriate filters

If the semantic layer cannot answer directly (missing dimension, custom logic required) → proceed to Approach 2.

## Approach 2: Modified Compiled SQL

When the semantic layer has the metric but minor adjustments are needed:

- Missing dimension (join + group by)
- Custom filter not available as a dimension
- Case when logic for custom categorization
- Different aggregation than what is defined

1. `get_metrics_compiled_sql` - retrieve the SQL that would execute (returns raw SQL, not Jinja)
2. Modify the SQL to incorporate what is needed
3. `execute_sql` to run the raw SQL
4. **Always suggest** updating the semantic model when the modification would be broadly reusable

```sql
-- Example: Adding sales_rep dimension
WITH base AS (
    -- ... compiled metric logic (already resolved to table names) ...
)
SELECT base.*, reps.sales_rep_name
FROM base
JOIN analytics.dim_sales_reps reps ON base.rep_id = reps.id
GROUP BY ...

-- Example: Custom filter
SELECT * FROM (compiled_metric_sql) WHERE region = 'EMEA'

-- Example: Case when categorization
SELECT
    CASE WHEN amount > 1000 THEN 'large' ELSE 'small' END as deal_size,
    SUM(amount)
FROM (compiled_metric_sql)
GROUP BY 1
```

**Note:** The compiled SQL uses resolved table names, not `{{ ref() }}`. Use the raw SQL exactly as returned.

## Approach 3: Model Discovery

When no semantic layer is present but `get_all_models`/`get_model_details` are available:

1. `get_mart_models` - begin with marts, not staging
2. `get_model_details` for relevant models - understand the schema
3. Write SQL using `{{ ref('model_name') }}`
4. `show --inline "..."` or `execute_sql`

**Prefer marts over staging** - marts already have business logic applied.

## Approach 4: Manifest/Catalog Analysis

When inside a dbt project but without an MCP server:

1. Check for `target/manifest.json` and `target/catalog.json`
2. **Filter before reading** - these files can be large

```bash
# Find mart models in manifest
jq '.nodes | to_entries | map(select(.key | startswith("model.") and contains("mart"))) | .[].value | {name: .name, schema: .schema, columns: .columns}' target/manifest.json

# Get column info from catalog
jq '.nodes["model.project_name.model_name"].columns' target/catalog.json
```

3. Compose SQL based on the discovered schema
4. Clarify: "This SQL is ready to run in your warehouse. Execution requires direct database access, which is not available here."

## Suggesting Improvements

**When inside a dbt project**, propose semantic layer changes after delivering an answer (or when unable to answer):

| Gap | Suggestion |
|-----|------------|
| Metric doesn't exist | "Add a metric definition to your semantic model" |
| Dimension missing | "Add `dimension_name` to the dimensions list in the semantic model" |
| No semantic layer | "Consider adding a semantic layer for this data" |

**Operate at the semantic layer level.** Do NOT suggest:
- Database schema changes
- ETL pipeline modifications
- "Ask your data engineering team to..."

## Rationalizations to Resist

| You're Thinking... | Reality |
|--------------------|---------|
| "Semantic layer doesn't support this exact query" | Get compiled SQL and modify it (Approach 2) |
| "No MCP tools, can't help" | Check for manifest/catalog locally |
| "User needs this quickly, skip the systematic check" | Systematic approach IS the fastest path |
| "Just write SQL, it's faster" | Semantic layer exists for a reason - use it first |
| "The dimension doesn't exist in the data" | Maybe it exists but not in semantic layer config |

## Red Flags - STOP

- Writing SQL before verifying whether the semantic layer can answer
- Saying "cannot answer" without attempting all 4 approaches
- Recommending database-level fixes for semantic layer gaps
- Reading the entire manifest.json without filtering
- Using staging models when mart models are available
- Using this skill to validate model correctness instead of answering business questions

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Giving up when SL can't answer directly | Get compiled SQL and modify it |
| Querying staging models | Use `get_mart_models` first |
| Reading full manifest.json | Use jq to filter |
| Suggesting ETL changes | Keep suggestions at semantic layer |
| Not checking tool availability | List available tools before choosing approach |
