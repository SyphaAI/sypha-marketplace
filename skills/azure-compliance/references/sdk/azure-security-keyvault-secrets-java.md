# Key Vault Secrets — Java SDK Quick Reference

> A condensed reference derived from **azure-security-keyvault-secrets-java**. The
> complete patterns (async client, secret rotation, backup/restore, config loader)
> are available in the **azure-security-keyvault-secrets-java** plugin skill when installed.

## Install
```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-security-keyvault-secrets</artifactId>
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
import com.azure.security.keyvault.secrets.SecretClientBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
var secretClient = new SecretClientBuilder()
    .vaultUrl("https://<vault>.vault.azure.net")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
```

## Best Practices
- Turn on soft delete — shields secrets from accidental deletion
- Apply tags — label secrets with environment, service, owner
- Configure expiration — call `setExpiresOn()` for credentials that should rotate
- Content type — populate contentType to signal the format (e.g., application/json)
- Version management — avoid removing old versions right away during rotation
- Access logging — turn on diagnostic logging for Key Vault
- Least privilege — keep different environments in separate vaults
