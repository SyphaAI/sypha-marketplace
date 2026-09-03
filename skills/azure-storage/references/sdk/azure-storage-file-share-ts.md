# File Shares — TypeScript SDK Quick Reference

> Condensed from **azure-storage-file-share-ts**. Full patterns (SAS generation,
> snapshots, range operations, streaming, copy operations)
> in the **azure-storage-file-share-ts** plugin skill if installed.

## Install
npm install @azure/storage-file-share @azure/identity

## Quick Start
```typescript
import { ShareServiceClient } from "@azure/storage-file-share";
import { DefaultAzureCredential } from "@azure/identity";
const client = new ShareServiceClient(`https://${accountName}.file.core.windows.net`, new DefaultAzureCredential());
```

## Best Practices
- Connection strings work well for simplicity during development
- Use DefaultAzureCredential for **local development only** — switch to ManagedIdentityCredential in production. See [auth-best-practices.md](../auth-best-practices.md)
- Apply quotas on shares to guard against unexpected storage charges
- Stream large files — use `uploadStream`/`downloadToFile` for files exceeding 256MB
- Prefer ranges for partial updates — more efficient than replacing the full file
- Take snapshots before significant changes for point-in-time recovery
- Handle errors properly — inspect `RestError.statusCode` for targeted error handling
- Prefer `*IfExists` methods to keep operations idempotent
