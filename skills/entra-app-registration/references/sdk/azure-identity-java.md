# Authentication — Java SDK Quick Reference

> Summarized from **azure-identity-java**. Complete patterns (workload identity,
> certificate auth, device code, sovereign clouds)
> available in the **azure-identity-java** plugin skill if installed.

## Install
```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-identity</artifactId>
    <version>1.15.0</version>
</dependency>
```

## Quick Start
> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production patterns.

```java
import com.azure.identity.DefaultAzureCredentialBuilder;
var credential = new DefaultAzureCredentialBuilder().build();
```

## Best Practices
- Restrict DefaultAzureCredential to **local development** (CLI, PowerShell, VS Code). In production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Managed identity in production — eliminates secret management and enables automatic rotation
- Azure CLI for local dev — execute `az login` before starting your application
- Least privilege — assign only the permissions that service principals actually need
- Token caching — active by default, cuts down on authentication round-trips
- Environment variables — appropriate for CI/CD; never substitute for hardcoded secrets
