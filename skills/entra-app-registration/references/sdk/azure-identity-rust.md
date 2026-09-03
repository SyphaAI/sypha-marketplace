# Authentication — Rust SDK Quick Reference

> Summarized from **azure-identity-rust**. Complete patterns (ClientSecret,
> ClientCertificate, WorkloadIdentity, AzurePipelines credentials)
> available in the **azure-identity-rust** plugin skill if installed.

## Install
cargo add azure_identity

## Quick Start
```rust
use azure_identity::DeveloperToolsCredential;
let credential = DeveloperToolsCredential::new(None)?;
```

## Best Practices
- Use DeveloperToolsCredential during local development — it detects Azure CLI automatically
- Use ManagedIdentityCredential in production — no secrets required
- Credentials are Arc-wrapped, making them inexpensive to clone
- A single credential instance can be shared across multiple clients
- Enable the tokio feature when needed — `cargo add azure_identity --features tokio`
