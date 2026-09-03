# Queue Storage — Python SDK Quick Reference

> Condensed from **azure-storage-queue-py**. Full patterns (async client,
> base64 encoding, queue properties, message updates)
> in the **azure-storage-queue-py** plugin skill if installed.

## Install
pip install azure-storage-queue azure-identity

## Quick Start

> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production auth patterns.

```python
from azure.storage.queue import QueueClient
from azure.identity import DefaultAzureCredential
queue_client = QueueClient("https://<account>.queue.core.windows.net", "myqueue", DefaultAzureCredential())
```

## Best Practices
- Remove messages after processing to avoid reprocessing them
- Choose a visibility timeout that reflects actual processing time
- Track `dequeue_count` to identify poison messages
- Switch to the async client for high-throughput workloads
- Use `peek_messages` for monitoring without altering queue state
- Set `time_to_live` to avoid accumulating stale messages
- Evaluate Service Bus when advanced capabilities like sessions or topics are required
