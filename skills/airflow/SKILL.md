---
name: airflow
description: >-
  Uses the af CLI to query, manage, and troubleshoot Apache Airflow. Handles
  listing DAGs, triggering runs, reading task logs, diagnosing failures,
  debugging DAG import errors, checking connections, variables, and pools, and
  monitoring health. Routes to sub-skills as well for writing DAGs, debugging,
  deploying, and migrating Airflow 2 to 3. Use when the user mentions
  "Airflow", "DAG", "DAG run", "task log", "import error", "parse error",
  "broken DAG", or requests to "trigger a pipeline", "debug import errors",
  "check Airflow health", "list connections", "retry a run", or any other
  Airflow operation. Do NOT use for warehouse/SQL analytics over Airflow
  metadata tables — analyzing-data covers that instead.
metadata:
  category: data
  source:
    repository: 'https://github.com/astronomer/agents'
    path: skills/airflow
    license_path: LICENSE
    commit: e4ebf9a7ad3f8dbf3fcfda9c245a65eb1415967b
---

# Airflow Operations

Query, manage, and troubleshoot Airflow workflows through `af` commands.

## Astro CLI

For running Airflow locally and deploying to production, the recommended tool is the [Astro CLI](https://www.astronomer.io/docs/astro/cli/overview). It supplies a containerized Airflow environment that works with no extra setup:

```bash
# Initialize a new project
astro dev init

# Start local Airflow (webserver at http://localhost:8080)
astro dev start

# Parse DAGs to catch errors quickly (no need to start Airflow)
astro dev parse

# Run pytest against your DAGs
astro dev pytest

# Deploy to production
astro deploy            # Full deploy (image + DAGs)
astro deploy --dags     # DAG-only deploy (fast, no image build)
```

For more details:
- **New project?** See the **setting-up-astro-project** skill
- **Local environment?** See the **managing-astro-local-env** skill
- **Deploying?** See the **deploying-airflow** skill

---

## Running the CLI

The commands below expect `af` to be available on PATH. It comes automatically when running via `astro otto`, or can be installed on its own with `uv tool install astro-airflow-mcp`.

## Instance Configuration

Use persistent configuration to manage multiple Airflow instances:

```bash
# Add a new instance
af instance add prod --url https://airflow.example.com --token "$API_TOKEN"
af instance add staging --url https://staging.example.com --username admin --password admin

# List and switch instances
af instance list      # Shows all instances in a table
af instance use prod  # Switch to prod instance
af instance current   # Show current instance
af instance delete old-instance

# Auto-discover instances (use --dry-run to preview first)
af instance discover --dry-run        # Preview all discoverable instances
af instance discover                  # Discover from all backends (astro, local)
af instance discover astro            # Discover Astro deployments only
af instance discover astro --all-workspaces  # Include all accessible workspaces
af instance discover local            # Scan common local Airflow ports
af instance discover local --scan     # Deep scan all ports 1024-65535

# IMPORTANT: Always run with --dry-run first and ask for user consent before
# running discover without it. The non-dry-run mode creates API tokens in
# Astro Cloud, which is a sensitive action that requires explicit approval.

# Show where an instance came from (file path + scope)
af instance show prod

# Override instance for a single command via env vars
AIRFLOW_API_URL=https://staging.example.com AIRFLOW_AUTH_TOKEN=$STG af dags list

# Or switch persistently
af instance use staging
```

Configuration layers (modeled on `git config` system/global/local):

| Scope | File | Committed? |
|---|---|---|
| Global | `~/.astro/config.yaml` | n/a (per-user) |
| Project shared | `<root>/.astro/config.yaml` | yes |
| Project local | `<root>/.astro/config.local.yaml` | no (gitignored) |

`<root>` is located by walking upward from cwd until `.astro/` is found. Within a project, writes are routed by default as: `add`/`discover` → project-shared, `use` → project-local. Use `--global` / `--project` / `--local` to override. Setting `AF_CONFIG=<path>` skips the layering entirely in favor of one file.

To move off the legacy `~/.af/config.yaml`, run `af migrate` (idempotent; the old file gets renamed to `.bak`).

Config tokens may point at environment variables via `${VAR}` syntax:
```yaml
instances:
- name: prod
  url: https://airflow.example.com
  auth:
    token: ${AIRFLOW_API_TOKEN}
```

Alternatively, set environment variables directly (a config file isn't required):

```bash
export AIRFLOW_API_URL=http://localhost:8080
export AIRFLOW_AUTH_TOKEN=your-token-here
# Or username/password:
export AIRFLOW_USERNAME=admin
export AIRFLOW_PASSWORD=admin
```

Or CLI flags: `af --airflow-url http://localhost:8080 --token "$TOKEN" <command>`

## Quick Reference

| Command | Description |
|---------|-------------|
| `af health` | Check system health |
| `af dags list` | Show every DAG |
| `af dags get <dag_id>` | Fetch DAG details |
| `af dags explore <dag_id>` | Investigate a DAG in full |
| `af dags source <dag_id>` | Fetch DAG source code |
| `af dags pause <dag_id>` | Stop DAG scheduling |
| `af dags unpause <dag_id>` | Restart DAG scheduling |
| `af dags errors` | Show import errors |
| `af dags warnings` | Show DAG warnings |
| `af dags stats` | Statistics for DAG runs |
| `af runs list` | Show DAG runs |
| `af runs get <dag_id> <run_id>` | Fetch run details |
| `af runs trigger <dag_id>` | Start a DAG run |
| `af runs trigger-wait <dag_id>` | Start a run and block until it finishes |
| `af runs delete <dag_id> <run_id>` | Delete a DAG run permanently |
| `af runs clear <dag_id> <run_id>` | Reset a run so it executes again |
| `af runs diagnose <dag_id> <run_id>` | Analyze a failed run |
| `af tasks list <dag_id>` | Show a DAG's tasks |
| `af tasks get <dag_id> <task_id>` | Fetch task definition |
| `af tasks instance <dag_id> <run_id> <task_id>` | Fetch task instance |
| `af tasks logs <dag_id> <run_id> <task_id>` | Fetch task logs |
| `af config version` | Show Airflow version |
| `af config show` | Show complete configuration |
| `af config connections` | Show connections |
| `af config variables` | Show variables |
| `af config variable <key>` | Fetch one variable |
| `af config pools` | Show pools |
| `af config pool <name>` | Fetch pool details |
| `af config plugins` | Show plugins |
| `af config providers` | Show providers |
| `af config assets` | Show assets/datasets |
| `af api <endpoint>` | Call the REST API directly |
| `af api ls` | Show available API endpoints |
| `af api ls --filter X` | Show endpoints that match a pattern |
| `af registry providers` | Show providers from the Airflow Registry |
| `af registry modules <provider>` | Show a provider's operators/hooks/sensors/transfers |
| `af registry parameters <provider>` | Constructor signatures (name, type, default, required) for the classes in a provider |
| `af registry connections <provider>` | Connection types exposed by a provider |

## User Intent Patterns

### Getting Started
- "How do I run Airflow locally?" / "Set up Airflow" -> use the **managing-astro-local-env** skill (uses Astro CLI)
- "Create a new Airflow project" / "Initialize project" -> use the **setting-up-astro-project** skill (uses Astro CLI)
- "How do I install Airflow?" / "Get started with Airflow" -> use the **setting-up-astro-project** skill

### DAG Operations
- "What DAGs exist?" / "List all DAGs" -> `af dags list`
- "Tell me about DAG X" / "What is DAG Y?" -> `af dags explore <dag_id>`
- "What's the schedule for DAG X?" -> `af dags get <dag_id>`
- "Show me the code for DAG X" -> `af dags source <dag_id>`
- "Stop DAG X" / "Pause this workflow" -> `af dags pause <dag_id>`
- "Resume DAG X" -> `af dags unpause <dag_id>`
- "Are there any DAG errors?" -> `af dags errors`
- "Create a new DAG" / "Write a pipeline" -> use the **authoring-dags** skill

### Run Operations
- "What runs have executed?" -> `af runs list`
- "Run DAG X" / "Trigger the pipeline" -> `af runs trigger <dag_id>`
- "Run DAG X and wait" -> `af runs trigger-wait <dag_id>`
- "Why did this run fail?" -> `af runs diagnose <dag_id> <run_id>`
- "Delete this run" / "Remove stuck run" -> `af runs delete <dag_id> <run_id>`
- "Clear this run" / "Retry this run" / "Re-run this" -> `af runs clear <dag_id> <run_id>`
- "Test this DAG and fix if it fails" -> use the **testing-dags** skill

### Task Operations
- "What tasks are in DAG X?" -> `af tasks list <dag_id>`
- "Get task logs" / "Why did task fail?" -> `af tasks logs <dag_id> <run_id> <task_id>`
- "Full root cause analysis" / "Diagnose and fix" -> use the **debugging-dags** skill

### Data Operations
- "Is the data fresh?" / "When was this table last updated?" -> use the **checking-freshness** skill
- "Where does this data come from?" -> use the **tracing-upstream-lineage** skill
- "What depends on this table?" / "What breaks if I change this?" -> use the **tracing-downstream-lineage** skill

### Deployment Operations
- "Deploy my DAGs" / "Push to production" -> use the **deploying-airflow** skill
- "Set up CI/CD" / "Automate deploys" -> use the **deploying-airflow** skill
- "Deploy to Kubernetes" / "Set up Helm" -> use the **deploying-airflow** skill
- "astro deploy" / "DAG-only deploy" -> use the **deploying-airflow** skill

### System Operations
- "What version of Airflow?" -> `af config version`
- "What connections exist?" -> `af config connections`
- "Are pools full?" -> `af config pools`
- "Is Airflow healthy?" -> `af health`

### API Exploration
- "What API endpoints are available?" -> `af api ls`
- "Find variable endpoints" -> `af api ls --filter variable`
- "Access XCom values" / "Get XCom" -> `af api xcom-entries -F dag_id=X -F task_id=Y`
- "Get event logs" / "Audit trail" -> `af api event-logs -F dag_id=X`
- "Create connection via API" -> `af api connections -X POST --body '{...}'`
- "Create variable via API" -> `af api variables -X POST -F key=name -f value=val`

### Registry Discovery
- "What operators does provider X have?" -> `af registry modules <provider>`
- "What are the constructor params for operator Y?" -> `af registry parameters <provider>`
- "What providers exist?" / "Is there a provider for Z?" -> `af registry providers`
- "What connection types does provider X expose?" -> `af registry connections <provider>`
- "Writing a DAG with a specific operator" -> check the current signature in the registry before copying examples

## Common Workflows

### Validate DAGs Before Deploying

With the Astro CLI, DAG validation doesn't require a running Airflow instance:

```bash
# Parse DAGs to catch import errors and syntax issues
astro dev parse

# Run unit tests
astro dev pytest
```

If not, validate using a running instance:

```bash
af dags errors     # Check for parse/import errors
af dags warnings   # Check for deprecation warnings
```

### Discover Operator Signatures Before Writing Code

For provider classes and their up-to-date constructor signatures, the authoritative source is the Airflow Registry at `airflow.apache.org/registry`. When writing DAGs, favor it over memory or outdated documentation — the registry tracks the live provider release.

```bash
# List all providers and pick the one you need
af registry providers | jq '.providers[] | {id, name, version}'

# List every operator / hook / sensor in a provider (e.g. standard, amazon, google)
af registry modules standard \
  | jq '.modules[] | {name, type, import_path, docs_url}'

# Get the current constructor signature for a specific class
af registry parameters standard \
  | jq '.classes["airflow.providers.standard.operators.hitl.ApprovalOperator"].parameters'

# Filter modules by substring (useful when you know the concept but not the class)
af registry modules standard \
  | jq '.modules[] | select(.import_path | test("hitl"))'
```

Output is cached on the local machine: 1 hour when querying the latest version, 30 days for pinned versions (these never change). To query a particular release, append `--version X.Y.Z` to any `modules` / `parameters` / `connections` invocation.

### Investigate a Failed Run

```bash
# 1. List recent runs to find failure
af runs list --dag-id my_dag

# 2. Diagnose the specific run
af runs diagnose my_dag manual__2024-01-15T10:00:00+00:00

# 3. Get logs for failed task (from diagnose output)
af tasks logs my_dag manual__2024-01-15T10:00:00+00:00 extract_data

# 4. After fixing, clear the run to retry all tasks
af runs clear my_dag manual__2024-01-15T10:00:00+00:00
```

### Morning Health Check

```bash
# 1. Overall system health
af health

# 2. Check for broken DAGs
af dags errors

# 3. Check pool utilization
af config pools
```

### Understand a DAG

```bash
# Get comprehensive overview (metadata + tasks + source)
af dags explore my_dag
```

### Check Why DAG Isn't Running

```bash
# Check if paused
af dags get my_dag

# Check for import errors
af dags errors

# Check recent runs
af runs list --dag-id my_dag
```

### Trigger and Monitor

```bash
# Option 1: Trigger and wait (blocking)
af runs trigger-wait my_dag --timeout 1800

# Option 2: Trigger and check later
af runs trigger my_dag
af runs get my_dag <run_id>
```

## Output Format

Every command emits JSON (the exception being `instance` commands, which print human-readable tables):

```bash
af dags list
# {
#   "total_dags": 5,
#   "returned_count": 5,
#   "dags": [...]
# }
```

Filter results with `jq`:

```bash
# Find failed runs
af runs list | jq '.dag_runs[] | select(.state == "failed")'

# Get DAG IDs only
af dags list | jq '.dags[].dag_id'

# Find paused DAGs
af dags list | jq '[.dags[] | select(.is_paused == true)]'
```

## Task Logs Options

```bash
# Get logs for specific retry attempt
af tasks logs my_dag run_id task_id --try 2

# Get logs for mapped task index
af tasks logs my_dag run_id task_id --map-index 5
```

## Direct API Access with `af api`

Reach for `af api` when a high-level command doesn't cover the endpoint you need (XCom, event-logs, backfills, etc).

```bash
# Discover available endpoints
af api ls
af api ls --filter variable

# Basic usage
af api dags
af api dags -F limit=10 -F only_active=true
af api variables -X POST -F key=my_var -f value="my value"
af api variables/old_var -X DELETE
```

**Field syntax**: `-F key=value` converts types automatically, while `-f key=value` preserves the value as a string.

**Full reference**: [api-reference.md](api-reference.md) covers every option, common endpoints (XCom, event-logs, backfills), and examples.

## Related Skills

| Skill | Use when... |
|-------|-------------|
| **authoring-dags** | Writing or modifying DAG files following best practices |
| **testing-dags** | Iterative cycles of test -> debug -> fix -> retest |
| **debugging-dags** | In-depth root cause analysis and diagnosing failures |
| **checking-freshness** | Determining whether data is current or stale |
| **tracing-upstream-lineage** | Tracing where data originates |
| **tracing-downstream-lineage** | Impact analysis -- what breaks when something changes |
| **deploying-airflow** | Shipping DAGs to production (Astro, Docker Compose, Kubernetes) |
| **migrating-airflow-2-to-3** | Moving DAGs from Airflow 2.x up to 3.x |
| **managing-astro-local-env** | Starting, stopping, or troubleshooting a local Airflow |
| **setting-up-astro-project** | Bootstrapping a new Astro/Airflow project |
