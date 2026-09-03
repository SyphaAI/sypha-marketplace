# Authentication — Python SDK Quick Reference

> Summarized from **azure-identity-py**. Complete patterns (async,
> ChainedTokenCredential, token caching, all credential types)
> available in the **azure-identity-py** plugin skill if installed.

## Install
```bash
pip install azure-identity
```

## Quick Start
> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production patterns.

```python
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
```

## Best Practices
- Limit DefaultAzureCredential to **local development** (CLI, PowerShell, VS Code). In production, use ManagedIdentityCredential — see [auth-best-practices.md](../auth-best-practices.md)
- Do not embed credentials in code — rely on environment variables or managed identity instead
- Managed identity is the recommended approach for production Azure deployments
- Use ChainedTokenCredential when a custom credential resolution order is required
- Explicitly close async credentials or wrap them in context managers
- Set the AZURE_CLIENT_ID env var when working with user-assigned managed identities
- Disable credentials you are not using to reduce authentication startup time
