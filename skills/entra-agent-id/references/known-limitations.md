# Known Limitations

Source: [Microsoft Entra Agent ID — known issues and gaps](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/preview-known-issues)

## API & Object Model

1. **Sponsors must be Users at Blueprint creation** — ServicePrincipals and Groups are not accepted as Blueprint sponsors. (Agent Identity sponsors may be Users or Groups.)
2. **BlueprintPrincipal is not created automatically** — an explicit `POST /servicePrincipals/microsoft.graph.agentIdentityBlueprintPrincipal` is required after Blueprint creation.
3. **Agent Identities cannot hold password credentials** — credentials must reside on the Blueprint only (`PropertyNotCompatibleWithAgentIdentity`).
4. **Agent Identities have no backing application object** — they are service-principal-only entities.
5. **Blueprint requires explicit `identifierUris`** — not set by default; needed for OAuth2 scope resolution (`api://{app-id}/.default`).
6. **No Graph relationship filtering for Agent IDs** — `/ownedObjects`, `/deletedItems`, `/owners` return all object types; perform client-side filtering by `odata.type`.
7. **Orphaned agent users after deletion** — deleting a Blueprint or identity does NOT automatically remove its agent users; clean them up manually via the admin center or Graph API.

## Roles & Permissions

8. **`Directory.AccessAsUser.All` is hard-rejected** — when present on the client, all other Agent ID delegated permissions are ignored, resulting in a 403 Forbidden.
9. **No viable delegated permission for creating Agent Identities** — application permissions must be used instead.
10. **No quick-start permission bundle** — 18+ individual Agent Identity permissions must be discovered and granted separately.
11. **Permission propagation delay** — tokens may not include new claims for 30–120+ seconds after admin consent; prefer delegated permissions and implement exponential backoff retries.
12. **Global Reader cannot list Agent Identities** — `GET /servicePrincipals/microsoft.graph.agentIdentity` returns 403; use `GET /servicePrincipals` with client-side filtering instead.
13. **Custom roles cannot include Agent ID actions** — use built-in roles (Agent ID Administrator, Agent ID Developer).
14. **Administrative units not supported** — Agent Identities, Blueprints, and BlueprintPrincipals cannot be added to admin units; use `owners` as an alternative.
15. **Agent ID Admin cannot update agent-user photos** — a User Administrator role is required for this.

## Admin Center & Management

16. **Blueprint management is not available in the Entra admin center** — use Microsoft Graph or PowerShell instead.
17. **`/me` endpoint is unavailable** in the `client_credentials` flow — use `az ad signed-in-user show` or Graph delegated permissions to obtain user context.

## Authentication & Consent

18. **No SSO to web apps** — Agent IDs cannot authenticate via Entra ID sign-in pages (neither OpenID Connect nor SAML is supported); use web APIs instead.
19. **Admin consent workflow (ACW) is broken** for permissions requested by Agent IDs — contact the tenant admin directly.
20. **App permissions cannot be granted to BlueprintPrincipals** — grant permissions to individual Agent Identities instead.
21. **App roles cannot target an Agent Identity as a resource** — use the BlueprintPrincipal as the target resource.
22. **Risk-based step-up silently blocks consent** — no "risky" indication appears in the UX.

## Groups, Logs & Monitoring

23. **Dynamic group membership is not supported** — Agent Identities and agent users cannot be members of dynamic groups; use security groups with static membership instead.
24. **Audit logs do not differentiate Agent IDs** — operations on Blueprints and identities are logged as `ApplicationManagement`, while agent user operations appear as `User Management`; cross-reference object IDs via Graph to determine the entity type.
25. **Graph activity logs do not differentiate Agent IDs** — agent-identity requests appear as applications and agent-user requests as users; join with sign-in logs to correlate.

## Performance & Scale

26. **Sequential creation requests may fail** — issuing Blueprint → Principal → Identity requests in rapid succession can return `400 Bad Request: Object with id {id} not found`, particularly when using application permissions. Prefer delegated permissions and add exponential backoff.

## Product Integrations

27. **Copilot Studio** — only custom engine agents are supported; Agent IDs are used for channel authentication only (not for connectors or tools).
28. **MSAL complexity** — Agent ID scenarios require manual management of Federated Identity Credentials. For .NET use [Microsoft.Identity.Web.AgentIdentities](https://github.com/AzureAD/microsoft-identity-web/blob/master/src/Microsoft.Identity.Web.AgentIdentities/README.AgentIdentities.md). For other languages use the [Microsoft Entra SDK for AgentID](https://learn.microsoft.com/en-us/entra/msidweb/agent-id-sdk/overview).

## Reporting Issues

Submit unlisted issues at [aka.ms/agentidfeedback](https://aka.ms/agentidfeedback).
