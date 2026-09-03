# Key Vault Certificates — Rust SDK Quick Reference

> A condensed version of **azure-keyvault-certificates-rust**. The complete patterns
> (certificate policies, import, lifecycle management)
> live in the **azure-keyvault-certificates-rust** plugin skill when it is installed.

## Install
cargo add azure_security_keyvault_certificates azure_identity

## Quick Start
```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_certificates::CertificateClient;
let credential = DeveloperToolsCredential::new(None)?;
let client = CertificateClient::new("https://<vault>.vault.azure.net/", credential.clone(), None)?;
```

## Best Practices
- Authenticate with Entra ID — `DeveloperToolsCredential` for dev
- Prefer managed certificates — supported issuers give you auto-renewal
- Choose a sensible validity period — weigh security against maintenance
- Define certificate policies — they control renewal and key properties
- Watch for expiration — configure alerts on certificates nearing expiry
- Turn on soft delete — production vaults require it
