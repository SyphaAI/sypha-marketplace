# Discovering Data with dbt show

Use `dbt show` to interactively examine raw data, grasp table structures, and capture findings for use in downstream model development.

## When to Use

- Onboarding to a new dbt project with unfamiliar source data
- Investigating data quality issues reported by stakeholders
- Planning new models and need to understand source grain/structure
- Mapping relationships between tables before building joins

## The Iron Rule

**Complete all 6 steps for every table you will build models on.**

## Rationalizations That Mean STOP

| You're Thinking... | Reality |
|-------------------|---------|
| "I don't have time for full discovery" | You don't have time for incorrect models. |
| "It's just a quick stakeholder briefing" | Quick briefings turn into "can you build a model from this?" Full discovery is required before building anything. |
| "I'll do proper discovery later" | You won't. Document now or leave technical debt for someone else to inherit. |
| "This is technical debt I'm accepting" | You're not the one accepting it — you're handing it to your future self or teammates. |
| "47 tables is too many for full methodology" | Then narrow down to the tables you'll actually use and run full discovery on those. Don't do partial discovery across the board. |
| "I'll just do the critical tables thoroughly" | Every table you build on is critical. If it's not worth full discovery, don't model it yet. |
| "Standard patterns, I know this data" | You know the pattern. The actual data in this instance may differ. Verify it. |

## Red Flags - You're About to Skip Steps

Pause if you notice yourself:
- Running only `SELECT *` without analyzing grain
- Claiming "the join worked" without verifying orphan counts
- Recording "some nulls" without measuring null rates
- Intending to "document later"
- Feeling time pressure and taking shortcuts
- Using a large table count as justification for less thoroughness

**All of these are signals to slow down and follow all 6 steps.**

## Large Scope Strategy

When faced with many tables (20+), the answer is NOT abbreviated discovery. The answer is:

1. **Scope ruthlessly first** - Determine which tables you will actually model. Only those require discovery right now.
2. **Full methodology on scoped tables** - Every in-scope table gets all 6 steps. No exceptions.
3. **Explicit deferral for out-of-scope** - Document which tables you are NOT discovering and the reason. "Not needed for the current project" is acceptable. "Too many tables" is not.

**Wrong approach:** "I'll do light discovery across all 47 tables"
**Right approach:** "I'll do full discovery on the 8 tables this project actually needs"

## Core Method: Iterative Discovery

### Step 1: Inventory relevant objects

#### Sources

When exploring new raw data, list all tables from the new source. For example, to list all `ecom` source tables:

```bash
# quoting is critical when selecting sources
dbt ls --select "source:ecom.*" --output json
```

Review the existing YAML file at `original_file_path` to see what is already documented.

#### Models

When inspecting existing models, use standard node selection syntax:

```bash
# quoting is critical when selecting multiple nodes
dbt ls --select "my_first_model my_second_model" --output json
```

Review existing YAML files (typically colocated with the model's `original_file_path`) to see what is already documented.

### Step 2: Sample Raw Data

Pull a sample of rows from each source table:

```bash
dbt show --inline "SELECT * FROM {{ source('source_name', 'table_name') }}" --limit 50 --output json
```

**Record immediately:**

- Column names and warehouse-native data types
- Which columns appear to be identifiers versus attributes
- Obvious nulls, low-cardinality values, and values whose meaning is not clear from their column name

### Run standard EDA

Continue using `dbt show` to execute standard exploratory data analysis queries such as:

- Determining the grain of the table
- Checking for duplicate or null primary keys
- Confirming data ranges are sensible (e.g. event timestamps fall in the past)
- Profiling key columns
- Identifying potential foreign key relationships
- Spotting inconsistent data types within a column

## Documenting Findings

Produce a discovery report that other agents can consume. Store it in a `data_discovery.md` file alongside the SQL/YAML files. Do not include Jinja in these discovery files to prevent them from being mistaken for doc blocks.

### Discovery Report Template

```markdown
## Source: {source_name}.{table_name}

### Overview
- **Row count**: X
- **Grain**: One row per [entity] per [time period]
- **Primary key**: column_name (verified unique)

### Column Analysis
| Column | Type | Nulls | Notes |
|--------|------|-------|-------|
| id | integer | 0% | Primary key |
| status | string | 2% | Values: active, inactive, pending |
| created_at | timestamp | 0% | UTC timezone |

### Data Quality Issues
- [ ] `status` has 15 rows with value "unknown" - clarify with stakeholder
- [ ] `amount` has negative values - confirm if valid or error

### Relationships
- `user_id` → `users.id` (5 orphan records found)
- `product_id` → `products.id` (clean join)

### Recommended Staging Transformations
1. Filter out `status = 'unknown'` rows or map to valid value
2. Cast `created_at` to consistent timezone
3. Add surrogate key if natural key unreliable
```

## Previewing Data Efficiently

When using `dbt show --inline` to preview data, place `LIMIT` clauses as early as possible within CTEs to reduce data scanning. Never append a `LIMIT` at the end of the query — `dbt show` always appends its own limit, which would produce a syntax error.

```sql
-- ✅ GOOD: Limit pushed early, minimizes scanning
with orders as (
    select * from {{ source('ecom', 'orders') }} limit 100
),
customers as (
    select * from {{ source('ecom', 'customers') }} limit 100
)
select ... from orders join customers ...

-- ❌ BAD: Full table scan before limit applied
with orders as (
    select * from {{ source('ecom', 'orders') }}
),
customers as (
    select * from {{ source('ecom', 'customers') }}
)
select ... from orders join customers ...
limit 100  -- Too late, and redundant with --limit flag
```

## Common Mistakes

**Assuming column names reflect their content**. Always confirm with sample data; `customer_id` might actually hold account IDs.

**Skipping documentation of findings**. Discovery without written documentation wastes effort; record results right away.

**Validating relationships on sampled data only**. Orphan records may exist beyond your sample; run full counts to be certain.

**Overlooking soft deletes**. Look for `deleted_at`, `is_active`, or `status` columns that determine which records are valid.
