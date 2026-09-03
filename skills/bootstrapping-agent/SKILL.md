---
name: bootstrapping-agent
description: >-
  Wires up an Airbyte connector for use in a PydanticAI or Claude SDK agent.
  Generates auth config, connector initialization, and tool_utils-decorated tool
  function. Use when adding a connector to an agent or setting up a new agent
  with a connector.
metadata:
  category: development
  source:
    repository: 'https://github.com/airbytehq/airbyte-agent-sdk'
    path: .codex/skills/bootstrapping-agent
    license_path: LICENSE
    commit: f20dbf71efa4f63cf57e2209049fd53c4c0f0614
---

# Bootstrapping an Agent with an Airbyte Connector

## Install the SDK

```bash
uv pip install airbyte-agent-sdk
```

A single `airbyte-agent-sdk` package bundles every typed connector. Import each one from `airbyte_agent_sdk.connectors.{slug}`. Note that `tool_utils`, `list_entities()`, and `entity_schema()` are available exclusively on typed connectors.

## Core Pattern (PydanticAI)

```python
import os
from pydantic_ai import Agent
from airbyte_agent_sdk import AirbyteAuthConfig
from airbyte_agent_sdk.connectors.stripe import StripeConnector

connector = StripeConnector(
    auth_config=AirbyteAuthConfig(
        airbyte_client_id=os.getenv("AIRBYTE_CLIENT_ID"),
        airbyte_client_secret=os.getenv("AIRBYTE_CLIENT_SECRET"),
        workspace_name=os.getenv("AIRBYTE_WORKSPACE_NAME", "default"),
    )
)

agent = Agent(
    "<provider:model>",
    system_prompt=(
        "You are a helpful assistant with access to Stripe. "
        "Use the stripe_execute tool to look up customer, invoice, and balance data. "
        "Ask for clarification if a request is ambiguous."
    ),
)

@agent.tool_plain
@StripeConnector.tool_utils
async def stripe_execute(entity: str, action: str, params: dict | None = None):
    return await connector.execute(entity, action, params or {})
```

**Always hosted mode**: Use `AirbyteAuthConfig` with `airbyte_client_id` and `airbyte_client_secret`. Do not generate local auth code under any circumstances.

## Decorator Stacking

The framework decorator sits on top; `tool_utils` goes beneath it:

```python
@agent.tool_plain           # Framework registers this as a tool
@StripeConnector.tool_utils # Enriches docstring with connector capabilities
async def stripe_execute(...):
```

`tool_utils` is a `@classmethod` — call `StripeConnector.tool_utils`, not `connector.tool_utils`.

### Automatic Retry Translation

`tool_utils` automatically converts retryable errors into the framework's retry signal (`ModelRetry` for pydantic-ai). The example above remains unchanged — the translation occurs inside `tool_utils` with no additional decorator required.

Reference demo: `connector-sdk/examples/demo_agent.py` (mocked, no credentials needed: `--mock`).

## Verify the Setup

```python
check = await connector.check()
if check.status == "healthy":
    print(f"Connected — checked {check.checked_entity}/{check.checked_action}")
else:
    print(f"Failed: {check.error}")
```

## Framework Detection

Identify the developer's framework from their existing imports:
- `from pydantic_ai import Agent` → Use PydanticAI patterns
- `from anthropic import Anthropic` → Use Claude SDK patterns
- If it cannot be determined, ask the developer which framework they are using

## Connector Naming Convention

Every connector is distributed in `airbyte-agent-sdk`. Import each one from `airbyte_agent_sdk.connectors.{slug}`:

| Connector | Import | Class |
|-----------|--------|-------|
| stripe | `airbyte_agent_sdk.connectors.stripe` | `StripeConnector` |
| zendesk-support | `airbyte_agent_sdk.connectors.zendesk_support` | `ZendeskSupportConnector` |
| hubspot | `airbyte_agent_sdk.connectors.hubspot` | `HubspotConnector` |

Hyphens in connector slugs are converted to underscores in the submodule path.

## Environment Variables

The developer must include the following entries in their `.env`:

```
AIRBYTE_CLIENT_ID=your_client_id
AIRBYTE_CLIENT_SECRET=your_client_secret
AIRBYTE_WORKSPACE_NAME=your_workspace_name
```

## References

- [SDK API reference](../airbyte-sdk-reference/sdk-api.md) — full API signatures and options
- [PydanticAI patterns](../airbyte-sdk-reference/pydantic-ai.md) — complete runnable examples
- [Claude SDK patterns](../airbyte-sdk-reference/claude-sdk.md) — Anthropic Python SDK examples
