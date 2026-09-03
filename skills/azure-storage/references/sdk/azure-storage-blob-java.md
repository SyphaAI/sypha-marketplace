# Blob Storage — Java SDK Quick Reference

> Distilled from **azure-storage-blob-java**. Complete patterns (SAS tokens,
> streaming, lease management, parallel uploads, proxy config)
> are available in the **azure-storage-blob-java** plugin skill if installed.

## Install
```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-storage-blob</artifactId>
    <version>12.33.0</version>
</dependency>
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-identity</artifactId>
</dependency>
```

## Quick Start
```java
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
var serviceClient = new BlobServiceClientBuilder()
    .endpoint("<storage-account-url>")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
```

## Best Practices
- Limit DefaultAzureCredential to **local development** — use ManagedIdentityCredential in production. See [auth-best-practices.md](../auth-best-practices.md)
- Use `BinaryData.fromString()` when uploading string content
- Use `createIfNotExists()` for idempotent container creation
- Use `BlobParallelUploadOptions` when uploading large files that require custom headers or metadata
- Use `BlobInputStream`/`BlobOutputStream` to stream large blobs without buffering them entirely in memory
- Catch `BlobStorageException` and inspect `getStatusCode()` and `getErrorCode()` for error details
