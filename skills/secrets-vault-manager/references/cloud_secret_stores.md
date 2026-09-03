# Cloud Secret Store Reference

## Provider Comparison

### Feature Matrix

| Feature | AWS Secrets Manager | Azure Key Vault | GCP Secret Manager |
|---------|--------------------|-----------------|--------------------|
| **Secret types** | String, binary | Secrets, keys, certificates | String, binary |
| **Max secret size** | 64 KB | 25 KB (secret), 200 KB (cert) | 64 KB |
| **Versioning** | Automatic (all versions) | Manual enable per secret | Automatic |
| **Rotation** | Built-in Lambda rotation | Custom via Functions/Logic Apps | Custom via Cloud Functions |
| **Encryption** | AWS KMS (default or CMK) | HSM-backed (FIPS 140-2 L2) | Google-managed or CMEK |
| **Cross-region** | Replication to multiple regions | Geo-redundant by SKU | Replication supported |
| **Access control** | IAM + resource-based policies | RBAC + access policies | IAM bindings |
| **Audit** | CloudTrail | Azure Monitor + Diagnostics | Cloud Audit Logs |
| **Secret references** | ARN | Vault URI + secret name | Resource name |
| **Cost model** | $0.40/secret/mo + $0.05/10K calls | $0.03/10K ops (Standard) | $0.06/10K access ops |
| **Free tier** | No | No | 6 active versions free |

### Decision Guide

**Choose AWS Secrets Manager when:**
- Your infrastructure is entirely on AWS
- You need native RDS/Aurora/Redshift rotation
- ECS/EKS workloads rely on native AWS IAM integration
- Cross-account secret sharing via resource policies is required

**Choose Azure Key Vault when:**
- Workloads are Azure-primary
- Certificate lifecycle management is critical (built-in CA integration)
- HSM-backed key protection is required (Premium SKU)
- Azure AD conditional access integration is needed

**Choose GCP Secret Manager when:**
- Workloads are GCP-primary
- You are using GKE with Workload Identity
- A simple API surface is a priority (minimal concepts, fast integration)
- Cost is a concern (generous free tier)

**Choose HashiCorp Vault when:**
- Operating in multi-cloud or hybrid environments
- Dynamic secrets (database, cloud IAM, SSH) are the primary use case
- Transit encryption, PKI, or SSH CA capabilities are needed
- Regulatory requirements mandate self-hosted secret management

## AWS Secrets Manager

### Access Patterns

```python
import boto3
import json
from botocore.exceptions import ClientError

def get_secret(secret_name, region="us-east-1"):
    """Retrieve secret from AWS Secrets Manager."""
    client = boto3.client("secretsmanager", region_name=region)
    try:
        response = client.get_secret_value(SecretId=secret_name)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "ResourceNotFoundException":
            raise ValueError(f"Secret {secret_name} not found")
        elif code == "DecryptionFailureException":
            raise RuntimeError("KMS decryption failed — check key permissions")
        raise
    if "SecretString" in response:
        return json.loads(response["SecretString"])
    return response["SecretBinary"]
```

### Rotation with Lambda

```python
# rotation_lambda.py — skeleton for custom rotation
def lambda_handler(event, context):
    secret_id = event["SecretId"]
    step = event["Step"]
    token = event["ClientRequestToken"]
    client = boto3.client("secretsmanager")

    if step == "createSecret":
        # Generate new credentials
        new_password = generate_password()
        client.put_secret_value(
            SecretId=secret_id,
            ClientRequestToken=token,
            SecretString=json.dumps({"password": new_password}),
            VersionStages=["AWSPENDING"],
        )
    elif step == "setSecret":
        # Apply new credentials to the target service
        pending = get_secret_version(client, secret_id, "AWSPENDING", token)
        apply_credentials(pending)
    elif step == "testSecret":
        # Verify new credentials work
        pending = get_secret_version(client, secret_id, "AWSPENDING", token)
        test_connection(pending)
    elif step == "finishSecret":
        # Mark AWSPENDING as AWSCURRENT
        client.update_secret_version_stage(
            SecretId=secret_id,
            VersionStage="AWSCURRENT",
            MoveToVersionId=token,
            RemoveFromVersionId=get_current_version(client, secret_id),
        )
```

### IAM Policy for Secret Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:production/api/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

### Cross-Account Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::987654321098:role/shared-secret-reader"},
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*",
      "Condition": {
        "ForAnyValue:StringEquals": {
          "secretsmanager:VersionStage": "AWSCURRENT"
        }
      }
    }
  ]
}
```

## Azure Key Vault

### Access Patterns

```python
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.keyvault.secrets import SecretClient

def get_secret(vault_url, secret_name, use_managed_identity=True):
    """Retrieve secret from Azure Key Vault."""
    if use_managed_identity:
        credential = ManagedIdentityCredential()
    else:
        credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_url, credential=credential)
    return client.get_secret(secret_name).value

def list_secrets(vault_url):
    """List all secret names (not values)."""
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_url, credential=credential)
    return [s.name for s in client.list_properties_of_secrets()]
```

### RBAC vs Access Policies

**RBAC (recommended):**
- Leverages Azure AD roles (`Key Vault Secrets User`, `Key Vault Secrets Officer`)
- Applied at the subscription, resource group, or vault level
- Audited through Azure AD activity logs

**Access Policies (legacy):**
- Configured on a per-vault basis
- Based on object IDs
- Does not inherit from the resource group

```bash
# Assign RBAC role
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <service-principal-id> \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault>
```

### Certificate Management

Azure Key Vault provides first-class certificate management with built-in automatic renewal:

```bash
# Create certificate with auto-renewal
az keyvault certificate create \
  --vault-name my-vault \
  --name api-tls \
  --policy @cert-policy.json

# cert-policy.json
{
  "issuerParameters": {"name": "Self"},
  "keyProperties": {"keyType": "RSA", "keySize": 2048},
  "lifetimeActions": [
    {"action": {"actionType": "AutoRenew"}, "trigger": {"daysBeforeExpiry": 30}}
  ],
  "x509CertificateProperties": {
    "subject": "CN=api.example.com",
    "validityInMonths": 12
  }
}
```

## GCP Secret Manager

### Access Patterns

```python
from google.cloud import secretmanager

def get_secret(project_id, secret_id, version="latest"):
    """Retrieve secret from GCP Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

def create_secret(project_id, secret_id, secret_value):
    """Create a new secret with initial version."""
    client = secretmanager.SecretManagerServiceClient()
    parent = f"projects/{project_id}"

    # Create the secret resource
    secret = client.create_secret(
        request={
            "parent": parent,
            "secret_id": secret_id,
            "secret": {"replication": {"automatic": {}}},
        }
    )

    # Add a version with the secret value
    client.add_secret_version(
        request={
            "parent": secret.name,
            "payload": {"data": secret_value.encode("UTF-8")},
        }
    )
    return secret.name
```

### Workload Identity for GKE

Remove service account key files by binding Kubernetes service accounts directly to GCP IAM:

```bash
# Create IAM binding
gcloud iam service-accounts add-iam-policy-binding \
  secret-accessor@my-project.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:my-project.svc.id.goog[namespace/ksa-name]"

# Annotate Kubernetes service account
kubectl annotate serviceaccount ksa-name \
  --namespace namespace \
  iam.gke.io/gcp-service-account=secret-accessor@my-project.iam.gserviceaccount.com
```

### IAM Policy

```bash
# Grant secret accessor role to a service account
gcloud secrets add-iam-policy-binding my-secret \
  --member="serviceAccount:my-app@my-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Cross-Cloud Patterns

### Abstraction Layer

In multi-cloud environments, build a thin abstraction layer that provides a uniform secret access interface:

```python
# secret_client.py — cross-cloud abstraction
class SecretClient:
    def __init__(self, provider, **kwargs):
        if provider == "aws":
            self._client = AWSSecretClient(**kwargs)
        elif provider == "azure":
            self._client = AzureSecretClient(**kwargs)
        elif provider == "gcp":
            self._client = GCPSecretClient(**kwargs)
        elif provider == "vault":
            self._client = VaultSecretClient(**kwargs)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def get(self, key):
        return self._client.get(key)

    def set(self, key, value):
        return self._client.set(key, value)
```

### Migration Strategy

When switching between providers:

1. **Dual-write phase** — Write to both the old and new store at the same time
2. **Dual-read phase** — Read from the new store with a fallback to the old one
3. **Cut-over** — Read exclusively from the new store
4. **Cleanup** — Delete secrets from the old store after the grace period has elapsed

### Secret Synchronization

For hybrid setups (e.g., Vault as primary, cloud SM for specific workloads):

- Use Vault's cloud secret engines to generate cloud-native credentials on demand
- Alternatively, use External Secrets Operator to synchronize secrets from Vault into cloud-native stores
- Never copy secrets between stores manually — automate the process every time

## Caching and Performance

### Client-Side Caching

All three cloud providers offer caching SDKs:

- **AWS:** `aws-secretsmanager-caching-python` — caches secrets with a configurable TTL
- **Azure:** The SDK includes built-in HTTP caching; alternatively, use Azure App Configuration
- **GCP:** No official caching library is available — implement an in-process cache with a TTL

### Caching Rules

1. Set the cache TTL below the rotation period (e.g., 5-minute cache when rotating every 30 days)
2. Invalidate the cache whenever a secret version change event is detected
3. Cache secrets in memory only — never write them to disk
4. Record cache hits and misses to aid in debugging rotation-related issues

## Compliance Mapping

| Requirement | AWS SM | Azure KV | GCP SM | Vault |
|------------|--------|----------|--------|-------|
| SOC 2 audit trail | CloudTrail | Monitor logs | Audit Logs | Audit device |
| HIPAA encryption | KMS (BAA) | HSM (BAA) | CMEK (BAA) | Auto-encrypt |
| PCI DSS key mgmt | KMS compliance | Premium HSM | CMEK | Transit engine |
| GDPR data residency | Region selection | Region selection | Region selection | Self-hosted |
| ISO 27001 | Certified | Certified | Certified | Self-certify |
