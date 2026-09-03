# Rapid Iteration with CLI (no DAB)

Use the `databricks pipelines` CLI to create, run, and iterate on a pipeline **without managing a bundle**. This is the fastest approach for prototyping. Work destined for production should use a bundle — see [1-project-initialization-with-dab.md](1-project-initialization-with-dab.md).

**Default to serverless.** Use classic clusters only when the user explicitly requires R, Spark RDD APIs, or JAR libraries.

---

## Step 1: Write pipeline files locally

`.sql` or `.py` files in a folder. See [python-basics.md](python-basics.md) or [sql-basics.md](sql-basics.md) for syntax.

## Step 2: Upload to the workspace

```bash
databricks workspace import-dir ./my_pipeline /Workspace/Users/<user>/my_pipeline
```

Pass `--overwrite` when re-uploading after each code change.

## Step 3: Create the pipeline

```bash
databricks pipelines create --json '{
  "name": "my_pipeline",
  "catalog": "my_catalog",
  "schema": "my_schema",
  "serverless": true,
  "continuous": false,
  "development": true,
  "channel": "PREVIEW",
  "configuration": {
    "pipelines.numUpdateRetryAttempts": "0",
    "pipelines.maxFlowRetryAttempts": "0"
  },
  "libraries": [{"glob": {"include": "/Workspace/Users/<user>/my_pipeline/**"}}]
}'
```

These flags represent the canonical dev/iteration defaults — designed to fail fast. **They are tuned for demos and iteration.** For production pipelines, remove `"development"` and the two `pipelines.*RetryAttempts` overrides so the platform's retry defaults (5 / 2) can handle transient infrastructure failures. Per-field reasoning is in [pipeline-configuration.md#canonical-create-dev--iteration-defaults](pipeline-configuration.md#canonical-create-dev--iteration-defaults).

`libraries`: use `"glob"` for a directory (the recommended approach for medallion folders), `"file"` for a single `.sql`/`.py` file (folder paths fail with `Paths must end with .py or .sql`), or a list of `"file"` entries when execution order matters. `"notebook"` is deprecated — do not use it.

```json
"libraries": [
  {"file": {"path": "/Workspace/.../bronze/ingest_orders.sql"}},
  {"file": {"path": "/Workspace/.../silver/clean_orders.sql"}}
]
```

Save the returned `pipeline_id`.

## Step 4: Start an update and poll *that update*

```bash
UPDATE_ID=$(databricks pipelines start-update <pipeline_id> | jq -r .update_id)
# Or with full refresh (destructive on streaming state — omit for incremental):
# UPDATE_ID=$(databricks pipelines start-update <pipeline_id> --full-refresh | jq -r .update_id)

while :; do
  STATE=$(databricks pipelines get-update <pipeline_id> "$UPDATE_ID" | jq -r '.update.state')
  echo "$(date +%H:%M:%S) update=$UPDATE_ID state=$STATE"
  case "$STATE" in COMPLETED|FAILED|CANCELED) break;; esac
  sleep 30
done
```

**Why poll the update rather than the pipeline.** The top-level pipeline `state` reverts to `RUNNING` on `RETRY_ON_FAILURE`, so a loop watching the pipeline (or `latest_updates[0]`) can cycle past a genuine `FAILED` update indefinitely. Poll the captured `update_id` and exit on the first terminal state — including `FAILED`.

**When the state is `FAILED`**: read the events log instead of re-running. **The actual error is in `error.exceptions[0].message`, not the top-level `.message`** — that field simply reads "Update X is FAILED", which provides no useful information. Extract both:

```bash
databricks pipelines list-pipeline-events <pipeline_id> \
  | jq '[.[] | select(.level=="ERROR") | {
      event_type,
      summary: (.message // "")[0:200],
      exception: ((.error.exceptions[0].message // "no exception body") | .[0:800])
    }] | .[0:5]'
```

If your output only shows "Update X is FAILED", you are not extracting `error.exceptions[0].message` — correct the jq expression and run it again.

If the pipeline is already `RUNNING`, `start-update` queues the new update. If necessary, force-stop it first with `databricks pipelines stop <pipeline_id>`.

## Step 5: Edit → re-upload → restart

```bash
# Re-upload (whole dir)
databricks workspace import-dir ./my_pipeline /Workspace/Users/<user>/my_pipeline --overwrite

# Or a single file
databricks workspace import /Workspace/Users/<user>/my_pipeline/gold.sql \
  --file ./my_pipeline/gold.sql --format RAW --overwrite

# Restart
databricks pipelines start-update <pipeline_id>
```

**Always use `--format RAW`** for raw `.sql` / `.py` FILE entries. `--format SOURCE --language SQL|PYTHON` uploads a workspace *notebook* — and **notebooks are deprecated for pipelines**. Mixing both formats on the same path causes `Cannot overwrite the asset ... due to type mismatch (asked: NOTEBOOK, actual: FILE)`.

## Step 6: Validate output data

Even when the status is `COMPLETED`, validate the data:

```bash
databricks experimental aitools tools discover-schema \
  my_catalog.my_schema.bronze_orders \
  my_catalog.my_schema.silver_orders \
  my_catalog.my_schema.gold_summary
```

Returns column names/types, 5 sample rows, total row count, and null counts per column for each table.

Look for: empty tables (ingestion or filter problems), unexpected row counts (broken joins), missing columns (schema mismatch), and nulls in key columns (data quality issues).

**When validation uncovers problems**, trace the issue upstream: run `discover-schema` on the source table of the problematic dataset, then on *its* source, continuing until you identify the layer where the problem originates. Bronze empty = source path is wrong or files are missing; silver empty = filter is too restrictive or the join condition is mismatched; gold wrong counts = aggregation or grouping bug, or duplicate keys in the source.

---

## Quick reference: CLI commands

### Pipeline lifecycle

| Command | Description |
|---------|-------------|
| `databricks pipelines create --json '{...}'` | Create a new pipeline. |
| `databricks pipelines get <pipeline_id>` | Pipeline details and current status. |
| `databricks pipelines update <pipeline_id> --json '{...}'` | Update pipeline config. |
| `databricks pipelines delete <pipeline_id>` | Delete the pipeline. |
| `databricks pipelines list-pipelines` | List all pipelines. |

### Run management

| Command | Description |
|---------|-------------|
| `databricks pipelines start-update <pipeline_id>` | Start a triggered update. |
| `databricks pipelines start-update <pipeline_id> --full-refresh` | Start with full refresh (destructive on streaming state). |
| `databricks pipelines stop <pipeline_id>` | Stop a running pipeline. |
| `databricks pipelines list-pipeline-events <pipeline_id>` | Event log (errors live here). |
| `databricks pipelines list-updates <pipeline_id>` | Recent runs. |
| `databricks pipelines get-update <pipeline_id> <update_id>` | Status of a specific update (use this for polling). |

### Supporting commands

| Command | Description |
|---------|-------------|
| `databricks workspace import-dir` | Upload files/folders to the workspace. |
| `databricks workspace import` | Upload a single file. |
| `databricks workspace list` | List workspace files. |
| `databricks experimental aitools tools discover-schema` | Schema + row counts + sample data + null counts. |
| `databricks experimental aitools tools query` | Run ad-hoc SQL. |

---

## Python SDK alternative

Uses the same JSON shape via `databricks.sdk.WorkspaceClient`: `w.pipelines.create(name=..., catalog=..., schema=..., serverless=True, continuous=False, development=True, channel="PREVIEW", configuration={...}, libraries=[...])`. Store `pipeline.pipeline_id`. Start a run with `w.pipelines.start_update(pipeline_id=..., full_refresh=...)` and poll `w.pipelines.get_update(pipeline_id=..., update_id=update.update_id).update.state` until it reaches `COMPLETED`, `FAILED`, or `CANCELED`. Prefer the CLI for interactive setup; use the SDK for programmatic or scripted workflows.
