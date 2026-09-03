# File Shares — Python SDK Quick Reference

> Condensed from **azure-storage-file-share-py**. Full patterns (async client,
> snapshots, range operations, copy, SAS tokens)
> in the **azure-storage-file-share-py** plugin skill if installed.

## Install
pip install azure-storage-file-share azure-identity

## Quick Start

> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production auth patterns.

```python
from azure.storage.fileshare import ShareServiceClient
from azure.identity import DefaultAzureCredential
service = ShareServiceClient("https://<account>.file.core.windows.net", DefaultAzureCredential())
```

## Best Practices
- A connection string offers the simplest setup path
- Prefer Entra ID with RBAC for production environments
- Avoid memory issues with large files by streaming via chunks()
- Take snapshots prior to making significant changes
- Apply quotas to avoid unexpected storage charges
- Use ranges when performing partial file updates
- Always close async clients explicitly
