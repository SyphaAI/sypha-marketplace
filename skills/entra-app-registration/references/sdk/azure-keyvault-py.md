# Key Vault — Python SDK Quick Reference

> Summarized from **azure-keyvault-py**. Complete patterns (async clients,
> cryptographic operations, certificate management, error handling)
> available in the **azure-keyvault-py** plugin skill if installed.

## Install
pip install azure-keyvault-secrets azure-keyvault-keys azure-keyvault-certificates azure-identity

## Quick Start
```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
client = SecretClient(vault_url="https://<vault>.vault.azure.net/", credential=DefaultAzureCredential())
```

## Best Practices
- Limit DefaultAzureCredential to **local development**. In production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Rely on managed identity for applications running in Azure
- Soft-delete is available for recovery and is active by default
- Prefer RBAC over access policies to achieve more granular control
- Regularly rotate secrets by taking advantage of versioning
- Reference Key Vault secrets directly from App Service/Functions configuration
- Cache secrets where appropriate to minimize API request volume
- Use async clients in scenarios requiring high throughput
