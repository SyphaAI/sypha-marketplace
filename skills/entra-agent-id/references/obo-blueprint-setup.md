# OBO Blueprint Setup

To operate in **OBO (on-behalf-of)** mode — where an agent acts on behalf of a user — the Blueprint must be set up as an OAuth2 API so the user's token can address it as the audience.

## Configure the Blueprint as an API

Apply once via `PATCH /applications/{blueprint_obj_id}`:

```python
import uuid

scope_id = str(uuid.uuid4())
patch = {
    "identifierUris": [f"api://{blueprint_app_id}"],
    "api": {
        "requestedAccessTokenVersion": 2,
        "oauth2PermissionScopes": [{
            "id": scope_id,
            "adminConsentDescription": "Allow the app to access the agent API on behalf of the user.",
            "adminConsentDisplayName": "Access agent API",
            "userConsentDescription": "Allow the app to access the agent API on your behalf.",
            "userConsentDisplayName": "Access agent API",
            "value": "access_as_user",
            "type": "User",
            "isEnabled": True,
        }],
        "preAuthorizedApplications": [{
            "appId": client_app_id,   # Your front-end or CLI app's appId
            "permissionIds": [scope_id],
        }],
    },
    "optionalClaims": {
        "accessToken": [{
            "name": "idtyp",
            "source": None,
            "essential": False,
            "additionalProperties": ["include_user_token"],
        }]
    },
}
requests.patch(
    f"{GRAPH}/applications/{blueprint_obj_id}",
    headers=headers, json=patch,
).raise_for_status()
```

All four elements are mandatory:

1. **`identifierUris`** — establishes `api://{appId}` as the audience.
2. **`oauth2PermissionScopes`** — declares the `access_as_user` scope that users can consent to.
3. **`preAuthorizedApplications`** — grants authorization to your client app and bypasses the consent prompt.
4. **`optionalClaims`** — emits the `idtyp` claim required for token-type validation.

## Grant Delegated Permissions to Each Agent Identity

Every Agent Identity requires `oauth2PermissionGrants` that specify which Graph delegated permissions it is allowed to exercise on behalf of users:

```python
from datetime import datetime, timedelta, timezone

expiry = (datetime.now(timezone.utc) + timedelta(days=3650)).strftime("%Y-%m-%dT%H:%M:%SZ")

requests.post(
    f"{GRAPH}/oauth2PermissionGrants",
    headers=headers,
    json={
        "clientId": agent_sp_id,     # Agent Identity SP object ID
        "consentType": "AllPrincipals",
        "resourceId": graph_sp_id,   # Microsoft Graph SP object ID
        "scope": "User.Read Tasks.ReadWrite",
        "expiryTime": expiry,
    },
).raise_for_status()
```

## Acquire the User Token — Targeting the Blueprint

```python
from azure.identity import InteractiveBrowserCredential

credential = InteractiveBrowserCredential(
    tenant_id=tenant_id,
    client_id=client_app_id,   # Your client app, NOT the Blueprint
    redirect_uri="http://localhost:8400",
)
user_token = credential.get_token(f"api://{blueprint_app_id}/access_as_user")
```

> If the user token targets `https://graph.microsoft.com` instead of the Blueprint, the OBO exchange returns `AADSTS50013: Assertion failed signature validation`.

Then pass `user_token.token` into `exchange_obo(...)` from [runtime-token-exchange.md](runtime-token-exchange.md).

## Per-Agent Scoping

Individual agents can operate within distinct permission boundaries:

```python
AGENT_SCOPES = {
    "it-helpdesk":   "User.Read Tasks.ReadWrite",
    "comms-agent":   "User.Read Mail.Send Calendars.ReadWrite",
    "hr-onboarding": "User.Read User.ReadBasic.All",
}

for agent_name, scopes in AGENT_SCOPES.items():
    grant_delegated(agent_identities[agent_name], scopes)
```

## Key Rules (OBO)

- **User token audience = Blueprint** (`api://{blueprint_app_id}/access_as_user`), not Graph.
- **Use `/.default` scope** during the OBO exchange step.
- **`expiryTime` is mandatory** on `oauth2PermissionGrants` for Agent Identity grants.
- **Browser-based admin consent URLs are not supported** for Agent Identities — use the `oauth2PermissionGrants` API for programmatic consent instead.
- **`Group.ReadWrite.All`** is not available as a delegated permission for Agent Identities. `Tasks.ReadWrite` by itself covers Planner task operations.
- Not all Graph scopes are permitted for Agent Identities — validate each new scope before use.
