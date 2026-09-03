# Key Vault Keys — TypeScript SDK Quick Reference

> A condensed version of **azure-keyvault-keys-ts**. The complete patterns (crypto operations,
> key rotation policies, backup/restore, CryptographyClient)
> live in the **azure-keyvault-keys-ts** plugin skill when it is installed.

## Install
npm install @azure/keyvault-keys @azure/identity

## Quick Start
```typescript
import { KeyClient } from "@azure/keyvault-keys";
import { DefaultAzureCredential } from "@azure/identity";
const keyClient = new KeyClient(`https://${vaultName}.vault.azure.net`, new DefaultAzureCredential());
```

## Best Practices
- Reserve DefaultAzureCredential for **local development only**. Production should use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Turn on soft-delete — production vaults require it
- Give keys expiration dates
- Apply key rotation policies — they automate key rotation
- Restrict key operations — grant only the operations needed (encrypt, sign, etc.)
- No browser support — this SDK runs on Node.js only
