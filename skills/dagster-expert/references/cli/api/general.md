---
title: "dg api: General"
triggers:
  - "always read before using any dg api subcommand"
---

Every `dg api` subcommand accepts `--json`, `--response-schema`, `--deployment`, `--organization`, `--api-token`, and `--view-graphql`.

- `--response-schema` — outputs the JSON schema for the command's response and exits. Consult this before writing any parsing logic to obtain exact field names, types, and valid enum values.
- `--view-graphql` — emits GraphQL queries and responses to stderr, which is helpful for debugging.

## Tips

For complex debugging or analysis workflows, ALWAYS pass `--json` to receive machine-readable output. Pipe the result into `jq` (recommended) or another tool for further processing.

Flags such as `--deployment`/`--organization`/`--api-token` are generally unnecessary when you are already authenticated via `dg plus login`.
