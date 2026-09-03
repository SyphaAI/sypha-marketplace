# Key Vault Secrets — TypeScript SDK Quick Reference

> Summarized from **azure-keyvault-secrets-ts**. Complete patterns (key rotation,
> cryptographic operations, backup/restore, wrap/unwrap)
> available in the **azure-keyvault-secrets-ts** plugin skill if installed.

## Install
npm install @azure/keyvault-secrets @azure/identity

## Quick Start
```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
const client = new SecretClient("https://<vault>.vault.azure.net", new DefaultAzureCredential());
```

## Best Practices
- Limit DefaultAzureCredential to **local development**. In production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Soft-delete must be enabled on production vaults
- Always configure expiration dates for both keys and secrets
- Define key rotation policies to keep rotation automated
- Restrict key operations to only what is actually required (encrypt, sign, etc.)
- Browser environments are not supported — these SDKs target Node.js only
