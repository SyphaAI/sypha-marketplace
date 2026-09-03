# Azure Authentication Best Practices

> Source: [Microsoft — Passwordless connections for Azure services](https://learn.microsoft.com/azure/developer/intro/passwordless-overview) and [Azure Identity client libraries](https://learn.microsoft.com/dotnet/azure/sdk/authentication/).

## Golden Rule

Rely on **managed identities** and **Azure RBAC** in production. Keep `DefaultAzureCredential` for **local development only**.

## Authentication by Environment

| Environment | Recommended Credential | Why |
|---|---|---|
| **Production (Azure-hosted)** | `ManagedIdentityCredential` (system- or user-assigned) | No secrets to manage; auto-rotated by Azure |
| **Production (on-premises)** | `ClientCertificateCredential` or `WorkloadIdentityCredential` | Deterministic; no fallback chain overhead |
| **CI/CD pipelines** | `AzurePipelinesCredential` / `WorkloadIdentityCredential` | Scoped to pipeline identity |
| **Local development** | `DefaultAzureCredential` | Chains CLI, PowerShell, and VS Code credentials for convenience |

## Why Not `DefaultAzureCredential` in Production?

1. **Unpredictable fallback chain** — it cycles through multiple credential types, increasing latency and making failures more difficult to diagnose.
2. **Wide surface area** — it inspects environment variables, CLI tokens, and other sources that should not be present in production.
3. **Non-deterministic** — the credential that actually succeeds varies by environment, causing inconsistent behavior across deployments.
4. **Performance overhead** — every failed credential attempt incurs additional network round-trips before the next one is tried.

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

`DefaultAzureCredential` is well suited for local development because it automatically detects credentials from developer tools:

1. **Azure CLI** — `az login`
2. **Azure Developer CLI** — `azd auth login`
3. **Azure PowerShell** — `Connect-AzAccount`
4. **Visual Studio / VS Code** — sign in through the Azure extension

```typescript
import { DefaultAzureCredential } from "@azure/identity";

// Local development only — uses CLI/PowerShell/VS Code credentials
const credential = new DefaultAzureCredential();
```

## Environment-Aware Pattern

Identify the runtime environment and choose the appropriate credential accordingly. The guiding principle is: use `DefaultAzureCredential` only for local runs, and a specific credential when deployed to production.

> **Tip:** Azure Functions sets `AZURE_FUNCTIONS_ENVIRONMENT` to `"Development"` during local execution. For App Service or containers, use any environment variable you control (e.g. `NODE_ENV`, `ASPNETCORE_ENVIRONMENT`).

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

- [ ] Use managed identity for all Azure-hosted apps
- [ ] Never hardcode credentials, connection strings, or keys
- [ ] Apply least-privilege RBAC roles at the narrowest scope
- [ ] Use `ManagedIdentityCredential` (not `DefaultAzureCredential`) in production
- [ ] Store any required secrets in Azure Key Vault
- [ ] Rotate secrets and certificates on a schedule
- [ ] Enable Microsoft Defender for Cloud on production resources

## Further Reading

- [Passwordless connections overview](https://learn.microsoft.com/azure/developer/intro/passwordless-overview)
- [Managed identities overview](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
- [Azure RBAC overview](https://learn.microsoft.com/azure/role-based-access-control/overview)
- [.NET authentication guide](https://learn.microsoft.com/dotnet/azure/sdk/authentication/)
- [Python identity library](https://learn.microsoft.com/python/api/overview/azure/identity-readme)
- [JavaScript identity library](https://learn.microsoft.com/javascript/api/overview/azure/identity-readme)
- [Java identity library](https://learn.microsoft.com/java/api/overview/azure/identity-readme)
