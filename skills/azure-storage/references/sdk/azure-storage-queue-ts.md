# Queue Storage — TypeScript SDK Quick Reference

> Condensed from **azure-storage-queue-ts**. Full patterns (SAS generation,
> poison message handling, visibility extension, message encoding)
> in the **azure-storage-queue-ts** plugin skill if installed.

## Install
npm install @azure/storage-queue @azure/identity

## Quick Start
```typescript
import { QueueServiceClient } from "@azure/storage-queue";
import { DefaultAzureCredential } from "@azure/identity";
const client = new QueueServiceClient(`https://${accountName}.queue.core.windows.net`, new DefaultAzureCredential());
```

## Best Practices
- Use DefaultAzureCredential for **local development only** — switch to ManagedIdentityCredential in production. See [auth-best-practices.md](../auth-best-practices.md)
- Delete messages after processing — avoids duplicate handling
- Handle poison messages — route repeatedly failing messages to a dead-letter queue
- Set a visibility timeout that matches expected processing duration
- Extend visibility for long-running tasks — update the message before it times out
- Use JSON for structured data — serialize objects to JSON strings before enqueuing
- Monitor dequeueCount — flag messages that keep failing
- Receive multiple messages at once — batch receive improves throughput efficiency
