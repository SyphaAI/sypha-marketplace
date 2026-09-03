---
name: databricks-model-serving
description: >-
  Databricks Model Serving endpoint lifecycle and operations. Use when asked to:
  CRUD serving endpoints (CLI or MLflow Deployments client); set up traffic
  routing for A/B / canary deploys and zero-downtime version swaps; fetch
  OpenAPI schemas; examine logs, metrics, or permissions; manage AI Gateway rate
  limits; discover Foundation Model API endpoints at runtime; integrate
  endpoints into Databricks Apps; or stream from off-platform clients (Vercel AI
  SDK v6, standalone Node.js). NOT for: training, MLflow autologging, UC
  registration, custom PyFunc/ResponsesAgent authoring (databricks-ml-training);
  Knowledge Assistants/Supervisor Agents (databricks-agent-bricks); MLflow
  evaluation (databricks-mlflow-evaluation).
compatibility: Requires databricks CLI (>= v0.294.0)
metadata:
  version: 0.4.0
  upstream:
    parent: databricks-core
  category: data
  source:
    repository: 'https://github.com/databricks/databricks-agent-skills'
    path: skills/databricks-model-serving
    license_path: LICENSE
    commit: 3985599b8efaf0bb155be7e60847a3975bf45331
---

# Model Serving Endpoints

**FIRST**: Use the parent `databricks-core` skill for CLI basics, authentication, and profile selection.

Model Serving offers managed endpoints for exposing LLMs, custom ML models, and external models as scalable REST APIs. Each endpoint is identified by its **name**, which must be unique within the workspace.

## Endpoint Types

| Type | When to Use | Key Detail |
|------|-------------|------------|
| Pay-per-token | Foundation Model APIs (Llama, GPT-5, Claude, Gemini, etc.) | Uses `system.ai.*` catalog models, pre-provisioned in every workspace. Discover at runtime — see [Foundation Model API endpoints](#foundation-model-api-endpoints) below. |
| Provisioned throughput | Dedicated GPU capacity | Guaranteed throughput, higher cost |
| Custom model | Your own MLflow models or containers | Deploy any model with an MLflow signature |

## Endpoint Structure

```
Serving Endpoint (top-level, identified by NAME)
  ├── Config
  │     ├── Served Entities (model references + scaling config)
  │     └── Traffic Config (routing percentages across entities)
  ├── AI Gateway (rate limits, usage tracking)
  └── State (READY / NOT_READY, config_update status)
```

- **Served Entities**: Each entity points to a model (from Unity Catalog or MLflow) along with scaling parameters. Retrieve the entity name from `served_entities[].name` in the `get` output — required for the `build-logs` and `logs` commands.
- **Traffic Config**: Distributes requests across served entities by percentage (used for A/B testing and canary deployments).
- **State**: Endpoints move from `NOT_READY` to `READY` after creation or a config update. Poll with `get` to check `state.ready`.

## CLI Discovery — ALWAYS Do This First

**Do NOT guess command syntax.** Dynamically discover available commands and their usage:

```bash
# List all serving-endpoints subcommands
databricks serving-endpoints -h

# Get detailed usage for any subcommand (flags, args, JSON fields)
databricks serving-endpoints <subcommand> -h
```

Always run `databricks serving-endpoints -h` before building any command. Use `databricks serving-endpoints <subcommand> -h` to look up the exact flags, positional arguments, and JSON spec fields for that subcommand.

## Create an Endpoint

> **Do NOT list endpoints before creating.**

```bash
databricks serving-endpoints create <ENDPOINT_NAME> \
  --json '{
    "served_entities": [{
      "entity_name": "<MODEL_CATALOG_PATH>",
      "entity_version": "<VERSION>",
      "min_provisioned_throughput": 0,
      "max_provisioned_throughput": 0,
      "workload_size": "Small",
      "scale_to_zero_enabled": true
    }],
    "traffic_config": {
      "routes": [{
        "served_entity_name": "<ENTITY_NAME>",
        "traffic_percentage": 100
      }]
    }
  }' --profile <PROFILE>
```

- To discover available Foundation Models, refer to [Foundation Model API endpoints](#foundation-model-api-endpoints) below for the runtime-list snippet and default-picking rules. You can also browse the `system.ai` catalog in Unity Catalog, or run `databricks serving-endpoints list --profile <PROFILE>` to view what is deployed in the workspace. Use `databricks serving-endpoints get-open-api <ENDPOINT_NAME> --profile <PROFILE>` to examine the API schema for a specific endpoint.
- This is a long-running operation; the CLI waits for completion by default. Pass `--no-wait` to return immediately, then poll:
  ```bash
  databricks serving-endpoints get <ENDPOINT_NAME> --profile <PROFILE>
  # Check: state.ready == "READY"
  ```
- For provisioned throughput or custom model endpoints, run `databricks serving-endpoints create -h` to find the required JSON fields for your endpoint type.

### MLflow Deployments client (Python alternative)

`mlflow.deployments.get_deploy_client("databricks").create_endpoint(name=..., config={...})` accepts the same JSON shape as the CLI. Two things to watch out for:

- **`tags=` is a top-level kwarg**, NOT a field inside `config`. It uses the same `[{key, value}]` shape as `serving-endpoints patch --add-tags`.
- **`traffic_config.routes[].served_model_name` = `"<model>-<version>"`** (e.g. `"turbine_failure-3"`). The API derives this from the entity automatically, but you must reference the exact string in `traffic_config` — an incorrect format causes the route to silently fail to match.

### Zero-downtime version swap

To roll an endpoint to a new model version: update the alias **and** call `update_endpoint` with the new `served_entities` plus a matching `traffic_config`. Omitting either step is the typical mistake — updating only the alias does not affect the endpoint; calling `update_endpoint` alone leaves the alias pointing at the old version.

```python
from mlflow.tracking import MlflowClient
from mlflow.deployments import get_deploy_client

registry = MlflowClient(registry_uri="databricks-uc")
deploy   = get_deploy_client("databricks")

registry.set_registered_model_alias(FULL_NAME, "prod", new_version)
deploy.update_endpoint(endpoint=ENDPOINT_NAME, config={
    "served_entities": [{"entity_name": FULL_NAME, "entity_version": new_version,
                         "workload_size": "Small", "scale_to_zero_enabled": True}],
    "traffic_config": {"routes": [
        {"served_model_name": f"{NAME}-{new_version}", "traffic_percentage": 100}
    ]},
})
```

The CLI equivalent is `databricks serving-endpoints update-config <NAME> --json '...'`. In either case, poll both `state.ready` and `state.config_update` afterward — see Endpoint Readiness below.

### Endpoint Readiness

Following `create` or `update-config`, the endpoint allocates compute and loads the model. **Do not send queries to the endpoint until it is ready.** Two state fields matter and carry distinct meanings:

- `state.ready` — becomes `READY` once the endpoint has any active configuration. Remains `READY` throughout a version swap.
- `state.config_update` — becomes `NOT_UPDATING` once the *current* config update completes; shows `IN_PROGRESS` during a version swap.

A loop that only watches `state.ready` will report "ready" in the middle of a version swap while the old version is still handling traffic. **Poll both:**

```bash
databricks serving-endpoints get <ENDPOINT_NAME> --profile <PROFILE> \
  | jq '{ready: .state.ready, config_update: .state.config_update}'
# Fully ready when ready == "READY" AND config_update == "NOT_UPDATING"
```

Provisioning can take several minutes. Provisioned throughput endpoints require the most time due to GPU allocation. Requests to endpoints that have not yet reached `READY` return 404 or 503.

## Query an Endpoint

Chat / agent endpoints use the `messages` array:

```bash
databricks serving-endpoints query <ENDPOINT_NAME> \
  --json '{"messages": [{"role": "user", "content": "Hello"}]}' --profile <PROFILE>
```

Classical ML endpoints use `dataframe_records` (one record per row):

```bash
databricks serving-endpoints query <ENDPOINT_NAME> \
  --json '{"dataframe_records": [{"vibration": 0.42, "rpm": 18.3, "temp_c": 71.2}]}'
```

- Pass `--stream` to receive streaming responses from chat endpoints.
- For embeddings or other custom schemas: run `get-open-api <ENDPOINT_NAME>` first to learn the request/response structure.

## Get Endpoint Schema (OpenAPI)

Returns an OpenAPI 3.1 JSON schema that describes what each served model accepts and returns. Use this to understand an endpoint's input/output format before sending queries.

```bash
databricks serving-endpoints get-open-api <ENDPOINT_NAME> --profile <PROFILE>
```

The schema exposes paths per served model (e.g., `/served-models/<model-name>/invocations`) with complete request/response definitions, including parameter types, enums, and nullable fields.

## Other Commands

Run `databricks serving-endpoints <subcommand> -h` for usage details.

| Task | Command | Notes |
|------|---------|-------|
| List all endpoints | `list` | |
| Get endpoint details | `get <NAME>` | Shows state, config, served entities |
| Delete endpoint | `delete <NAME>` | |
| Update served entities or traffic | `update-config <NAME> --json '...'` | Zero-downtime: old config serves until new is ready |
| Rate limits & usage tracking | `put-ai-gateway <NAME> --json '...'` | |
| Update tags | `patch <NAME> --json '...'` | |
| Build logs | `build-logs <NAME> <SERVED_MODEL>` | Get `SERVED_MODEL` from `get` output: `served_entities[].name` |
| Runtime logs | `logs <NAME> <SERVED_MODEL>` | |
| Metrics (Prometheus format) | `export-metrics <NAME>` | |
| Permissions | `get-permissions <ENDPOINT_ID>` | ⚠️ Uses endpoint **ID** (hex string), not name. Find ID via `get`. |

## What's Next

### Integrate with a Databricks App

Once a serving endpoint exists, connect it to a Databricks App.

**Step 1 — Verify that the `serving` plugin is available** in the AppKit template:

```bash
databricks apps manifest --profile <PROFILE>
```

If the output contains a `serving` plugin, scaffold with:

```bash
databricks apps init --name <APP_NAME> \
  --features serving \
  --set "serving.serving-endpoint.name=<ENDPOINT_NAME>" \
  --run none --profile <PROFILE>
```

**Step 2 — When no `serving` plugin exists**, manually add the endpoint resource to an existing app's `databricks.yml`:

```yaml
resources:
  apps:
    my_app:
      resources:
        - name: my-model-endpoint
          serving_endpoint:
            name: <ENDPOINT_NAME>
            permission: CAN_QUERY
```

Then expose the endpoint name as an environment variable in `app.yaml`:

```yaml
env:
  - name: SERVING_ENDPOINT
    valueFrom: serving-endpoint
```

Next, connect the endpoint into your app through the `serving()` plugin or a custom route in `onPluginsReady`. For the complete app integration pattern, use the **`databricks-apps`** skill and consult the [Model Serving Guide](../databricks-apps/references/appkit/model-serving.md).

### Develop & deploy new models

This skill focuses on operations (managing existing endpoints). For the development workflow — training, MLflow tracking, UC registration, custom PyFunc authoring, and writing `ResponsesAgent` code — see **[databricks-ml-training](../databricks-ml-training/SKILL.md)** (experimental).

## Foundation Model API endpoints

Pay-per-token endpoints come pre-provisioned in every workspace. New models are added regularly and a static list in the skill becomes outdated quickly — **always enumerate them at runtime rather than hard-coding names**. Filter by the `databricks-` name prefix AND by the served entity residing in `system.ai.*` (other endpoints such as `databricks-app-template-serving` share the prefix but are not FM API endpoints).

```bash
# FM API endpoints in this workspace, grouped by task (chat / embeddings / etc.)
databricks serving-endpoints list \
  | jq -r '.[]
      | select(.name | startswith("databricks-"))
      | select((.config.served_entities[0].entity_name // "") | startswith("system.ai."))
      | "\(.task)\t\(.name)"' \
  | sort
```

**When the user does not specify a model**: choose the highest-numbered Claude Sonnet for agents, the highest-numbered `-codex-max` for code, and `databricks-gte-large-en` for embeddings — resolve actual names from the live list above.

## Off-platform streaming

For apps deployed **outside** Databricks Apps (on Vercel, AWS, or standalone Node.js) that call Databricks AI Gateway using Vercel AI SDK v6, see [references/off-platform-streaming.md](references/off-platform-streaming.md). For AppKit-based apps, use the built-in serving plugin from the `databricks-apps` skill instead.

## Troubleshooting

| Error | Solution |
|-------|----------|
| `cannot configure default credentials` | Use `--profile` flag or authenticate first |
| `PERMISSION_DENIED` | Check workspace permissions; for apps, ensure `serving_endpoint` resource declared with `CAN_QUERY` |
| Endpoint stuck in `NOT_READY` | Wait up to 30 min for provisioned throughput. Check build logs: `build-logs <NAME> <ENTITY_NAME>` (get entity name from `get` output → `served_entities[].name`) |
| `RESOURCE_DOES_NOT_EXIST` | Verify endpoint name with `list` |
| Query returns 404 | Endpoint may still be provisioning; check `state.ready` via `get` |
| `RATE_LIMIT_EXCEEDED` (429) | AI Gateway rate limit; check `put-ai-gateway` config or retry after backoff |
| Endpoint missing from the Serving UI after deploy | UI filter defaults to "Owned by me". Deploy jobs run as a service principal, so the endpoint is hidden until you switch to "All". `databricks serving-endpoints list` always shows it. |
