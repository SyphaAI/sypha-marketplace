---
name: integrate-anything
description: >-
  Use this skill only when an action against an external app must run through
  the Membrane CLI via an authenticated Membrane connection — for example,
  posting a message, creating a task, or syncing records. Do not use it for
  general API design, SDK integration, documentation lookup, or direct calls to
  vendor APIs.
metadata:
  category: productivity
  source:
    repository: 'https://github.com/membranehq/agent-skills'
    path: skills/integrate-anything
    license_path: LICENSE
    commit: 6f88cf4b6584373f2f94c7f51dc9e6618e5e46c7
---

# Self-Integration

Connect to external apps through the [Membrane](https://getmembrane.com) CLI.

## Activation and Composition

- Engage this skill only when the task involves executing an action against an external SaaS app and Membrane is available or explicitly called for.
- Hand off explanation-only, SDK, direct API, and product-specific implementation work to a more targeted vendor or integration skill.
- When pairing with a vendor skill, rely on that skill for domain semantics and payload shape, but keep all authentication and execution inside Membrane.
- Before any ambiguous, destructive, or irreversible operation, present a summary of the chosen connection, target, and action, and confirm before proceeding.

**Always route execution through Membrane.** Do not call vendor APIs directly. Membrane proxies every request through an authenticated connection and automatically injects the correct auth headers — including transparent credential refresh.

**Never manage external-app credentials yourself.** OAuth tokens, API keys, refresh tokens — Membrane stores and manages these server-side. Supply a `connectionKey` (or `connectionId`) and the tools will call the vendor on your behalf.

## Workflow

1. **Authenticate with Membrane** (done once per machine).
2. **Establish a connection** to the external app — locate an existing one, reconnect a disconnected one, or provision a new one.
3. **Use the connection** to execute actions or interact with the app's API.

The remainder of this skill walks through each of these three steps in detail.

## Authentication

```bash
npx @membranehq/cli login --tenant
```

`--tenant` issues a tenant-scoped token (workspace + customer), so you no longer need to supply `--workspaceKey` and `--tenantKey` on every subsequent command.

The command launches a browser. In headless environments it prints an authorization URL — instruct the user to open it, complete the flow, and paste the returned code back; then finish with:

```bash
npx @membranehq/cli login complete <code>
```

Credentials are saved to `~/.membrane/credentials.json`. All subsequent commands read them automatically.

If `npx` is inconvenient, install the CLI globally: `npm i -g @membranehq/cli@1.18.1` and use plain `membrane …`. Append `--json` to any command for machine-readable output.

## Step 1 — Get a connection

### 1a. Find an existing connection

```bash
npx @membranehq/cli connection list --json
```

Each connection exposes `id`, `key`, `integrationKey`, and `state`. Locate the target app and act based on `state`:

- **`READY`** → proceed directly. Jump to Step 2.
- **`CLIENT_ACTION_REQUIRED`** (disconnected, re-auth needed) → **reconnect the existing connection**, do NOT create a new one:

  ```bash
  npx @membranehq/cli connect --connectionId <id>
  ```

  Provisioning a new connection while the old one is `CLIENT_ACTION_REQUIRED` creates orphaned records and breaks any references to the old `connectionKey`. Always reconnect.
- **Multiple matches** (e.g. `slack-work` and `slack-personal`) → ask the user which one to use. Do not guess.
- **No match** → create a new connection (Step 1b).

### 1b. Create a new connection

By URL or domain — the quickest path:

```bash
npx @membranehq/cli connection ensure "https://slack.com" --json
# also accepts a bare domain: "slack.com"
```

The URL is normalized to a domain and matched against known apps. When no match is found, an app is created and a connector is built automatically.

To assign a stable, human-readable key for later lookup (particularly useful for multi-account setups such as `slack-work` + `slack-personal`), set it after creation:

```bash
npx @membranehq/cli connection patch <id> --data '{"connectionKey":"slack-work"}'
```

For the explicit multi-connection case (creating a second connection to an app you already have connected), use `connect`:

```bash
npx @membranehq/cli connect --integrationKey slack \
  --connectionKey slack-personal --allowMultipleConnections
```

### 1c. Drive the connection to `READY`

After the reconnect from 1a or the creation in 1b, check `state` and follow the state machine:

- **`READY`** — complete. Proceed to Step 2.
- **`BUILDING`** — Membrane's builder agent is active. Wait for it:

  ```bash
  npx @membranehq/cli connection get <id> --wait --json
  ```

  `--wait` long-polls (up to `--timeout` seconds, default 30).
- **`CLIENT_ACTION_REQUIRED`** — the user or agent must take action. The `clientAction` object explains what is needed:
  - `clientAction.type` — `"connect"` (auth flow) or `"provide-input"` (additional fields required).
  - `clientAction.agentInstructions` (optional) — **follow these exactly if present**. They describe how the agent should programmatically drive the provider side of the flow. Do not shortcut to "paste this URL" — these instructions exist because the agent is expected to handle the step.
  - `clientAction.uiUrl` (optional) — a Membrane-hosted page where the user can complete the action manually. Display this only when `agentInstructions` directs you to, or when no `agentInstructions` are provided.
  - `clientAction.description` — a human-readable explanation.

  When the action requires writing data back to the connection (e.g. captured OAuth credentials, custom parameters):

  ```bash
  npx @membranehq/cli connection patch <id> --data '{"connectorParameters":{...},"input":{...}}'
  ```

  Once the user finishes their step, poll with `connection get <id> --wait --json` until `state` transitions.
- **`CONFIGURATION_ERROR`** / **`SETUP_FAILED`** — present the `error` field to the user. These are terminal states — do not retry blindly.

## Step 2 — Use the connection

The quickest route to a real response is `act` with an inline dispatch. **No "create action → wait → run" ceremony is required.**

`act` takes exactly one of four dispatch styles:

| Dispatch | When to use |
|---|---|
| `--api '<json>'` | **First call after a fresh connection, and any one-off HTTP request.** Membrane handles auth + base URL. |
| `--code '<js>'` | You need a small piece of logic (loop, transform, multi-step). |
| `--key <key>` | You've previously saved this call as a reusable action. |
| `--id <id>` | Same as `--key` but by id (use only when the action has no key). |

### 2a. Inline `api` (recommended for the first call after a fresh connection, and for one-off calls)

**Use this as the default for the very first call against a new connection.** It is the fastest way to confirm the connection is working and deliver a real response to the user — no build step, no `BUILDING` state, no waiting.

Supply an HTTP spec; Membrane proxies it through the connection's auth layer and base URL:

```bash
npx @membranehq/cli act --connectionKey slack-work \
  --api '{"method":"POST","path":"/api/chat.postMessage","body":{"channel":"#general","text":"Hello"}}' \
  --json
```

Spec shape: `{ method, path, body?, headers?, query? }`. The connector's base URL is automatically prepended. Auth is automatically injected.

Only promote to a saved action (Step 3) when the user intends to run the same call repeatedly — saving is genuinely useful for repeat use but introduces latency and failure modes that are wasteful for a first-call activation.

### 2b. Inline `code` (when you need logic, not just an HTTP call)

```bash
npx @membranehq/cli act --connectionKey hubspot \
  --code 'module.exports = async ({ input, membrane }) => {
    const all = []
    let after
    do {
      const page = await membrane.api({ method: "GET", path: "/crm/v3/objects/contacts", query: { limit: 100, after } })
      all.push(...page.results)
      after = page.paging?.next?.after
    } while (after)
    return { count: all.length }
  }' \
  --input '{}' --json
```

The function receives `{ input, membrane, connection, integration }`. Call `membrane.api({ method, path, ... })` inside the function to issue authenticated requests. Whatever the function returns becomes the response `output`.

### 2c. Reusable action by key (for repeat use)

When the user plans to run the same call repeatedly, save it once and invoke it by `key`:

```bash
npx @membranehq/cli act --key send-channel-message --connectionKey slack-work \
  --input '{"channel":"#general","text":"Hello"}' --json
```

See **Step 3** below for how to create a saved action.

### 2d. Discover existing reusable actions

If you are unsure whether one already exists:

```bash
# Ranked by semantic match against an intent
npx @membranehq/cli action list --connectionKey slack-work --intent "send a message" --limit 10 --json

# Catalog actions for one app (browse without a connection)
npx @membranehq/cli external-app list --search slack --json   # → externalAppId
npx @membranehq/cli action list --externalAppId <id> --json
```

Each result includes `id`, `key`, `name`, `description`, `inputSchema`, and `outputSchema`. Inspect the `inputSchema` before executing — it is authoritative.

If nothing matches, fall back to inline `api` or `code` (above), or create a saved action (Step 3).

## Step 3 — Save reusable actions (optional)

When you are about to issue the same `act --api` call a second time, save it instead. Subsequent calls then become `act --key <key>` rather than the full inline spec.

Two approaches:

**By intent** — describe what you need; Membrane builds and validates the configuration:

```bash
npx @membranehq/cli action create "send a message in a channel" --connectionKey slack-work --json
```

The action returns in `state: BUILDING`. Wait for it:

```bash
npx @membranehq/cli action get <id> --wait --json
```

**By explicit spec** — provide `type` + `config` directly. Typical when promoting a validated inline `api` call to a saved action:

```bash
npx @membranehq/cli action create \
  --key send-channel-message \
  --type api-request-to-external-app \
  --config '{"request":{"method":"POST","path":"/api/chat.postMessage"}}' \
  --integrationKey slack --json
```

Scope is determined by which fields you supply:
- `connectionKey` / `connectionId` → connection-level (scoped to one connection)
- `integrationKey` / `integrationId` (no connection) → integration-level (shared across all connections on that integration)

Update / delete:

```bash
npx @membranehq/cli action update <id-or-key> --data '<json-merge>'
npx @membranehq/cli action delete <id-or-key>
```

**Confirm with the user before saving** — they may want the action named, described, or left inline.

## Error recovery

Inspect the response body — never branch on HTTP status alone. Three error paths exist:

### 401 — Membrane auth is invalid
The CLI session is expired or invalid. Re-run `membrane login --tenant`.

### Disconnected external-app connection
The vendor's auth is no longer valid (token revoked, OAuth expired, credentials rotated). Fetch the connection state:

```bash
npx @membranehq/cli connection get <id-or-key> --json
```

If `state` is `CLIENT_ACTION_REQUIRED`, **reconnect the existing connection** (do not create a new one):

```bash
npx @membranehq/cli connect --connectionId <id>
```

Once re-authenticated, retry the original `act` call.

### Action failed
Every `act` response includes an `actionRunId`, for both successes and errors. Retrieve the full log:

```bash
npx @membranehq/cli action-run-log get <actionRunId> --details --json
```

This returns the mapped input, output, and errors, along with the raw HTTP exchange with the external app.

## CLI Reference

Every command accepts `--json`. Append `--workspaceKey <key>` and `--tenantKey <key>` to override project defaults.

### connection
```bash
npx @membranehq/cli connection ensure <appUrl> [--name <n>] [--json]                       # Find or create by URL
npx @membranehq/cli connection list [--json]
npx @membranehq/cli connection get <id-or-key> [--wait] [--timeout <n>] [--json]
npx @membranehq/cli connection patch <id> --data '<json>' [--json]
npx @membranehq/cli connect --connectionId <id>                                              # Reconnect existing
npx @membranehq/cli connect --integrationKey <k> [--connectionKey <k>] [--allowMultipleConnections]
```

### act
```bash
npx @membranehq/cli act --connectionKey <k> --api  '<json>' [--input <json>] [--json]   # Inline HTTP
npx @membranehq/cli act --connectionKey <k> --code '<js>'   [--input <json>] [--json]   # Inline JS
npx @membranehq/cli act --connectionKey <k> --key  <k>      [--input <json>] [--json]   # Reusable
npx @membranehq/cli act --connectionKey <k> --id   <id>     [--input <json>] [--json]   # Reusable by id
```

### action (manage saved actions)
```bash
npx @membranehq/cli action list   [--connectionKey <k>] [--externalAppId <id>] [--intent <t>] [--limit <n>] [--json]
npx @membranehq/cli action create <intent> --connectionKey <k> [--json]                       # Build by intent
npx @membranehq/cli action create --key <k> --type <t> --config '<json>' --integrationKey <k> [--json]   # Explicit spec
npx @membranehq/cli action get    <id-or-key> [--wait] [--timeout <n>] [--json]
npx @membranehq/cli action update <id-or-key> --data '<json>'                                  # Merge
npx @membranehq/cli action delete <id-or-key>
```

### action-run-log
```bash
npx @membranehq/cli action-run-log get <actionRunId> [--details] [--json]                      # Diagnostics for any /act call
```

### external-app / search
```bash
npx @membranehq/cli external-app list --search <query> --json
npx @membranehq/cli search <query> [--elementType <type>] [--limit <n>] [--json]
```

## Fallback: Raw API

When the CLI is not available, call the API directly.

Base URL: `https://api.getmembrane.com`
Auth header: `Authorization: Bearer $MEMBRANE_TOKEN`

Retrieve the token from the [Membrane dashboard](https://console.getmembrane.com).

| CLI Command | API Equivalent |
|---|---|
| `connection ensure "<url>" --json` | `POST /connections/ensure` with `{"appUrl": "<url>"}` |
| `connection list --json` | `GET /connections` |
| `connection get <id> --wait --json` | `GET /connections/:id?wait=true` |
| `connection patch <id> --data <json>` | `PATCH /connections/:id` with `<json>` |
| `connect --connectionId <id>` | `POST /connections/:id/reconnect` |
| `act --connectionKey <k> --api <json>` | `POST /act` with `{"connectionKey":"<k>","api":<json>}` |
| `act --connectionKey <k> --code <js>` | `POST /act` with `{"connectionKey":"<k>","code":"<js>"}` |
| `act --connectionKey <k> --key <ak>` | `POST /act` with `{"connectionKey":"<k>","key":"<ak>","input":<json>}` |
| `action list --connectionKey <k> --intent <t>` | `GET /actions?connectionKey=<k>&intent=<t>` |
| `action create <intent> --connectionKey <k>` | `POST /actions` with `{"intent":"<t>","connectionKey":"<k>"}` |
| `action get <id> --wait` | `GET /actions/:id?wait=true` |
| `action-run-log get <actionRunId> --details` | `GET /action-run-logs/:id?details=true` |

## External Endpoints

All requests target the Membrane API. This skill contacts no other external services directly.

| Endpoint | Data Sent |
|---|---|
| `https://api.getmembrane.com/*` | Auth credentials, connection parameters, action inputs, agent prompts |

## Security & Privacy

- All data is transmitted to the Membrane API over HTTPS.
- CLI credentials are stored locally in `~/.membrane/` with restricted file permissions.
- Connection authentication (OAuth, API keys) is managed by Membrane — credentials for external apps are held by the Membrane service, not stored locally.
- Action inputs and outputs flow through the Membrane API to the connected external app.

Using this skill transmits data to [Membrane](https://getmembrane.com). Install only if you trust Membrane with access to your connected apps.
