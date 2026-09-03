---
name: authoring-dags
description: >-
  Workflow and best practices for writing Apache Airflow DAGs. Use when the
  user wants to create a new DAG, author pipeline code, or asks about DAG
  patterns and conventions. For testing and debugging DAGs, see the
  testing-dags skill.
metadata:
  upstream:
    hooks:
      Stop:
        - hooks:
            - type: command
              command: echo 'Remember to test your DAG with the testing-dags skill'
  category: data
  source:
    repository: 'https://github.com/astronomer/agents'
    path: skills/authoring-dags
    license_path: LICENSE
    commit: e4ebf9a7ad3f8dbf3fcfda9c245a65eb1415967b
---

# DAG Authoring Skill

This skill guides you through writing and validating Airflow DAGs using best practices together with the `af` CLI.

> **For testing and debugging DAGs**, see the **testing-dags** skill, which describes the full test -> debug -> fix -> retest cycle.

---

## Running the CLI

The commands below assume `af` is available on PATH. It is included automatically when you run via `astro otto`, or you can install it separately with `uv tool install astro-airflow-mcp`.

---

## Workflow Overview

```
+-----------------------------------------+
| 1. DISCOVER                             |
|    Understand codebase & environment    |
+-----------------------------------------+
                 |
+-----------------------------------------+
| 2. PLAN                                 |
|    Propose structure, get approval      |
+-----------------------------------------+
                 |
+-----------------------------------------+
| 3. IMPLEMENT                            |
|    Write DAG following patterns         |
+-----------------------------------------+
                 |
+-----------------------------------------+
| 4. VALIDATE                             |
|    Check import errors, warnings        |
+-----------------------------------------+
                 |
+-----------------------------------------+
| 5. TEST (with user consent)             |
|    Trigger, monitor, check logs         |
+-----------------------------------------+
                 |
+-----------------------------------------+
| 6. ITERATE                              |
|    Fix issues, re-validate              |
+-----------------------------------------+
```

---

## Phase 1: Discover

Before writing any code, build an understanding of the context.

### Explore the Codebase

Use file tools to find existing patterns:
- `Glob` for `**/dags/**/*.py` to find the DAGs already present
- `Read` similar DAGs to pick up the conventions in use
- Check `requirements.txt` to see which packages are available

### Query the Airflow Environment

Use `af` CLI commands to discover what the environment provides:

| Command | Purpose |
|---------|---------|
| `af config connections` | External systems that are configured |
| `af config variables` | Configuration values that exist |
| `af config providers` | Operator packages that are installed |
| `af config version` | Feature and version constraints |
| `af dags list` | Existing DAGs and their naming style |
| `af config pools` | Concurrency resource pools |

**Example discovery questions:**
- "Is a Snowflake connection available?" -> `af config connections`
- "Which Airflow version is running?" -> `af config version`
- "Do we have S3 operators?" -> `af config providers`

---

## Phase 2: Plan

Based on your discovery findings, propose:

1. **DAG structure** - Tasks, dependencies, schedule
2. **Operators to use** - Selected from the providers that are available
3. **Connections needed** - Existing ones or ones to create
4. **Variables needed** - Existing ones or ones to create
5. **Packages needed** - New entries for requirements.txt

**Get the user's approval before implementing.**

---

## Phase 3: Implement

Write the DAG following the best practices below. Key steps:

1. Create the DAG file in the correct location
2. Add to `requirements.txt` if needed
3. Save the file

---

## Phase 4: Validate

**Use the `af` CLI as a feedback loop to validate the DAG.**

### Step 1: Check Import Errors

After saving, check for parse errors (Airflow parses the file automatically):

```bash
af dags errors
```

- If your file appears -> **fix and retry**
- If no errors -> **proceed**

Common causes: missing imports, syntax errors, missing packages.

### Step 2: Verify DAG Exists

```bash
af dags get <dag_id>
```

Confirm: DAG is present, schedule is correct, tags are applied, paused state.

### Step 3: Check Warnings

```bash
af dags warnings
```

Watch for deprecation warnings or configuration problems.

### Step 4: Explore DAG Structure

```bash
af dags explore <dag_id>
```

A single call that returns metadata, tasks, dependencies, and source code.

### On Astro

When working on Astro, you can additionally validate locally before deployment:

- **Parse check**: `astro dev parse` catches import errors and DAG-level problems without spinning up a complete Airflow environment
- **DAG-only deploy**: After validation, `astro deploy --dags` performs a fast DAG-only deploy that skips the Docker image build — well suited to iterating on DAG code

---

## Phase 5: Test

> Refer to the **testing-dags** skill for full testing guidance.

After validation succeeds, test the DAG following the **testing-dags** skill workflow:

1. **Get user consent** -- Always ask before triggering
2. **Trigger and wait** -- `af runs trigger-wait <dag_id> --timeout 300`
3. **Analyze results** -- Review success/failure status
4. **Debug if needed** -- `af runs diagnose <dag_id> <run_id>` and `af tasks logs <dag_id> <run_id> <task_id>`

### Quick Test (Minimal)

```bash
# Ask user first, then:
af runs trigger-wait <dag_id> --timeout 300
```

For the complete test -> debug -> fix -> retest cycle, see **testing-dags**.

---

## Phase 6: Iterate

When problems are found:
1. Fix the code
2. Look for import errors: `af dags errors`
3. Validate again (Phase 4)
4. Test again via the **testing-dags** skill workflow (Phase 5)

---

## CLI Quick Reference

| Phase | Command | Purpose |
|-------|---------|---------|
| Discover | `af config connections` | Connections available |
| Discover | `af config variables` | Configuration values |
| Discover | `af config providers` | Operators installed |
| Discover | `af config version` | Version information |
| Validate | `af dags errors` | Parse errors (check these first!) |
| Validate | `af dags get <dag_id>` | Confirm DAG configuration |
| Validate | `af dags warnings` | Configuration warnings |
| Validate | `af dags explore <dag_id>` | Complete DAG inspection |

> **Testing commands** -- The **testing-dags** skill covers `af runs trigger-wait`, `af runs diagnose`, `af tasks logs`, etc.

---

## Best Practices & Anti-Patterns

Code patterns and anti-patterns are documented in **[reference/best-practices.md](reference/best-practices.md)**.

**Consult this reference whenever you write new DAGs or review existing ones.** It explains which patterns are correct (including behavior specific to Airflow 3) and which to avoid.

---

## Related Skills

- **testing-dags**: For DAG testing, failure debugging, and the test -> fix -> retest cycle
- **debugging-dags**: For diagnosing failed DAGs
- **deploying-airflow**: For production DAG deployment (Astro or open-source)
- **migrating-airflow-2-to-3**: For moving DAGs to Airflow 3
