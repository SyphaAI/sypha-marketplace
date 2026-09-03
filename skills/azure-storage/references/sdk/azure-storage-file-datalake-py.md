# Data Lake Storage Gen2 — Python SDK Quick Reference

> Distilled from **azure-storage-file-datalake-py**. Complete patterns (ACL management,
> async client, directory operations, range downloads)
> are available in the **azure-storage-file-datalake-py** plugin skill if installed.

## Install
pip install azure-storage-file-datalake azure-identity

## Quick Start

> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production credential patterns.

```python
from azure.storage.filedatalake import DataLakeServiceClient
from azure.identity import DefaultAzureCredential
service_client = DataLakeServiceClient("https://<account>.dfs.core.windows.net", DefaultAzureCredential())
```

## Best Practices
- Enable the hierarchical namespace to obtain file system semantics
- Upload large files using `append_data` followed by `flush_data`
- Define ACLs at the directory level and allow children to inherit them
- Switch to the async client for high-throughput workloads
- Call `get_paths` with `recursive=True` to enumerate an entire directory tree
- Attach metadata to files to store custom attributes
- For straightforward object storage scenarios, the Blob API may be a simpler choice

## Non-Obvious Patterns
```python
# Large file upload requires append + flush
offset = 0
for chunk in chunks:
	file_client.append_data(data=chunk, offset=offset, length=len(chunk))
	offset += len(chunk)
file_client.flush_data(offset)
```
