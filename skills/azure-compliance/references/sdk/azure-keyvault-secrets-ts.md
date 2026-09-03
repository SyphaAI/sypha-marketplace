# Key Vault Secrets — TypeScript SDK Quick Reference

> A condensed reference derived from **azure-keyvault-secrets-ts**. The complete
> patterns (key rotation, cryptographic operations, backup/restore, wrap/unwrap)
> are available in the **azure-keyvault-secrets-ts** plugin skill when installed.

## Install
npm install @azure/keyvault-secrets @azure/identity

## Quick Start
```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
const client = new SecretClient("https://<vault>.vault.azure.net", new DefaultAzureCredential());
```

## Best Practices
- Reserve DefaultAzureCredential for **local development only**. For production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Turn on soft-delete — a requirement for production vaults
- Assign expiration dates to keys as well as secrets
- Apply key rotation policies — make key rotation automatic
- Restrict key operations — grant only the operations that are needed (encrypt, sign, etc.)
- No browser support — these SDKs run in Node.js only
