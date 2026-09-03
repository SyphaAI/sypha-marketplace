# Azure Authentication Best Practices

> Source: [Microsoft — Passwordless connections for Azure services](https://learn.microsoft.com/azure/developer/intro/passwordless-overview) and [Azure Identity client libraries](https://learn.microsoft.com/dotnet/azure/sdk/authentication/).

## Golden Rule

In production, rely on **managed identities** with **Azure RBAC**. Keep `DefaultAzureCredential` for **local development only**.

## Authentication by Environment

| Environment | Recommended Credential | Why |
|---|---|---|
| **Production (Azure-hosted)** | `ManagedIdentityCredential` (system- or user-assigned) | No secrets to look after; Azure rotates them automatically |
| **Production (on-premises)** | `ClientCertificateCredential` or `WorkloadIdentityCredential` | Deterministic; avoids fallback-chain overhead |
| **CI/CD pipelines** | `AzurePipelinesCredential` / `WorkloadIdentityCredential` | Tied to the pipeline's identity |
| **Local development** | `DefaultAzureCredential` | Conveniently chains CLI, PowerShell, and VS Code credentials |

## Why Not `DefaultAzureCredential` in Production?

1. **Unpredictable fallback chain** — it iterates over several credential types, which adds latency and makes failures harder to troubleshoot.
2. **Broad surface area** — it inspects environment variables, CLI tokens, and other sources that have no place in production.
3. **Non-deterministic** — the credential that ends up authenticating varies with the environment, so behavior differs between deployments.
4. **Performance** — every credential that fails costs extra network round-trips before the next one is tried.

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

For local development `DefaultAzureCredential` is a great fit, since it picks up credentials from developer tooling automatically:

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

Detect which environment the code is running in and pick the matching credential. The core principle: reach for `DefaultAzureCredential` only on a local machine, and use an explicit credential in production.

> **Tip:** When running locally, Azure Functions sets `AZURE_FUNCTIONS_ENVIRONMENT` to `"Development"`. On App Service or in containers, rely on any environment variable under your control (e.g. `NODE_ENV`, `ASPNETCORE_ENVIRONMENT`).

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

- [ ] Every Azure-hosted app uses managed identity
- [ ] No hardcoded credentials, connection strings, or keys anywhere
- [ ] RBAC roles follow least privilege and are scoped as narrowly as possible
- [ ] Production uses `ManagedIdentityCredential` (never `DefaultAzureCredential`)
- [ ] Any secrets that remain necessary live in Azure Key Vault
- [ ] Secrets and certificates are rotated on a schedule
- [ ] Microsoft Defender for Cloud is enabled on production resources

## Further Reading

- [Passwordless connections overview](https://learn.microsoft.com/azure/developer/intro/passwordless-overview)
- [Managed identities overview](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
- [Azure RBAC overview](https://learn.microsoft.com/azure/role-based-access-control/overview)
- [.NET authentication guide](https://learn.microsoft.com/dotnet/azure/sdk/authentication/)
- [Python identity library](https://learn.microsoft.com/python/api/overview/azure/identity-readme)
- [JavaScript identity library](https://learn.microsoft.com/javascript/api/overview/azure/identity-readme)
- [Java identity library](https://learn.microsoft.com/java/api/overview/azure/identity-readme)
