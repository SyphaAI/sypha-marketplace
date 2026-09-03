---
name: secrets-vault-manager
description: >-
  Use when the user wants to establish secret management infrastructure, integrate
  HashiCorp Vault, configure cloud secret stores (AWS Secrets Manager, Azure Key
  Vault, GCP Secret Manager), implement secret rotation, or audit secret access
  patterns.
metadata:
  category: development
  source:
    repository: 'https://github.com/alirezarezvani/claude-skills'
    path: engineering/skills/secrets-vault-manager
    license_path: LICENSE
    commit: 4a3c05b69e64f4925f7fc65c88890f614f79caf0
---

# Secrets Vault Manager

**Tier:** POWERFUL
**Category:** Engineering
**Domain:** Security / Infrastructure / DevOps

---

## Overview

Manages production secret infrastructure for teams operating HashiCorp Vault, cloud-native secret stores, or hybrid architectures. Coverage includes policy authoring, auth method configuration, automated rotation, dynamic secrets, audit logging, and incident response.

**Distinct from env-secrets-manager**, which handles local `.env` file hygiene and leak detection. This skill works at the infrastructure layer — Vault clusters, cloud KMS, certificate authorities, and CI/CD secret injection.

### When to Use

- Deploying a new Vault cluster or migrating to a managed secret store
- Designing auth methods for services, CI runners, and human operators
- Setting up automated credential rotation (databases, API keys, certificates)
- Auditing secret access patterns for compliance (SOC 2, ISO 27001, HIPAA)
- Responding to a secret leak that requires bulk revocation
- Injecting secrets into Kubernetes workloads or CI/CD pipelines

---

## HashiCorp Vault Patterns

### Architecture Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Deployment mode | HA with Raft storage | No external dependency; leader election is built in |
| Auto-unseal | Cloud KMS (AWS KMS / Azure Key Vault / GCP KMS) | Removes the need for manual unsealing; supports automated restarts |
| Namespaces | One per environment (dev/staging/prod) | Limits blast radius and allows independent policies per environment |
| Audit devices | File + syslog (dual) | Vault rejects requests when all audit devices fail — running two prevents outages |

### Auth Methods

**AppRole** — Machine-to-machine authentication method for services and batch jobs.

```hcl
# Enable AppRole
path "auth/approle/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Application-specific role
vault write auth/approle/role/payment-service \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_num_uses=1 \
  secret_id_ttl=10m \
  token_policies="payment-service-read"
```

**Kubernetes** — Native pod authentication using service account tokens.

```hcl
vault write auth/kubernetes/role/api-server \
  bound_service_account_names=api-server \
  bound_service_account_namespaces=production \
  policies=api-server-secrets \
  ttl=1h
```

**OIDC** — Human operator access through an SSO provider (Okta, Azure AD, Google Workspace).

```hcl
vault write auth/oidc/role/engineering \
  bound_audiences="vault" \
  allowed_redirect_uris="https://vault.example.com/ui/vault/auth/oidc/oidc/callback" \
  user_claim="email" \
  oidc_scopes="openid,profile,email" \
  policies="engineering-read" \
  ttl=8h
```

### Secret Engines

| Engine | Use Case | TTL Strategy |
|--------|----------|-------------|
| KV v2 | Static secrets (API keys, config) | Versioned, manual rotation |
| Database | Dynamic DB credentials | 1h default, 24h max |
| PKI | TLS certificates | 90d leaf certs, 5y intermediate CA |
| Transit | Encryption-as-a-service | Key rotation every 90d |
| SSH | Signed SSH certificates | 30m for interactive, 8h for automation |

### Policy Design

Apply least-privilege with path-based granularity:

```hcl
# payment-service-read policy
path "secret/data/production/payment/*" {
  capabilities = ["read"]
}

path "database/creds/payment-readonly" {
  capabilities = ["read"]
}

# Deny access to admin paths explicitly
path "sys/*" {
  capabilities = ["deny"]
}
```

**Policy naming convention:** `{service}-{access-level}` (e.g., `payment-service-read`, `api-gateway-admin`).

---

## Cloud Secret Store Integration

### Comparison Matrix

| Feature | AWS Secrets Manager | Azure Key Vault | GCP Secret Manager |
|---------|--------------------|-----------------|--------------------|
| Rotation | Built-in Lambda | Custom logic via Functions | Cloud Functions |
| Versioning | Automatic | Manual or automatic | Automatic |
| Encryption | AWS KMS (default or CMK) | HSM-backed | Google-managed or CMEK |
| Access control | IAM policies + resource policy | RBAC + Access Policies | IAM bindings |
| Cross-region | Replication supported | Geo-redundant by default | Replication supported |
| Audit | CloudTrail | Azure Monitor + Diagnostic Logs | Cloud Audit Logs |
| Pricing model | Per-secret + per-API call | Per-operation + per-key | Per-secret version + per-access |

### When to Use Which

- **AWS Secrets Manager**: Native RDS/Aurora credential rotation included. Ideal when your stack is entirely on AWS.
- **Azure Key Vault**: Strong certificate management. Required for workloads integrated with Azure AD.
- **GCP Secret Manager**: Minimal API surface area. Best suited to GKE-native workloads using Workload Identity.
- **HashiCorp Vault**: Multi-cloud support, dynamic secrets, PKI, transit encryption. Optimal for complex or hybrid environments.

### SDK Access Patterns

**Principle:** Always retrieve secrets at startup or through a sidecar — never embed them in images or config files.

```python
# AWS Secrets Manager pattern
import boto3, json

def get_secret(secret_name, region="us-east-1"):
    client = boto3.client("secretsmanager", region_name=region)
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])
```

```python
# GCP Secret Manager pattern
from google.cloud import secretmanager

def get_secret(project_id, secret_id, version="latest"):
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")
```

```python
# Azure Key Vault pattern
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

def get_secret(vault_url, secret_name):
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_url, credential=credential)
    return client.get_secret(secret_name).value
```

---

## Secret Rotation Workflows

### Rotation Strategy by Secret Type

| Secret Type | Rotation Frequency | Method | Downtime Risk |
|-------------|-------------------|--------|---------------|
| Database passwords | 30 days | Dual-account swap | Zero (A/B rotation) |
| API keys | 90 days | Generate new, deprecate old | Zero (overlap window) |
| TLS certificates | 60 days before expiry | ACME or Vault PKI | Zero (graceful reload) |
| SSH keys | 90 days | Vault-signed certificates | Zero (CA-based) |
| Service tokens | 24 hours | Dynamic generation | Zero (short-lived) |
| Encryption keys | 90 days | Key versioning (rewrap) | Zero (version coexistence) |

### Database Credential Rotation (Dual-Account)

1. Two database accounts are provisioned: `app_user_a` and `app_user_b`
2. The application currently authenticates with `app_user_a`
3. Rotation updates the `app_user_b` password and writes the new value to the secret store
4. On the next credential fetch, the application switches to `app_user_b`
5. After a grace period, the `app_user_a` password is rotated
6. The cycle repeats indefinitely

### API Key Rotation (Overlap Window)

1. Generate a new API key with the provider
2. Store the new key in the secret store as `current`; move the old key to `previous`
3. Deploy applications — they will read from `current`
4. Once all instances have restarted (or the TTL has elapsed), revoke `previous`
5. Confirm through monitoring that the old key has zero usage before revoking it

---

## Dynamic Secrets

Dynamic secrets are produced on-demand and expire automatically. Prefer dynamic secrets over static credentials wherever the infrastructure supports it.

### Database Dynamic Credentials (Vault)

```hcl
# Configure database engine
vault write database/config/postgres \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@db.example.com:5432/app" \
  allowed_roles="app-readonly,app-readwrite" \
  username="vault_admin" \
  password="<admin-password>"

# Create role with TTL
vault write database/roles/app-readonly \
  db_name=postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl=1h \
  max_ttl=24h
```

### Cloud IAM Dynamic Credentials

Vault can issue short-lived AWS IAM credentials, Azure service principal passwords, or GCP service account keys — removing the need for long-lived cloud credentials entirely.

### SSH Certificate Authority

Replace SSH key distribution with a Vault-signed certificate model:

1. Vault serves as the SSH CA
2. Users and machines request signed certificates with a short TTL (30 min)
3. SSH servers trust the CA public key — no `authorized_keys` management required
4. Certificates expire on their own — revocation is not needed for normal operations

---

## Audit Logging

### What to Log

| Event | Priority | Retention |
|-------|----------|-----------|
| Secret read access | HIGH | 1 year minimum |
| Secret creation/update | HIGH | 1 year minimum |
| Auth method login | MEDIUM | 90 days |
| Policy changes | CRITICAL | 2 years (compliance) |
| Failed access attempts | CRITICAL | 1 year |
| Token creation/revocation | MEDIUM | 90 days |
| Seal/unseal operations | CRITICAL | Indefinite |

### Anomaly Detection Signals

- A secret is accessed from a new IP or CIDR range
- Access volume for a path spikes above 3x the baseline
- Human auth methods show access outside business hours
- A service requests secrets outside its policy scope (denied requests)
- Multiple failed auth attempts originate from a single source
- A token is created with an unusually long TTL

### Compliance Reporting

Produce periodic reports covering:

1. **Access inventory** — Which identities accessed which secrets, and when
2. **Rotation compliance** — Secrets that are overdue for rotation
3. **Policy drift** — Policies modified since the last review
4. **Orphaned secrets** — Secrets with no recent access (>90 days)

Use `audit_log_analyzer.py` to parse Vault or cloud audit logs and surface these signals.

---

## Emergency Procedures

### Secret Leak Response (Immediate)

**Time target: Contain within 15 minutes of detection.**

1. **Identify scope** — Determine which secret(s) were exposed and where (repo, log, error message, third party)
2. **Revoke immediately** — Rotate the compromised credential at its source (provider API, Vault, cloud SM)
3. **Invalidate tokens** — Revoke all Vault tokens that had access to the leaked secret
4. **Audit blast radius** — Query audit logs for any usage of the compromised secret during the exposure window
5. **Notify stakeholders** — Alert the security team, affected service owners, and compliance (if PII or regulated data is involved)
6. **Post-mortem** — Document the root cause and update controls to prevent recurrence

### Vault Seal Operations

**When to seal:** An active security incident is affecting Vault infrastructure, or key compromise is suspected.

**Sealing** halts all Vault operations. Treat it as a last resort.

**Unseal procedure:**
1. Assemble a quorum of unseal key holders (Shamir threshold)
2. Alternatively, confirm the auto-unseal KMS key is accessible
3. Unseal via `vault operator unseal` or restart with auto-unseal configured
4. Verify that all audit devices have reconnected
5. Inspect active leases and confirm token validity

See `references/emergency_procedures.md` for complete playbooks.

---

## CI/CD Integration

### Vault Agent Sidecar (Kubernetes)

Vault Agent runs as a sidecar alongside application pods, managing authentication and rendering secrets into the pod's filesystem:

```yaml
# Pod annotation for Vault Agent Injector
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "api-server"
  vault.hashicorp.com/agent-inject-secret-db: "database/creds/app-readonly"
  vault.hashicorp.com/agent-inject-template-db: |
    {{- with secret "database/creds/app-readonly" -}}
    postgresql://{{ .Data.username }}:{{ .Data.password }}@db:5432/app
    {{- end }}
```

### External Secrets Operator (Kubernetes)

For teams that prefer a declarative GitOps approach over agent sidecars:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: api-credentials
  data:
    - secretKey: api-key
      remoteRef:
        key: secret/data/production/api
        property: key
```

### GitHub Actions OIDC

Remove long-lived secrets from CI entirely by leveraging OIDC federation:

```yaml
- name: Authenticate to Vault
  uses: hashicorp/vault-action@v2
  with:
    url: https://vault.example.com
    method: jwt
    role: github-ci
    jwtGithubAudience: https://vault.example.com
    secrets: |
      secret/data/ci/deploy api_key | DEPLOY_API_KEY ;
      secret/data/ci/deploy db_password | DB_PASSWORD
```

---

## Anti-Patterns

| Anti-Pattern | Risk | Correct Approach |
|-------------|------|-----------------|
| Hardcoded secrets in source code | Leak via repo, logs, error output | Fetch from secret store at runtime |
| Long-lived static tokens (>30 days) | Stale credentials, no accountability | Dynamic secrets or short TTL + rotation |
| Shared service accounts | No audit trail per consumer | Per-service identity with unique credentials |
| No rotation policy | Compromised creds persist indefinitely | Automated rotation on schedule |
| Secrets in environment variables on CI | Visible in build logs, process table | Vault Agent or OIDC-based injection |
| Single unseal key holder | Bus factor of 1, recovery blocked | Shamir split (3-of-5) or auto-unseal |
| No audit device configured | Zero visibility into access | Dual audit devices (file + syslog) |
| Wildcard policies (`path "*"`) | Over-permissioned, violates least privilege | Explicit path-based policies per service |

---

## Tools

| Script | Purpose |
|--------|---------|
| `vault_config_generator.py` | Generate Vault policy and auth config from application requirements |
| `rotation_planner.py` | Create rotation schedule from a secret inventory file |
| `audit_log_analyzer.py` | Analyze audit logs for anomalies and compliance gaps |

---

## Cross-References

- **env-secrets-manager** — Local `.env` file hygiene, leak detection, drift awareness
- **senior-secops** — Security operations, incident response, threat modeling
- **ci-cd-pipeline-builder** — Pipeline design where secrets are consumed
- **docker-development** — Container secret injection patterns
- **helm-chart-builder** — Kubernetes secret management in Helm charts
