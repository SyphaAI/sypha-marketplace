# Blob Storage — Rust SDK Quick Reference

> Distilled from **azure-storage-blob-rust**. Complete patterns (container ops,
> blob properties, RBAC permissions)
> are available in the **azure-storage-blob-rust** plugin skill if installed.

## Install
cargo add azure_storage_blob azure_identity

## Quick Start
```rust
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobClient;
let credential = DeveloperToolsCredential::new(None)?;
let blob_client = BlobClient::new("https://<account>.blob.core.windows.net/", "container", "blob", Some(credential), None)?;
```

## Best Practices
- Authenticate via Entra ID — use `DeveloperToolsCredential` for development and `ManagedIdentityCredential` in production
- Always provide the content length — it is required for upload operations
- Wrap upload data with `RequestContent::from()` before passing it to the SDK
- Drive async operations with the `tokio` runtime
- Verify RBAC assignments — the identity must hold the "Storage Blob Data Contributor" role

## Non-Obvious Patterns
```rust
use azure_core::http::RequestContent;
blob_client.upload(RequestContent::from(data.to_vec()), false, u64::try_from(data.len())?, None).await?;
```
