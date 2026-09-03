# Evaluating Impact of a dbt Model Change

Evaluate downstream dependencies before modifying a dbt model. Establishes the scope of impact and recommends suitable build selectors.

## When to Use

- Before changing SQL logic in an existing model
- Before renaming, removing, or changing column types
- Before changing model materialization

**Not for:** Newly created models (they have no downstream dependencies yet)

## Workflow

```mermaid
flowchart TD
    A[Identify model to change] --> B{MCP tools available?}
    B -->|yes| C[Use get_model_lineage_dev]
    B -->|no| D[Use dbt ls --select model+]
    C --> E[Assess impact scope]
    D --> E
    E --> F{Column-level change?}
    F -->|yes| G[Check column lineage]
    F -->|no| H[Classify impact]
    G --> H
    H --> I{High impact?}
    I -->|yes| J[Ask user: limit depth?]
    I -->|no| K[Recommend build command]
    J --> K
```

## Getting Downstream Dependencies

### If dbt MCP Server Available

Look for these tools first — they provide richer lineage data:

| Tool | Use For |
|------|---------|
| `get_model_lineage_dev` | Model-level downstream dependencies |
| `get_column_lineage` | Which downstream models reference specific columns |

### CLI Fallback (Less data but always available)

**List all downstream models:**
```bash
dbt ls --select model_name+ --output name
```

**Count downstream models:**
```bash
dbt ls --select model_name+ --output name | wc -l
```

**View as JSON with details:**
```bash
dbt ls --select model_name+ --output json
```

## Column-Level Impact

When modifying or removing a column, determine which downstream models reference it:

```bash
# Search for column references in downstream model SQL files
# First get the list of downstream models
dbt ls --select model_name+ --output name > /tmp/downstream.txt

# Then search for column usage in those model files
grep -r "column_name" models/ --include="*.sql" | grep -f /tmp/downstream.txt
```

With MCP tools available, use `get_column_lineage` for precise column-level tracking.

## Impact Classification

| Level | Criteria | Action |
|-------|----------|--------|
| **Low** | 1-5 downstream models | Proceed with `state:modified+` |
| **Medium** | 6-15 downstream models | Consider limiting depth |
| **High** | 16+ downstream models | Ask user about depth limit |

## Recommending Build Commands

**Standard (all downstream):**
```bash
dbt build --select state:modified+
```

**Limited depth (user choice):**
```bash
# Only 1 level downstream
dbt build --select state:modified+1

# Only 2 levels downstream
dbt build --select state:modified+2

# Only 3 levels downstream
dbt build --select state:modified+3
```

When impact is high, prompt the user:

> "This change affects N downstream models. Would you like to:
> 1. Build all downstream models with `state:modified+`
> 2. Restrict to a specific depth (e.g., `state:modified+2` for 2 levels)?"

## Quick Reference

| Task | Command |
|------|---------|
| List downstream | `dbt ls --select model_name+` |
| Count downstream | `dbt ls --select model_name+ --output name \| wc -l` |
| Build all affected | `dbt build --select state:modified+` |
| Build limited depth | `dbt build --select state:modified+N` |
| Find column refs | `grep -r "col" models/ --include="*.sql"` |

## Common Mistakes

**Skipping the pre-change assessment** - Always perform an impact assessment first, even for seemingly minor changes.

**Overlooking column-level impact** - Deleting a column breaks any downstream model that references it. Audit column usage, not just model-level dependencies.

**Running an unbounded build** - Use `--select` to constrain scope. Never execute `dbt build` without selectors on large projects.
