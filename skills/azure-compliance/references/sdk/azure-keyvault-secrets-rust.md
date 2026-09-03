# Key Vault Secrets — Rust SDK Quick Reference

> A condensed version of **azure-keyvault-secrets-rust**. The complete patterns (versioning,
> update properties, tags, soft delete recovery)
> live in the **azure-keyvault-secrets-rust** plugin skill when it is installed.

## Install
cargo add azure_security_keyvault_secrets azure_identity

## Quick Start
```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_secrets::SecretClient;
let credential = DeveloperToolsCredential::new(None)?;
let client = SecretClient::new("https://<vault>.vault.azure.net/", credential.clone(), None)?;
```

## Best Practices
- Authenticate with Entra ID — `DeveloperToolsCredential` for dev, `ManagedIdentityCredential` for production
- Deserialize responses via `into_model()?`
- Pull names out of IDs with the `ResourceExt` trait
- Account for soft delete — a deleted secret is recoverable within the retention period
- Provide a content type — it makes the secret format identifiable
- Organize and filter secrets using tags
- Version secrets — every new value automatically becomes a new version

## Non-Obvious Patterns
```rust
use azure_security_keyvault_secrets::models::SetSecretParameters;
let params = SetSecretParameters { value: Some("secret-value".into()), ..Default::default() };
client.set_secret("name", params.try_into()?, None).await?.into_model()?;
```
