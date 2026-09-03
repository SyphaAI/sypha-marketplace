# Blob Storage — TypeScript SDK Quick Reference

> Distilled from **azure-storage-blob-ts**. Complete patterns (SAS generation,
> append/page blobs, streaming, browser uploads, error handling)
> are available in the **azure-storage-blob-ts** plugin skill if installed.

## Install
npm install @azure/storage-blob @azure/identity

## Quick Start
```typescript
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
const client = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, new DefaultAzureCredential());
```

## Best Practices
- Limit DefaultAzureCredential to **local development** — use ManagedIdentityCredential in production. See [auth-best-practices.md](../auth-best-practices.md)
- Stream large files instead of buffering them — use `uploadStream`/`downloadToFile` for files larger than 256MB
- Assign correct content types — call `setHTTPHeaders` to set the proper MIME type
- Issue SAS tokens for direct client access — generate short-lived tokens to authorize browser uploads
- Handle errors explicitly — inspect `RestError.statusCode` to apply error-specific logic
- Prefer `*IfNotExists` methods for idempotent container and blob creation
- Release client resources — dispose of clients properly in long-running applications
