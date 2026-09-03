# Runtime Token Exchange (`fmi_path`)

Source: [Agent ID Setup Instructions](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-id-setup-instructions)

Agent Identities authenticate at runtime through a **two-step token exchange** against the Entra `/oauth2/v2.0/token` endpoint. This is a standard Entra capability — it operates anywhere (Azure, on-premises, local dev), not exclusively within Foundry.

```
Step 1: Blueprint credentials + fmi_path  →  Parent token (aud: api://AzureADTokenExchange)
Step 2: Parent token as client_assertion  →  Graph token (aud: https://graph.microsoft.com)
```

The `fmi_path` parameter directs the exchange to a specific Agent Identity, so the resulting Graph token carries `sub = <that Agent Identity's appId>` — providing each agent instance with a separate audit trail.

## Step 1: Get the parent token

```python
import json, urllib.parse, urllib.request

TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"

def get_parent_token(tenant_id: str, blueprint_app_id: str,
                     blueprint_secret: str, agent_identity_app_id: str) -> str:
    """Parent token scoped to a specific Agent Identity.

    tenant_id: the Agent Identity's home tenant (NOT the Blueprint's home
               tenant, if cross-tenant).
    """
    params = {
        "grant_type": "client_credentials",
        "client_id": blueprint_app_id,
        "client_secret": blueprint_secret,
        "scope": "api://AzureADTokenExchange/.default",
        "fmi_path": agent_identity_app_id,
    }
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL.format(tenant=tenant_id), data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())["access_token"]
```

The parent token carries:

| Claim | Value |
|-------|-------|
| `aud` | `api://AzureADTokenExchange` |
| `iss` | `https://login.microsoftonline.com/{tenant}/v2.0` |
| `sub` | Blueprint SP object ID |
| `appid` | Blueprint appId |
| `idtyp` | `app` |

This token cannot directly call Graph — it is an intermediate value used as `client_assertion` in step 2.

### Using MI + WIF for step 1

Substitute `client_secret` with a federated assertion obtained from a Managed Identity. The MI first acquires a token for `api://AzureADTokenExchange`, then submits it as `client_assertion`:

```python
from azure.identity import ManagedIdentityCredential

mi = ManagedIdentityCredential(client_id=MI_CLIENT_ID)
mi_token = mi.get_token("api://AzureADTokenExchange/.default").token

params = {
    "grant_type": "client_credentials",
    "client_id": BLUEPRINT_APP_ID,
    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    "client_assertion": mi_token,
    "scope": "api://AzureADTokenExchange/.default",
    "fmi_path": AGENT_IDENTITY_APP_ID,
}
```

Set up the FIC on the Blueprint first — see [oauth2-token-flow.md](oauth2-token-flow.md).

## Step 2a: Autonomous exchange (app-only permissions)

```python
def exchange_autonomous(tenant_id: str, agent_identity_app_id: str,
                        parent_token: str) -> dict:
    params = {
        "grant_type": "client_credentials",
        "client_id": agent_identity_app_id,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": parent_token,
        "scope": "https://graph.microsoft.com/.default",
    }
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL.format(tenant=tenant_id), data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())
```

The resulting token carries `sub = agent_identity_app_id` and `roles = <application permissions granted via appRoleAssignments>`.

## Step 2b: OBO exchange (delegated permissions)

Merges the parent token with a user token to produce a delegated Graph token scoped to whatever actions the Agent Identity is permitted to take on behalf of the user.

Prerequisites: the Blueprint must be configured as an OAuth2 API ([obo-blueprint-setup.md](obo-blueprint-setup.md)) and the Agent Identity must have `oauth2PermissionGrants` covering the required scopes.

```python
def exchange_obo(tenant_id: str, agent_identity_app_id: str,
                 parent_token: str, user_token: str) -> dict:
    params = {
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "client_id": agent_identity_app_id,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": parent_token,
        "assertion": user_token,
        "requested_token_use": "on_behalf_of",
        "scope": "https://graph.microsoft.com/.default",
    }
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL.format(tenant=tenant_id), data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())
```

The resulting token carries `sub = agent_identity_app_id` and `scp = <delegated scopes granted via oauth2PermissionGrants>`.

The user token MUST have the Blueprint as its audience (`api://{blueprint_app_id}/access_as_user`). If it targets Graph instead, step 2b returns `AADSTS50013: Assertion failed signature validation`.

## Cross-Tenant Exchange

Blueprints may be multi-tenant (`signInAudience: AzureADMultipleOrgs`). The BlueprintPrincipal and Agent Identity both reside in the target tenant.

> **Step 1 MUST target the Agent Identity's home tenant.** Wrong tenant ⇒ `AADSTS700211: No matching federated identity record found`.

```python
# Blueprint in Tenant A, Agent Identity in Tenant B.

# CORRECT — step 1 targets Tenant B
parent = get_parent_token(
    tenant_id=TENANT_B,
    blueprint_app_id=BLUEPRINT_APP_ID,
    blueprint_secret=SECRET,
    agent_identity_app_id=AGENT_APP_ID,
)

# WRONG — step 1 targets Tenant A (Blueprint's tenant)
# Parent token issuer won't match FIC; step 2 → AADSTS700211
```

Step 2 likewise targets Tenant B, using the correctly issued parent token.

## Key Rules

- Apply `/.default` scope in **both** steps. Individual scopes such as `User.Read Mail.Send` will fail.
- Use `client_credentials` together with `fmi_path` — do NOT use `urn:ietf:params:oauth:grant-type:token-exchange` (which returns `AADSTS82001`).
- `fmi_path` must be the Agent Identity's **appId**, not its SP object ID.
- Autonomous and OBO flows share the same step 1; only the grant type in step 2 differs.
- For cross-tenant scenarios: the step 1 tenant must equal the Agent Identity's home tenant.
