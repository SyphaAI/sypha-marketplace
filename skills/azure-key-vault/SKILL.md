---
name: azure-key-vault
description: >-
  Guidance for Azure Key Vault — securely storing and managing secrets, keys,
  and certificates with RBAC, network isolation, managed identity access, soft
  delete / purge protection, and rotation. Addresses when to choose standard Key Vault
  vs Managed HSM (FIPS 140-3 Level 3), the one-vault-per-app blast radius principle,
  and Key Vault references in App Service / Functions. WHEN: Azure Key Vault,
  store secrets, manage certificates, encryption keys, secret rotation, Key
  Vault RBAC, purge protection, soft delete, private endpoint Key Vault, managed
  identity access secrets, Managed HSM, Key Vault references, BYOK CMK. DO NOT
  USE for certificate authority design (use pki-design), entra app credentials
  only (use entra-id), or PaaS networking topology (use
  azure-network-security-design).
metadata:
  author: Microsoft
  version: 0.1.0
  category: development
  source:
    repository: 'https://github.com/vinayaklatthe/microsoft-security-skills'
    path: skills/azure-key-vault
    license_path: LICENSE
    commit: 15f16df4ae50261328da8b82f3f0964cac0899ae
---

# Azure Key Vault

Azure Key Vault provides a central, secure repository for **secrets, keys, and certificates**, offering
RBAC-based access control, network isolation, logging, and lifecycle automation — ensuring
applications never embed credentials directly and that cryptographic material follows a managed lifecycle.

## When to use
Apply this skill when managing application secrets, encryption keys (including customer-managed keys / BYOK), and
TLS certificates — to select between standard and Managed HSM, design access controls, and plan
rotation schedules.

**Do not use this skill** for CA design (`pki-design`), Entra app credentials alone
(`entra-id`), or PaaS networking topology (`azure-network-security-design`).

## Pick the vault type and access model

| Requirement | Choice | Notes |
|---|---|---|
| Application secrets, TLS certs, software-protected keys | **Standard Key Vault** | Default; FIPS 140-2 Level 2 |
| Single-tenant HSM with FIPS 140-3 Level 3 keys (CMK, root CA) | **Managed HSM** | Regulated workloads |
| Per-app, per-environment isolation | **One vault per app per environment** | Limits blast radius |
| App reading secrets at runtime | **Managed identity + RBAC** (Key Vault Secrets User) | No secrets in code |
| App Service / Functions secret in config | **Key Vault references** in app settings | No code change |
| Customer-managed key for Storage / SQL | Key in Key Vault (or HSM) + identity grant | Rotate independently |

> **Rule of thumb:** **one vault per app per environment** (dev / test / prod). Avoid sharing a
> vault across apps — if one app's identity is compromised, every other app's secrets become readable. Use
> Managed HSM only when a regulatory requirement or CMK boundary demands FIPS 140-3 Level 3.

## Approach

1. **Use Azure RBAC for the data plane** — Migrate the vault to the **RBAC permission model** (away from
   legacy access policies). Assign least-privilege roles (`Key Vault Secrets User`,
   `Key Vault Crypto User`) to **managed identities** rather than user accounts.
   *Verify: vault `enableRbacAuthorization = true`; no users with `Key Vault Administrator`
   in prod.*

2. **App access via managed identity + Key Vault references** — The application authenticates using a
   system-assigned or user-assigned managed identity and retrieves secrets at runtime.
   For App Service / Functions, configure **Key Vault references** in app settings using
   `@Microsoft.KeyVault(SecretUri=...)` — no SDK code changes are needed.
   *Verify: source code contains no plaintext secrets; the managed identity holds only the
   secrets role on the target vault.*

3. **Enable soft delete + purge protection** — Soft delete is active by default; **enable
   purge protection** so that accidental or malicious key deletion remains unrecoverable for
   90 days. This is required for CMK and most compliance scenarios.
   *Verify: `softDeleteRetentionInDays >= 7`; `enablePurgeProtection = true`.*

4. **Restrict network access** — For sensitive vaults, **disable public network access** and
   place a **private endpoint** in the workload VNet. Restrict remaining access using service tags or
   specific network selections.
   *Verify: `publicNetworkAccess = Disabled`; private endpoint resolves correctly; a public IP test
   from the internet is blocked.*

5. **One vault per app per environment** — Contain blast radius at the per-app level. Cross-app reads then require an
   explicit role grant that is fully audited. Avoid consolidating secrets into a shared vault.

6. **Automate rotation + monitor expiry** — Assign expiry dates to secrets and certs; use **rotation
   policies** for automatic certificate renewal from an issuer; for secrets, use Event Grid → Logic
   App / Function to rotate at the source and push the updated value to the vault.
   *Verify: no production secret has a NULL expiry; alerts trigger 60 days before any cert
   or secret expires.*

7. **Monitor + Defender** — Forward diagnostic logs to Log Analytics and enable **Defender for
   Key Vault** to detect anomalous access patterns.

## Guardrails
- **One vault per app per environment constrains blast radius and keeps access control straightforward.**
  Shared vaults represent an over-permission anti-pattern.
- **Purge protection cannot be disabled once enabled — it is required for CMK and many compliance
  scenarios.** Enable it deliberately and with full awareness.
- **Never embed secrets in source code or config files; rely on managed identity + Key Vault references.**
  Secrets stored in code leak through repos, logs, and environment-variable dumps.
- **Disable public network access on sensitive vaults.** An internet-facing Key Vault is exposed to
  brute-force and credential-spray attacks.
- **Use RBAC, not access policies.** RBAC is the current model and supports proper inheritance and
  PIM-eligible role assignments.
- **Never grant `Key Vault Administrator` to applications.** Apps require read access on secrets / keys, not administrative control.

## Common anti-patterns
- **"Shared 'enterprise' Key Vault for all apps"** — Compromising a single app's identity exposes every other app's secrets. Use per-app, per-environment vaults instead.
- **"Access policies because we've always used them"** — This is a legacy approach that is harder to audit. Migrate to RBAC.
- **"No purge protection — we might need to delete things"** — The first accidental or malicious purge results in permanent data loss. Enable it and accept the irrevocability.
- **"Public network access on for convenience"** — This creates internet exposure. Use a private endpoint plus firewall rules.
- **"Secrets in App Service application settings as plaintext"** — Any principal with config read access can view them. Use Key Vault references instead.
- **"No expiry / no rotation"** — Long-lived secrets represent a continuous security liability. Enforce expiry and rotation policies.
- **"Same vault for app secrets and CA root key"** — This conflates different blast radii. Place CA / HSM keys in **Managed HSM**, separate from the application secret vault.

## Example prompts
- `Set up Azure Key Vault with RBAC, purge protection, and a private endpoint.`
- `Configure an App Service to read secrets via managed identity and Key Vault references.`
- `When should I use Managed HSM instead of standard Key Vault?`
- `Plan one-vault-per-app-per-environment for our microservices estate.`
- `Automate certificate rotation in Key Vault with a 60-day expiry alert.`
- `Review my Key Vault access model for least privilege.`

## Microsoft Learn
- Key Vault overview: https://learn.microsoft.com/azure/key-vault/general/overview
- Security features: https://learn.microsoft.com/azure/key-vault/general/security-features
- RBAC guide: https://learn.microsoft.com/azure/key-vault/general/rbac-guide
- Soft delete + purge protection: https://learn.microsoft.com/azure/key-vault/general/soft-delete-overview
- Private endpoints: https://learn.microsoft.com/azure/key-vault/general/private-link-service
- Key Vault references in App Service: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references
- Managed HSM: https://learn.microsoft.com/azure/key-vault/managed-hsm/overview
- Defender for Key Vault: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-key-vault-introduction
