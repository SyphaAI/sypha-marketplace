# HashiCorp Vault Architecture & Patterns Reference

## Architecture Overview

Vault functions as a centralized secret management service built on a client-server model. All secrets are encrypted both at rest and in transit. The seal/unseal mechanism safeguards the master encryption key.

### Core Components

```
┌─────────────────────────────────────────────────┐
│                   Vault Cluster                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  Leader    │  │ Standby   │  │ Standby   │   │
│  │  (active)  │  │ (forward) │  │ (forward) │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘   │
│        │               │               │         │
│  ┌─────┴───────────────┴───────────────┴─────┐   │
│  │            Raft Storage Backend            │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Auth     │  │ Secret   │  │ Audit        │   │
│  │ Methods  │  │ Engines  │  │ Devices      │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────┘
```

### Storage Backend Selection

| Backend | HA Support | Operational Complexity | Recommendation |
|---------|-----------|----------------------|----------------|
| Integrated Raft | Yes | Low | **Default choice** — no external dependencies |
| Consul | Yes | Medium | Legacy — use Raft unless already running Consul |
| S3/GCS/Azure Blob | No | Low | Dev/test only — no HA |
| PostgreSQL/MySQL | No | Medium | Not recommended — no HA, added dependency |

## High Availability Setup

### Raft Cluster Configuration

A minimum of 3 nodes is required for production (tolerates 1 failure). Use 5 nodes for critical workloads (tolerates 2 failures).

```hcl
# vault-config.hcl (per node)
storage "raft" {
  path    = "/opt/vault/data"
  node_id = "vault-1"

  retry_join {
    leader_api_addr = "https://vault-2.internal:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-3.internal:8200"
  }
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"
}

api_addr     = "https://vault-1.internal:8200"
cluster_addr = "https://vault-1.internal:8201"
```

### Auto-Unseal with AWS KMS

Removes the need to manage unseal keys manually. Vault encrypts its master key using the KMS key.

```hcl
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-unseal"
}
```

**Requirements:**
- An IAM role with `kms:Encrypt`, `kms:Decrypt`, `kms:DescribeKey` permissions
- The KMS key must reside in the same region or be accessible cross-region
- KMS key access should be restricted to Vault nodes only

### Auto-Unseal with Azure Key Vault

```hcl
seal "azurekeyvault" {
  tenant_id  = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  vault_name = "vault-unseal-kv"
  key_name   = "vault-unseal-key"
}
```

### Auto-Unseal with GCP KMS

```hcl
seal "gcpckms" {
  project    = "my-project"
  region     = "global"
  key_ring   = "vault-keyring"
  crypto_key = "vault-unseal-key"
}
```

## Namespaces (Enterprise)

Namespaces deliver tenant isolation within a single Vault cluster. Each namespace maintains its own independent policies, auth methods, and secret engines.

```
root/
├── dev/           # Development environment
│   ├── auth/
│   └── secret/
├── staging/       # Staging environment
│   ├── auth/
│   └── secret/
└── production/    # Production environment
    ├── auth/
    └── secret/
```

**OSS alternative:** Apply path-based isolation with strict policies. Prefix every path with the environment name (e.g., `secret/data/production/...`).

## Policy Patterns

### Templated Policies

Leverage identity-based templates to manage policies at scale:

```hcl
# Allow entities to manage their own secrets
path "secret/data/{{identity.entity.name}}/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Read shared config for the entity's group
path "secret/data/shared/{{identity.groups.names}}/*" {
  capabilities = ["read"]
}
```

### Sentinel Policies (Enterprise)

Enforce governance rules beyond path-based access:

```python
# Require MFA for production secret writes
import "mfa"

main = rule {
  request.path matches "secret/data/production/.*" and
  request.operation in ["create", "update", "delete"] and
  mfa.methods.totp.valid
}
```

### Policy Hierarchy

1. **Global deny** — Explicit deny applied to `sys/*` and `auth/token/create-orphan`
2. **Environment base** — Read access to paths specific to each environment
3. **Service-specific** — Scoped strictly to the paths a given service requires
4. **Admin override** — Requires MFA, is time-limited, and generates heavy audit records

## Secret Engine Configuration

### KV v2 (Versioned Key-Value)

```bash
# Enable with custom config
vault secrets enable -path=secret -version=2 kv

# Configure version retention
vault write secret/config max_versions=10 cas_required=true delete_version_after=90d
```

**Check-and-Set (CAS):** Guards against accidental overwrites. The client must provide the current version number to perform an update.

### Database Engine

```bash
# Enable and configure PostgreSQL
vault secrets enable database

vault write database/config/postgres \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@db.internal:5432/app?sslmode=require" \
  allowed_roles="app-readonly,app-readwrite" \
  username="vault_admin" \
  password="INITIAL_PASSWORD"

# Rotate the root password (Vault manages it from now on)
vault write -f database/rotate-root/postgres

# Create a read-only role
vault write database/roles/app-readonly \
  db_name=postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl=1h \
  max_ttl=24h
```

### PKI Engine (Certificate Authority)

```bash
# Enable PKI engine
vault secrets enable -path=pki pki
vault secrets tune -max-lease-ttl=87600h pki

# Generate root CA
vault write -field=certificate pki/root/generate/internal \
  common_name="Example Root CA" \
  ttl=87600h > root_ca.crt

# Enable intermediate CA
vault secrets enable -path=pki_int pki
vault secrets tune -max-lease-ttl=43800h pki_int

# Generate intermediate CSR
vault write -field=csr pki_int/intermediate/generate/internal \
  common_name="Example Intermediate CA" > intermediate.csr

# Sign with root CA
vault write -field=certificate pki/root/sign-intermediate \
  csr=@intermediate.csr format=pem_bundle ttl=43800h > intermediate.crt

# Set signed certificate
vault write pki_int/intermediate/set-signed certificate=@intermediate.crt

# Create role for leaf certificates
vault write pki_int/roles/web-server \
  allowed_domains="example.com" \
  allow_subdomains=true \
  max_ttl=2160h
```

### Transit Engine (Encryption-as-a-Service)

```bash
vault secrets enable transit

# Create encryption key
vault write -f transit/keys/payment-data \
  type=aes256-gcm96

# Encrypt data
vault write transit/encrypt/payment-data \
  plaintext=$(echo "sensitive-data" | base64)

# Decrypt data
vault write transit/decrypt/payment-data \
  ciphertext="vault:v1:..."

# Rotate key (old versions still decrypt, new encrypts with latest)
vault write -f transit/keys/payment-data/rotate

# Rewrap ciphertext to latest key version
vault write transit/rewrap/payment-data \
  ciphertext="vault:v1:..."
```

## Performance and Scaling

### Performance Replication (Enterprise)

The primary cluster replicates state to secondary clusters in other regions. Secondaries serve read traffic locally.

### Performance Standbys (Enterprise)

Standby nodes handle read requests directly without forwarding them to the leader, thereby reducing leader load.

### Response Wrapping

Protect sensitive responses by wrapping them in a single-use token — the recipient unwraps it exactly once:

```bash
# Wrap a secret (TTL = 5 minutes)
vault kv get -wrap-ttl=5m secret/data/production/db-creds

# Recipient unwraps
vault unwrap <wrapping_token>
```

### Batch Tokens

For high-throughput workloads (Lambda, serverless), use batch tokens in place of service tokens. Batch tokens are not persisted to storage, which reduces I/O overhead.

## Monitoring and Health

### Key Metrics

| Metric | Alert Threshold | Source |
|--------|----------------|--------|
| `vault.core.unsealed` | 0 (sealed) | Telemetry |
| `vault.expire.num_leases` | >10,000 | Telemetry |
| `vault.audit.log_response` | Error rate >1% | Telemetry |
| `vault.runtime.alloc_bytes` | >80% memory | Telemetry |
| `vault.raft.leader.lastContact` | >500ms | Telemetry |
| `vault.token.count` | >50,000 | Telemetry |

### Health Check Endpoint

```bash
# Returns 200 if initialized, unsealed, and active
curl -s https://vault.internal:8200/v1/sys/health

# Status codes:
# 200 — initialized, unsealed, active
# 429 — unsealed, standby
# 472 — disaster recovery secondary
# 473 — performance standby
# 501 — not initialized
# 503 — sealed
```

## Disaster Recovery

### Backup

```bash
# Raft snapshot (includes all data)
vault operator raft snapshot save backup-$(date +%Y%m%d).snap

# Schedule daily backups via cron
0 2 * * * /usr/local/bin/vault operator raft snapshot save /backups/vault-$(date +\%Y\%m\%d).snap
```

### Restore

```bash
# Restore from snapshot (causes brief outage)
vault operator raft snapshot restore backup-20260320.snap
```

### DR Replication (Enterprise)

A secondary cluster stands by in passive mode. Promote it when the primary fails:

```bash
# On DR secondary
vault operator generate-root -dr-token
vault write sys/replication/dr/secondary/promote dr_operation_token=<token>
```
