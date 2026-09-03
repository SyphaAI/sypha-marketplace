# Key Vault Keys — Rust SDK Quick Reference

> A condensed version of **azure-keyvault-keys-rust**. The complete patterns (EC keys,
> backup/restore, crypto operations, RBAC permissions)
> live in the **azure-keyvault-keys-rust** plugin skill when it is installed.

## Install
cargo add azure_security_keyvault_keys azure_identity

## Quick Start
```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_keys::KeyClient;
let credential = DeveloperToolsCredential::new(None)?;
let client = KeyClient::new("https://<vault>.vault.azure.net/", credential.clone(), None)?;
```

## Best Practices
- Authenticate with Entra ID — `DeveloperToolsCredential` for dev, `ManagedIdentityCredential` for production
- Put HSM keys behind sensitive workloads — keys protected by hardware
- Pick EC for signing — it beats RSA on efficiency
- Pick RSA for encryption — when data needs encrypting
- Back up keys so disaster recovery is possible
- Turn on soft delete — production vaults require it
- Rotate keys — mint new versions on a periodic basis

## Non-Obvious Patterns
```rust
use azure_security_keyvault_keys::models::{CreateKeyParameters, KeyType};
let params = CreateKeyParameters { kty: KeyType::Rsa, key_size: Some(2048), ..Default::default() };
client.create_key("name", params.try_into()?, None).await?.into_model()?;
```
