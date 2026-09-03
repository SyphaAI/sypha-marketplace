# schema

Emit the complete machine-readable schema for an operation: the CLI-level parameter shape **and** the parameters, request body, and response of the underlying OpenAPI route.

> [!IMPORTANT]
> **Before** writing code or scripts that consume an operation's output, run `airbyte-agent schema <resource> <operation>`. The `api.response` schema shows precisely which fields will come back, letting you pass `--fields` correctly on the first try.

> [!NOTE]
> `schema` accepts positional arguments rather than a `--json` payload — it is an introspection command, not an API call.

## Usage

```
airbyte-agent schema <resource> <operation>

# Examples
airbyte-agent schema workspaces list
airbyte-agent schema connectors execute
airbyte-agent schema organizations list
```

## Output shape

```jsonc
{
  "description": "...",        // CLI-level operation description
  "params": { ... },           // CLI flag/JSON parameters (what you pass)
  "api": {                     // OpenAPI route info (omitted if no mapping)
    "path": "/api/v1/...",
    "method": "GET",
    "summary": "...",
    "description": "...",
    "parameters": [ ... ],     // query/path/header parameters
    "request_body": { ... },   // present on POST/PATCH/PUT routes
    "response": { ... }        // 200/2xx response schema, $refs inlined
  }
}
```

These two surfaces are deliberately kept apart:

- **`params`** — what you, the CLI caller, put inside the `--json` payload. Covers CLI conveniences (workspace fallback, name/id alternation, etc.).
- **`api`** — the bytes that actually travel to the Airbyte API. Consult this to learn which fields the response will hold and choose `--fields` accordingly.

## When to use

- **Before building any automation** that relies on an operation's response shape — study `api.response` so your filtering/parsing can be shaped precisely.
- **When `--fields` yields something unexpected** — `api.response` reveals the exact field names and structure.
- **When exploring the API surface** as an agent — `airbyte-agent schema <r> <op>` is the canonical way to find out what an operation does without issuing a request.

## Hints

- `airbyte-agent schema` issues no API calls — it is safe to run without auth, against unfamiliar accounts, and so on.
- Errors from `airbyte-agent schema` (an unknown resource or operation) come as JSON on stderr with exit code 3.
- Operations without a mapped OpenAPI route omit the `api` block. (`airbyte-agent login` is likewise purely local but is not a registered operation — it is a top-level command.)
