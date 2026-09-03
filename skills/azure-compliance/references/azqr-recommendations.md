# azqr Recommendation Categories

This document explains how to read azqr recommendations and decide remediation priority.

## Recommendation Sources

azqr pulls recommendations together from several sources:

| Source | Description | Priority |
|--------|-------------|----------|
| **APRL** | Azure Proactive Resiliency Library - best practices centered on reliability | High |
| **Orphaned Resources** | Resources that sit unused or disconnected | Medium |
| **Azure Advisor** | The recommendation engine built into Microsoft Azure | Medium |
| **Defender for Cloud** | Recommendations centered on security | Critical |
| **Azure Policy** | Compliance status for governance | Varies |

## Impact Categories

### Reliability

Recommendations with an impact on service availability and resiliency:

| Issue | Risk | Example Resources |
|-------|------|-------------------|
| No zone redundancy | An outage results if a single zone fails | VMs, Storage, SQL, AKS |
| Single instance | Nothing to fail over to | App Service, Redis, VMs |
| No backup configured | Risk of losing data | VMs, SQL, Cosmos DB |
| No disaster recovery | Exposed to regional failure | Storage, SQL, Key Vault |

### Security

Recommendations with an impact on security posture:

| Issue | Risk | Example Resources |
|-------|------|-------------------|
| Public endpoint exposed | Exposed attack surface | Storage, SQL, Key Vault |
| Missing encryption | Risk of data exposure | Storage, Disks, SQL |
| No private endpoint | Traffic travels over the public internet | PaaS services |
| Weak TLS version | Vulnerable protocols | App Service, API Management |
| No managed identity | Risk from managing credentials | App Service, Functions, AKS |

### Operational Excellence

Recommendations that improve operations:

| Issue | Risk | Example Resources |
|-------|------|-------------------|
| No diagnostic settings | No visibility into failures | All resources |
| Missing alerts | Slower incident response | All resources |
| No tags | Gaps in governance and cost tracking | All resources |
| Outdated SKU/version | Lacking newer features and security fixes | All resources |

### Cost Optimization

Recommendations for lowering spend:

| Issue | Risk | Example Resources |
|-------|------|-------------------|
| Orphaned disk | Charged for storage nobody uses | Managed Disks |
| Orphaned public IP | Charged for an IP nobody uses | Public IP |
| Oversized SKU | Paying for surplus capacity | VMs, SQL, App Service |
| No reserved capacity | Discounts left on the table | VMs, SQL, Cosmos DB |

## Severity Levels

Use this severity matrix to order remediation work:

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| **Critical** | Security vulnerability carrying active exploit risk | Immediate |
| **High** | Reliability risk that threatens availability | Within 1 week |
| **Medium** | Best-practice violation posing moderate risk | Within 1 month |
| **Low** | Opportunity for optimization | As capacity allows |

## Excel Report Columns

### Recommendations Sheet

| Column | Description |
|--------|-------------|
| Recommendation ID | Identifier that is unique to the recommendation |
| Category | Reliability, Security, Cost, etc. |
| Recommendation | What the issue is |
| Learn More | Documentation link |
| Impacted Resources | Number of resources affected |

### ImpactedResources Sheet

| Column | Description |
|--------|-------------|
| Subscription | Subscription ID (possibly masked) |
| Resource Group | Name of the resource group |
| Type | Azure resource type |
| Name | Name of the resource |
| Recommendation ID | Cross-reference to the Recommendations sheet |
| Recommendation | Description of the issue |
| Learn More | Link to documentation |
| Param1-5 | Extra context (depends on the recommendation) |

### Inventory Sheet

| Column | Description |
|--------|-------------|
| Subscription | Subscription ID |
| Resource Group | Name of the resource group |
| Location | Azure region |
| Type | Resource type |
| Name | Name of the resource |
| SKU | SKU tier/name |
| SLA | SLA percentage as calculated |
| Availability Zones | Configuration of zones |
| Private Endpoint | Status of private endpoint |
| Diagnostic Settings | Status of diagnostic configuration |

## Common Recommendation IDs

High-impact recommendations worth prioritizing:

### Storage Accounts

| ID | Issue |
|----|-------|
| `st-001` | Enable soft delete for blobs |
| `st-002` | Enable soft delete for containers |
| `st-003` | Enable versioning |
| `st-004` | Use private endpoints |
| `st-005` | Disable public blob access |

### Virtual Machines

| ID | Issue |
|----|-------|
| `vm-001` | Enable Azure Backup |
| `vm-002` | Use managed disks |
| `vm-003` | Deploy in availability zones |
| `vm-004` | Enable boot diagnostics |
| `vm-005` | Use managed identity |

### Azure Kubernetes Service

| ID | Issue |
|----|-------|
| `aks-001` | Enable Azure Policy |
| `aks-002` | Use managed identity |
| `aks-003` | Enable Defender for Containers |
| `aks-004` | Use availability zones |
| `aks-005` | Enable cluster autoscaler |

### Key Vault

| ID | Issue |
|----|-------|
| `kv-001` | Enable soft delete |
| `kv-002` | Enable purge protection |
| `kv-003` | Use private endpoints |
| `kv-004` | Enable diagnostic logging |
| `kv-005` | Use RBAC for data plane |

### SQL Database

| ID | Issue |
|----|-------|
| `sql-001` | Enable Transparent Data Encryption |
| `sql-002` | Enable auditing |
| `sql-003` | Use private endpoints |
| `sql-004` | Enable zone redundancy |
| `sql-005` | Enable Advanced Threat Protection |

## Additional Resources

- [Azure Proactive Resiliency Library](https://aka.ms/aprl)
- [Azure Orphaned Resources](https://github.com/dolevshor/azure-orphan-resources)
- [Azure Advisor Documentation](https://learn.microsoft.com/azure/advisor/)
- [Defender for Cloud Recommendations](https://learn.microsoft.com/azure/defender-for-cloud/recommendations-reference)
