# Key Vault Keys — .NET SDK Quick Reference

> A condensed reference derived from **azure-security-keyvault-keys-dotnet**. The
> complete patterns (crypto operations, key rotation, backup/restore, HSM, KeyResolver)
> are available in the **azure-security-keyvault-keys-dotnet** plugin skill when installed.

## Install
dotnet add package Azure.Security.KeyVault.Keys
dotnet add package Azure.Identity

## Quick Start
```csharp
using Azure.Security.KeyVault.Keys;
using Azure.Identity;
var client = new KeyClient(new Uri("https://<vault>.vault.azure.net"), new DefaultAzureCredential());
```

## Best Practices
- Reserve DefaultAzureCredential for **local development only**. For production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Turn on soft-delete — guards against accidental deletion
- Choose HSM-backed keys — set `HardwareProtected = true` for sensitive keys
- Rotate keys — rely on automatic rotation policies
- Restrict key operations — enable only the KeyOperations you require
- Configure expiration dates — always set ExpiresOn for keys
- Reference explicit versions — pin to versions in production
- Cache the CryptographyClient — reuse it across multiple operations
