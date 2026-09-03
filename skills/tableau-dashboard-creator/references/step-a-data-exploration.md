# Step A: Data Exploration

**Identity**: You are a senior data engineer. Your objective is to gain a thorough understanding of the available data so the dashboard can be planned with confidence.

## Data Source Detection

Before executing any queries, check for local data files:

## Entry Requirements

Before Step A begins, confirm:
- the user has either `sample-data/*.csv` files or a populated `QUERIES.md`
- `.env` is present if the database path will be used
- when both local CSVs and DB inputs exist, the user is explicitly informed which source was selected and why

Default to the local CSV path only when the project is clearly a demo or follows a CSV-first workflow. If `QUERIES.md` contains real queries or `.env` is present, do not silently fall back to `sample-data/`.

### Priority 1: Local Files (`sample-data/` directory)

If the project root contains a `sample-data/` directory with data files:

1. **Scan the directory** for supported file types: `.csv`
2. **Load each file** using pandas:
   - CSV: `pd.read_csv(path)`
3. **Analyze** each file as though it were a query result (see Analysis section below)
4. **Skip database queries entirely** — `.env` and `QUERIES.md` are not required in this path

When local files are used, record in DS-ARCHITECTURE.md that the datasource is a local file (including its filename) rather than a database query.

### Priority 2: Database Queries (`QUERIES.md`)

If no `sample-data/` directory exists (or it is empty), or the user has clearly opted for the DB path, read `QUERIES.md` and run the queries:

1. **Parse QUERIES.md** — queries are organized under headings that identify the database type:
   - `## PostgreSQL` → use the installed skill's `scripts/query_postgresql.py`
   - Other database types → add a corresponding `query_<dbtype>.py` script to the installed skill's `scripts/` directory following the PostgreSQL pattern
   - Under each database heading, treat each fenced SQL block as a distinct query artifact
   - Name query outputs deterministically based on execution order, e.g., `query_01_orders.csv`, `query_02_targets.csv`

2. **Execute each query** using the matching script:

```bash
# PostgreSQL example from the installed skill path
python "<SKILL_PATH>/scripts/query_postgresql.py" "SELECT * FROM public.table" --output "<project-root>/step-a-query-results/query_01"
```

The PostgreSQL helper accepts a single read-only `SELECT`, `WITH`, or plain `EXPLAIN` query. It operates within a read-only database session and enforces a hard 500-row outer limit, even when the query already includes a larger or nested `LIMIT`. Multi-statement SQL, DDL/DML, `COPY`, `CALL`, `DO`, `EXPLAIN ANALYZE`, `SELECT INTO`, and row-locking clauses are all rejected.

## Analysis

For each datasource (local file or query result), examine:

- Column names, data types, and cardinality
- Sample values and value distributions
- Null rates and data quality observations
- Date/time columns, dimensions, and measures
- Relationships between datasources (shared keys)

## Create DS-ARCHITECTURE.md

Use the template below:

```markdown
# Data Source Architecture

## Overview
[Brief summary of the datasources and how they relate to the dashboard request]

---

## Datasource 1: [Table/View Name or File Name]

**Source**: `[SQL query used]` or `[sample-data/filename.csv]`
**Rows sampled**: [N]
**Description**: [What this datasource represents]

### Fields

| Field | Type | Description | Sample Values | Notes |
|-------|------|-------------|---------------|-------|
| field_name | STRING | [What this field represents] | val1, val2, val3 | [Nullable/unique/FK] |
| ... | ... | ... | ... | ... |

### Observations
- [Key patterns noticed in the data]
- [Data quality notes]
- [Potential join keys or relationships]

---

## Datasource 2: [Table/View Name or File Name]
[Same structure as above]

---

## Data Model: Joins vs Relationships

Tableau distinguishes between **Joins** and **Relationships** at the data-model level:

| Approach | When to Use | Example |
|----------|-------------|---------|
| **Join** | Tables share the same granularity (e.g., both are at User ID level) | `orders` JOIN `order_details` on `order_id` |
| **Relationship** | Tables have different granularity (e.g., opportunities vs account-level targets) | `opportunities` related to `ae_targets` via `account_executive_id` |

**Why it matters**: Joining tables at mismatched granularity causes row duplication (the "table explosion" problem — for example, joining 100 opportunities to 5 AE targets yields 500 rows). Relationships allow Tableau to query each table independently and merge results only when necessary, preserving correct aggregation.

### Connections
[For each pair of related datasources, specify:]
- **Tables**: [Table A] ↔ [Table B]
- **Type**: Join / Relationship
- **Key**: [shared field(s)]
- **Granularity**: [Table A granularity] vs [Table B granularity]
- **Rationale**: [Why join vs relationship was chosen]

## Data Quality Notes
[Any concerns: nulls, duplicates, unexpected values, type mismatches]
```

## Guidelines

- Write field descriptions in language a data analyst (not an engineer) can follow
- Flag fields that appear suitable as dimensions versus measures
- If a query fails, document the error and propose fixes
- If the data looks sparse or suspicious, record observations accordingly
- When working with local files, note any relevant CSV parsing considerations (encoding, delimiters, quoting)
- Select **Join** when tables share the same granularity; use **Relationship** when granularities differ to prevent row duplication
- Never suggest that the user should run query scripts manually — the agent executes the installed skill's scripts
- When both CSV and DB inputs are present, add a concise source-selection note near the top of `DS-ARCHITECTURE.md`
- Store each SQL query result as a separate artifact so later steps can trace datasource lineage clearly
- If `sample-data/` is bypassed because DB intent is clear, state that explicitly
- If fallback sample files are used instead of a partially configured DB path, state that explicitly
- Approval criteria:
  - every datasource has a clear source and description
  - field descriptions are written for analysts, not engineers
  - likely join keys or relationships are identified
  - source-selection reasoning is visible when both CSV and DB inputs are present
- Present DS-ARCHITECTURE.md to the user and **wait for approval** before proceeding to Step B
