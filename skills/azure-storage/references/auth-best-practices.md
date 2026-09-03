# Azure Authentication Best Practices

> Source: [Microsoft — Passwordless connections for Azure services](https://learn.microsoft.com/azure/developer/intro/passwordless-overview) and [Azure Identity client libraries](https://learn.microsoft.com/dotnet/azure/sdk/authentication/).

## Golden Rule

In production, rely on **managed identities** and **Azure RBAC**. Limit `DefaultAzureCredential` to **local development** environments only.

## Authentication by Environment

| Environment | Recommended Credential | Why |
|---|---|---|
| **Production (Azure-hosted)** | `ManagedIdentityCredential` (system- or user-assigned) | No secrets to manage; auto-rotated by Azure |
| **Production (on-premises)** | `ClientCertificateCredential` or `WorkloadIdentityCredential` | Deterministic; no fallback chain overhead |
| **CI/CD pipelines** | `AzurePipelinesCredential` / `WorkloadIdentityCredential` | Scoped to pipeline identity |
| **Local development** | `DefaultAzureCredential` | Chains CLI, PowerShell, and VS Code credentials for convenience |

## Why Not `DefaultAzureCredential` in Production?

1. **Unpredictable fallback chain** — iterates through multiple credential types, increasing latency and complicating failure diagnosis.
2. **Broad surface area** — inspects environment variables, CLI tokens, and other sources that should not be present in production.
3. **Non-deterministic** — the credential that actually succeeds varies by environment, producing inconsistent behavior across deployments.
4. **Performance** — every failed credential attempt incurs additional network round-trips before the chain advances to the next option.

## Production Patterns

### .NET

```csharp
using Azure.Identity;

var credential = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") == "Development"
    ? new DefaultAzureCredential()                          // local dev — uses CLI/VS credentials
    : new ManagedIdentityCredential();                      // production — deterministic, no fallback chain
// For user-assigned identity: new ManagedIdentityCredential("<client-id>")
```

### TypeScript / JavaScript

```typescript
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

const credential = process.env.NODE_ENV === "development"
  ? new DefaultAzureCredential()                          // local dev — uses CLI/VS credentials
  : new ManagedIdentityCredential();                      // production — deterministic, no fallback chain
// For user-assigned identity: new ManagedIdentityCredential("<client-id>")
```

### Python

```python
import os
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

credential = (
    DefaultAzureCredential()                              # local dev — uses CLI/VS credentials
    if os.getenv("AZURE_FUNCTIONS_ENVIRONMENT") == "Development"
    else ManagedIdentityCredential()                      # production — deterministic, no fallback chain
)
# For user-assigned identity: ManagedIdentityCredential(client_id="<client-id>")
```

### Java

```java
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.identity.ManagedIdentityCredentialBuilder;

var credential = "Development".equals(System.getenv("AZURE_FUNCTIONS_ENVIRONMENT"))
    ? new DefaultAzureCredentialBuilder().build()          // local dev — uses CLI/VS credentials
    : new ManagedIdentityCredentialBuilder().build();      // production — deterministic, no fallback chain
// For user-assigned identity: new ManagedIdentityCredentialBuilder().clientId("<client-id>").build()
```

## Local Development Setup

`DefaultAzureCredential` works well for local development because it automatically discovers credentials from common developer tools:

1. **Azure CLI** — `az login`
2. **Azure Developer CLI** — `azd auth login`
3. **Azure PowerShell** — `Connect-AzAccount`
4. **Visual Studio / VS Code** — sign in via Azure extension

```typescript
import { DefaultAzureCredential } from "@azure/identity";

// Local development only — uses CLI/PowerShell/VS Code credentials
const credential = new DefaultAzureCredential();
```

## Environment-Aware Pattern

Identify the runtime environment and choose the credential accordingly. The core principle: use `DefaultAzureCredential` only in local development; switch to a specific credential type in production.

> **Tip:** Azure Functions sets `AZURE_FUNCTIONS_ENVIRONMENT` to `"Development"` when running locally. For App Service or containers, use any environment variable under your control (e.g. `NODE_ENV`, `ASPNETCORE_ENVIRONMENT`).

```typescript
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

function getCredential() {
  if (process.env.NODE_ENV === "development") {
    return new DefaultAzureCredential();          // picks up az login / VS Code creds
  }
  return process.env.AZURE_CLIENT_ID
    ? new ManagedIdentityCredential(process.env.AZURE_CLIENT_ID)  // user-assigned
    : new ManagedIdentityCredential();                            // system-assigned
}
```

## Security Checklist

- [ ] Enable managed identity for every Azure-hosted application
- [ ] Never embed credentials, connection strings, or keys directly in code
- [ ] Assign least-privilege RBAC roles at the most narrow scope possible
- [ ] Use `ManagedIdentityCredential` (not `DefaultAzureCredential`) in production
- [ ] Store any secrets you must retain in Azure Key Vault
- [ ] Rotate secrets and certificates on a regular schedule
- [ ] Activate Microsoft Defender for Cloud on all production resources

## Further Reading

- [Passwordless connections overview](https://learn.microsoft.com/azure/developer/intro/passwordless-overview)
- [Managed identities overview](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
- [Azure RBAC overview](https://learn.microsoft.com/azure/role-based-access-control/overview)
- [.NET authentication guide](https://learn.microsoft.com/dotnet/azure/sdk/authentication/)
- [Python identity library](https://learn.microsoft.com/python/api/overview/azure/identity-readme)
- [JavaScript identity library](https://learn.microsoft.com/javascript/api/overview/azure/identity-readme)
- [Java identity library](https://learn.microsoft.com/java/api/overview/azure/identity-readme)
