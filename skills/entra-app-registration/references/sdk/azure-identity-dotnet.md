# Authentication — .NET SDK Quick Reference

> Summarized from **azure-identity-dotnet**. Complete patterns (ASP.NET DI,
> sovereign clouds, brokered auth, certificate credentials)
> available in the **azure-identity-dotnet** plugin skill if installed.

## Install
dotnet add package Azure.Identity

## Quick Start
> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production patterns.

```csharp
using Azure.Identity;
var credential = new DefaultAzureCredential();
```

## Best Practices
- Limit DefaultAzureCredential to **local development**. For production, use deterministic credentials (ManagedIdentityCredential) — see [auth-best-practices.md](../auth-best-practices.md)
- Share credential instances across clients rather than creating new ones
- Apply retry policies to credential operations
- Turn on logging via AzureEventSourceListener when troubleshooting auth issues
