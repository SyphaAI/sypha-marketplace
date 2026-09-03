# Key Vault Keys — Java SDK Quick Reference

> A condensed reference derived from **azure-security-keyvault-keys-java**. The
> complete patterns (crypto operations, HSM keys, key rotation, backup/restore, import)
> are available in the **azure-security-keyvault-keys-java** plugin skill when installed.

## Install
```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-security-keyvault-keys</artifactId>
    <version>4.9.0</version>
</dependency>
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-identity</artifactId>
</dependency>
```

## Quick Start

> **Auth:** `DefaultAzureCredential` is intended for local development. For production patterns, refer to [auth-best-practices.md](../auth-best-practices.md).

```java
import com.azure.security.keyvault.keys.KeyClientBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
var keyClient = new KeyClientBuilder()
    .vaultUrl("https://<vault>.vault.azure.net")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
```

## Best Practices
- Use HSM keys in production — apply `setHardwareProtected(true)` to sensitive keys
- Turn on soft delete — shields keys from accidental deletion
- Key rotation — configure policies that rotate keys automatically
- Least privilege — dedicate separate keys to different operations
- Local crypto where possible — CryptographyClient with local key material cuts down on round-trips
