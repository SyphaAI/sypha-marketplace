# Blob Storage — Python SDK Quick Reference

> Distilled from **azure-storage-blob-py**. Complete patterns (SAS tokens,
> async client, performance tuning, blob properties/metadata)
> are available in the **azure-storage-blob-py** plugin skill if installed.

## Install
pip install azure-storage-blob azure-identity

## Quick Start
```python
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
blob_service_client = BlobServiceClient("https://<account>.blob.core.windows.net", DefaultAzureCredential())
```

## Best Practices
- Limit DefaultAzureCredential to **local development** — use ManagedIdentityCredential in production. See [auth-best-practices.md](../auth-best-practices.md)
- Always use context managers when working with async clients
- Pass `overwrite=True` explicitly when re-uploading an existing blob
- Set `max_concurrency` to improve throughput for large file transfers
- Prefer `readinto()` over `readall()` to reduce memory consumption
- Use `walk_blobs()` when iterating blobs in a hierarchical folder structure
- Assign appropriate content types to blobs that are served over the web
