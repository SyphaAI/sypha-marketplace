---
name: tableau-dashboard-creator
description: >-
  Walks data analysts through a structured Tableau dashboard creation workflow
  covering brand setup, data exploration, dashboard planning, interactive HTML mock
  creation, Tableau implementation spec, and experimental TWB workbook
  generation. Use when the user wants to create a Tableau dashboard, build a
  dashboard mock, plan KPIs and charts, or generate a Tableau implementation
  document.
metadata:
  category: data
  source:
    repository: 'https://github.com/laviDrori0702/tableau-dashboard-creator-skill'
    path: skill/tableau-dashboard-creator
    license_path: LICENSE
    commit: 620c4ef53c8557346532ebf9984f18300fed2e79
---

# Tableau Dashboard Creator

A structured multi-step workflow that converts a plain-language dashboard request into a fully implementable Tableau specification, complete with an interactive HTML mock and an optionally generated workbook.

## Prerequisites

At the outset, scan the user's project root for:

```
Checklist (all paths are inside the project directory the skill is executed in, except `.env` — see note below):
- [ ] QUERIES.md — SQL queries grouped under database type headings (e.g., PostgreSQL)
      OR sample-data/ directory with CSV files
- [ ] <DASHBOARD-NAME>-PRD.md — Human-language dashboard request
- [ ] .env — Database credentials (skip if using sample-data/). Does **not** need to live
      inside the project directory — `load_dotenv()` walks upward from the current
      working directory and picks up the closest `.env` it finds, so the user can keep
      credentials in a parent directory and avoid copying secrets into the project.
      Required variables (PostgreSQL): `PG_HOST`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD`,
      and optionally `PG_PORT` (defaults to `5432`).
- [ ] branding/ directory (required) containing ONE of:
      - branding.md — brand spec (palette, fonts, padding, sizing)
      - template.twb — Organization's Tableau template workbook
      Optionally, a logo (.svg or .jpg) can be added to branding/ in either case.
```

**If any of these are absent, immediately run Project Scaffolding (below) before taking any other action.** Do NOT prompt the user to supply files manually — scaffold first and let them customize afterward.

> **Check only for the files listed above.** Do NOT look for `design-tokens.md`, `DS-ARCHITECTURE.md`, `DASHBOARD-PLAN.md`, or anything inside `mock-version/` — those are **outputs** produced by the workflow steps, not inputs supplied by the user.

### QUERIES.md Format

Queries must be grouped under a heading matching the database type:

```markdown
## PostgreSQL
SELECT * FROM public.table2
```

The agent picks the appropriate query script by matching the heading.

> **Adding other databases**: The skill comes with PostgreSQL support out of the box. To support additional databases (Databricks, Snowflake, MySQL, BigQuery, etc.), create a corresponding `query_<dbtype>.py` script in the installed skill's `scripts/` directory that mirrors the pattern in `query_postgresql.py`, add the matching heading to `QUERIES.md`, and update `references/step-a-data-exploration.md`.

### Required Python packages

```
# PostgreSQL
psycopg2-binary, python-dotenv, pandas
```

## Workflow Overview

```
[Scaffolding] ──[user approval]──> Step 0: Brand Setup
Step 0: Brand Setup ──[user approval]──> Step A: Data Exploration
Step A: Data Exploration ──[user approval]──> Step B: Dashboard Planning
Step B: Dashboard Planning ──[user approval]──> Step C: HTML Mock
Step C: HTML Mock ──[user approval]──> Step D: Implementation Spec
Step D: Implementation Spec ──[user approval]──> Step E: TWB Generation (Experimental)
```

**Do NOT skip any step. Always wait for explicit user approval before advancing to the next one.**

## Project Scaffolding

**When to run**: Triggered automatically whenever the prerequisites check identifies missing files. Skip scaffolding only when every prerequisite file is already in place.

**Process**:

1. **Request the user's permission** before scaffolding their project directory
2. **Read each file from `skeleton/`** in the skill directory and **write its contents** into the user's project root, preserving the directory structure. This produces:
   - `sample-data/` — starter CSV files (sales orders, customer segments, monthly targets) for immediate testing
   - `.env.example` — database credentials template (rename to `.env` when ready)
   - `EXAMPLE-PRD.md` — blank PRD template with section headers and placeholder examples
   - `QUERIES.md` — SQL query template with database type headings
   - `branding/branding.md` — branding spec template with section headers and placeholder values
   - `SalesPerformance-PRD.md` — a partially populated Sales Performance PRD for reference
3. **List every file created** and briefly describe what the user should populate or adjust
4. **State the scaffold status clearly**:
   - `sample-data/` means the project can run immediately in demo mode
   - database mode is not ready until the user populates `.env` and `QUERIES.md`
   - branding mode is not ready until the user completes `branding/branding.md` and optionally adds a logo or icons
5. **Direct the user** to the `demo/` directory in the skill repository, which contains a fully worked example with every step already generated
6. **If both `sample-data/` and a real database setup are present**, tell the user explicitly which data source Step A will use and the reason why before continuing
7. **Pause and wait** for the user to confirm they have reviewed and customized the files, then continue to Step 0

> **Important**: Do NOT use shell `cp` commands — the skeleton directory lives inside the skill installation, not the user's project. Use the Read tool to read each skeleton file and the Write tool to place it in the user's project root.

> **Every step is iterative.** The agent will not produce a perfect result on the first attempt — that is expected and intentional. Ask the user to review each artifact carefully, request revisions, and iterate until they are satisfied. This is particularly true for Step C (HTML mock) and Step E (TWB generation). For Step C, encourage the user to share the mock with stakeholders before approving it — a thoroughly reviewed mock avoids expensive rework later in the workflow.

## Step 0: Brand Setup

**Identity**: Tableau design systems engineer.

Read [references/step-0-brand-setup.md](references/step-0-brand-setup.md) for detailed instructions.

Summary:
1. **Begin by asking the user for the minimum target Tableau Desktop version** (`2024.2 – 2025.x` default, or `2026.1+`). Record the response in `design-tokens.md` — it governs the XML emitted in Step E.
2. Identify the branding source inside `branding/`: either `branding.md` or `template.twb`
3. Pull design tokens from `branding.md` (or parse them from the `.twb` XML), along with the optional logo if one is present
4. Wherever fallback defaults are substituted for missing brand decisions, document each fallback explicitly in `design-tokens.md`
5. Write `design-tokens.md` to the project root
6. Show `design-tokens.md` to the user and request their approval

## Step A: Data Exploration

**Identity**: Senior Data Engineer.

Read [references/step-a-data-exploration.md](references/step-a-data-exploration.md) for detailed instructions.

Summary:
1. **Prioritize local data**: If a `sample-data/` directory exists with CSV files and the user has not clearly indicated database intent, read those files directly
2. **If `QUERIES.md` or `.env` clearly points to a database**, state which source you are using and explain why before continuing
3. **When taking the database path**, read `QUERIES.md`, determine the database type from the headings, and run each query through the matching script from the installed skill:
   - PostgreSQL: execute the installed skill's `scripts/query_postgresql.py`; it allows a single read-only `SELECT`, `WITH`, or bare `EXPLAIN` query and applies a hard 500-row cap
   - Other databases: create a `query_<dbtype>.py` script that follows the same read-only-by-default pattern
4. Examine the schema and sample data
5. Produce `DS-ARCHITECTURE.md` containing datasource and field descriptions
6. Present `DS-ARCHITECTURE.md` to the user and request their approval

## Step B: Dashboard Planning

**Identity**: Senior Data Analyst specialized in informative graphs and dashboards.

Read [references/step-b-dashboard-planning.md](references/step-b-dashboard-planning.md) for detailed instructions.

Summary:
1. Read the PRD file, `DS-ARCHITECTURE.md`, and `design-tokens.md`
2. Derive KPIs and chart types from the user's request
3. Tie each visualization to specific columns identified in `DS-ARCHITECTURE.md`
4. Assign stable IDs to KPIs, charts, filters, and actions so subsequent steps can reference the same identifiers consistently
5. Recommend additional KPIs and highlight noteworthy data patterns
6. Propose a filter strategy and define dashboard actions
7. Present the dashboard plan to the user along with approval criteria before proceeding to Step C

## Step C: HTML Mock Creation

**Identity**: Tableau Developer.

Read [references/step-c-mock-creation.md](references/step-c-mock-creation.md) for detailed instructions.

Summary:
1. Read `design-tokens.md` (produced in Step 0)
2. Choose an appropriate template layout based on the design tokens
3. Ask the user for their target screen size: **Standard Laptop** (1100×800) for portable devices, **Home Screen** (2100×1000) for wide external displays, or **Custom** dimensions. Falls back to Standard Laptop if the user skips this choice.
4. Build an interactive HTML mock using Chart.js and sample data, with the selected screen dimensions as the dashboard frame
5. Save the output to `mock-version/v_N/mock.html`
6. Guard against empty-space-heavy, cramped, or out-of-bounds chart layouts by enforcing explicit slot sizes and ensuring charts occupy a readable area
7. Present the mock to the user and request approval
8. If the user approves, update `DASHBOARD-PLAN.md` and `design-tokens.md` wherever the mock deviated from them

## Step D: Tableau Implementation Spec

Read [references/step-d-implementation-spec.md](references/step-d-implementation-spec.md) for detailed instructions.

Summary:
1. Convert the approved HTML mock into a technical Tableau implementation specification
2. Record the container hierarchy, sheets, calculated fields, parameters, and stable IDs using a strict markdown schema
3. Save the document to `mock-version/v_N/TABLEAU-IMPLEMENTATION.md`
4. Provide enough structured detail that Step E can consume the spec without making assumptions
5. If the user approves, update `DASHBOARD-PLAN.md` wherever the implementation spec diverged from it

## Step E: TWB Workbook Generation (Experimental)

**Scaffold build string**: `2025.1.10 (20251.25.1121.1650)` — all snippets are authored against this build. The `version` attribute of the emitted workbook and the inclusion of `<explain-data>` are determined by the **Target Tableau Version** recorded in Step 0. See `references/step-e-twb-generation.md § Tableau Version Targeting`.

Read [references/step-e-twb-generation.md](references/step-e-twb-generation.md) for detailed instructions.

**Snippet library**: The `references/snippets/` directory holds validated `.twb` files organized by domain. Each domain is accompanied by a `.md` file that explains the XML patterns involved. **Read the relevant snippet files and their companion docs before producing any XML** — build from validated patterns rather than generating XML from scratch.

Summary:
1. Read the approved TABLEAU-IMPLEMENTATION.md and design-tokens.md
2. Read `DS-ARCHITECTURE.md` for field names and data types
3. **Choose snippet patterns** based on what the dashboard requires:
   - Data model: `snippets/data-model/` → single CSV, relationship, or join
   - Chart types: `snippets/worksheets/` → bar, line, text-table, area, pie, scatter, dual-axis, map
   - Styling: `snippets/worksheets/bar-chart-styled.twb` → fonts, colors, axis titles
   - Filters: `snippets/worksheets/bar-chart-filtered.twb` → categorical, date range, context
   - Sorting: `snippets/worksheets/bar-chart-sorted.twb` → computed sort
   - Tooltips: `snippets/worksheets/custom-tooltip.twb` → formatted tooltip template
   - Dashboard layout: `snippets/dashboard/` → single/multi-sheet, nested containers
   - Actions: `snippets/dashboard/` → filter, highlight, parameter actions
   - Features: `snippets/features/` → calculated fields, parameters, LOD expressions, Dynamic Zone Visibility
4. **Assemble the `.twb`** using the scaffold skeleton (`snippets/scaffold/workbook-skeleton.twb`) as the base, inserting parameterized snippet patterns in the required element order
5. **Output as a live connection** — do NOT include `<extract>` sections
6. Package as `.twbx` (a ZIP archive containing the `.twb` plus all CSV data files)
7. Write both `dashboard.twb` and `dashboard.twbx` to `mock-version/v_N/`
8. Tell the user to open **`dashboard.twbx`** in Tableau Desktop and use **Data → Replace Data Source** to switch to live data

### Handling Unknown Features

If the user requests a Tableau feature for which no validated snippet exists in `references/snippets/`, **ask the user** to choose an approach:

1. **Provide a reference `.twb`** — the user constructs a minimal example in Tableau Desktop that demonstrates only that feature, supplies the path, and the agent extracts the XML pattern from it
2. **Attempt from `examples/`** — the agent scans the `examples/` directory for a comparable pattern in the existing complex workbooks, adapts it, and marks it as ⚠️ UNVALIDATED
3. **Skip and document** — the agent produces everything else correctly and writes a `MANUAL_STEPS.md` that lists what the user must add manually in Tableau Desktop

## Version Management

- All mock and implementation files are stored under `mock-version/v_N/` (e.g., `mock-version/v_1/`)
- Each version is a **complete, self-contained copy** (mock.html + TABLEAU-IMPLEMENTATION.md + dashboard.twb + dashboard.twbx)
- When the user requests revisions following Step D or E, increment the version number. Revisions to Step C overwrite the current mock in place within the same `v_N` directory.
- `DS-ARCHITECTURE.md`, `DASHBOARD-PLAN.md`, and `design-tokens.md` reside at the project root and always reflect the **latest approved global state**
- Each versioned artifact should record which approved root-level files and mock version it was built from

## File Structure (per project)

```
project-root/
├── QUERIES.md                      (user input — with DB type headings)
├── <DASHBOARD-NAME>-PRD.md         (user input)
├── .env                            (user input — DB credentials)
├── branding/                       (user input — required; contains brand source)
│   ├── branding.md                 (option A: brand spec)
│   ├── template.twb                (option B: org Tableau template)
│   ├── logo.svg / logo.jpg         (optional, either case)
│   └── icons/                      (optional)
├── sample-data/                    (user input — optional, skip DB queries)
│   └── *.csv
├── design-tokens.md                (generated - step 0)
├── DS-ARCHITECTURE.md              (generated - step A)
├── DASHBOARD-PLAN.md               (generated - step B)
└── mock-version/
    ├── v_1/
    │   ├── mock.html               (generated - step C)
    │   ├── TABLEAU-IMPLEMENTATION.md (generated - step D)
    │   ├── dashboard.twb           (generated - step E, raw XML)
    │   └── dashboard.twbx          (generated - step E, packaged with data)
    └── v_2/
        ├── mock.html
        ├── TABLEAU-IMPLEMENTATION.md
        ├── dashboard.twb
        └── dashboard.twbx
```
