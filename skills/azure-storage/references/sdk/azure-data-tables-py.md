# Tables — Python SDK Quick Reference

> Distilled from **azure-data-tables-py**. Complete patterns (batch operations,
> async client, typed entities, query parameters)
> are available in the **azure-data-tables-py** plugin skill if installed.

## Install
pip install azure-data-tables azure-identity

## Quick Start

> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production credential patterns.

```python
from azure.data.tables import TableClient
from azure.identity import DefaultAzureCredential
table_client = TableClient("https://<account>.table.core.windows.net", "mytable", DefaultAzureCredential())
```

## Best Practices
- Design partition keys around your query patterns and to achieve even data distribution
- Prefer intra-partition queries over cross-partition scans (cross-partition queries are costly)
- Group multiple entity changes in the same partition using batch operations
- Prefer `upsert_entity` for writes that must be idempotent
- Use parameterized queries to guard against injection attacks
- Keep entities compact — the maximum is 1MB per entity
- Adopt the async client for high-throughput use cases
