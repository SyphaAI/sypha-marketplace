# Key Vault — Python SDK Quick Reference

> A condensed version of **azure-keyvault-py**. The complete patterns (async clients,
> cryptographic operations, certificate management, error handling)
> live in the **azure-keyvault-py** plugin skill when it is installed.

## Install
pip install azure-keyvault-secrets azure-keyvault-keys azure-keyvault-certificates azure-identity

## Quick Start
```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
client = SecretClient(vault_url="https://<vault>.vault.azure.net/", credential=DefaultAzureCredential())
```

## Best Practices
- Reserve DefaultAzureCredential for **local development only**. Production should use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Rely on managed identity for apps hosted in Azure
- Turn on soft-delete for recovery (it is on by default)
- Prefer RBAC to access policies for fine-grained control
- Rotate secrets on a regular basis, leaning on versioning
- Reference Key Vault entries in App Service/Functions config
- Cache secrets sensibly so API call volume stays low
- Reach for async clients when throughput demands are high
