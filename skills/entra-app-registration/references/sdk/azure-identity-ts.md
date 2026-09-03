# Authentication — TypeScript SDK Quick Reference

> Summarized from **azure-identity-ts**. Complete patterns (sovereign clouds,
> device code flow, custom credentials, bearer token provider)
> available in the **azure-identity-ts** plugin skill if installed.

## Install
npm install @azure/identity

## Quick Start
> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production patterns.

```typescript
import { DefaultAzureCredential } from "@azure/identity";
const credential = new DefaultAzureCredential();
```

## Best Practices
- Restrict DefaultAzureCredential to **local development** (CLI, PowerShell, VS Code). In production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Avoid embedding credentials in code — rely on environment variables or managed identity
- Managed identity is preferred in production — no secrets need to be maintained
- Select the appropriate credential scope — user-assigned identity suits multi-tenant scenarios
- Token refresh is handled automatically by the Azure SDK
- Use ChainedTokenCredential when you need a custom credential fallback chain
