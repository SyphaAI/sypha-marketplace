# Azure Quick Review Compliance Assessment

This skill supports full Azure compliance assessments with Azure Quick Review (azqr): it evaluates findings against Azure best practices and delivers actionable remediation guidance.

## Prerequisites

- **Azure authentication** - Signed in through Azure CLI (`az login`) or via Service Principal/Managed Identity
- **Reader permissions** - At minimum the Reader role on the target subscription or management group

## Assessment Workflow

### Step 1: Determine Scan Scope

Ask the user, or infer from context:

| Scope | Use Case | Required Info |
|-------|----------|---------------|
| Subscription | Assessment of the whole subscription | Subscription ID |
| Resource Group | Narrowly targeted assessment | Subscription ID + Resource Group name |
| Management Group | Assessment across the enterprise | Management Group ID |
| Specific Service | In-depth look at a single resource type | Subscription ID + Service abbreviation |

### Step 2: Run Compliance Scan

Launch the scan with the Azure MCP tool:

```
mcp_azure_mcp_extension_azqr
  subscription: <subscription-id>
  resource-group: <optional-rg-name>
```

### Step 3: Analyze Scan Results

The scan outputs an Excel file containing these sheets:

| Sheet | Contents | Priority |
|-------|----------|----------|
| **Recommendations** | Every recommendation plus the count of impacted resources | High |
| **ImpactedResources** | Resources that have concrete issues to fix | High |
| **Inventory** | Every scanned resource with SKU, Tier, SLA details | Medium |
| **Advisor** | Recommendations from Azure Advisor | Medium |
| **DefenderRecommendations** | Findings from Microsoft Defender for Cloud | High |
| **Azure Policy** | Resources out of compliance per Azure Policy | Medium |
| **Costs** | Cost history for the past 3 months by subscription | Low |
| **Defender** | Status and tiers of Defender plans | Medium |
| **OutOfScope** | Resources that were not scanned | Low |

**Focus analysis on:**
1. High-severity recommendations from ImpactedResources
2. Defender recommendations (security-critical)
3. Advisor recommendations (reliability/performance)
4. Policy non-compliance (governance)

### Step 4: Categorize Findings

Group the findings into categories so remediation can be prioritized:

| Category | Examples | Severity |
|----------|----------|----------|
| **Security** | Public endpoints, missing encryption, no private endpoints | Critical |
| **Reliability** | No zone redundancy, single instance, no backup | High |
| **Performance** | Undersized SKUs, missing caching, no CDN | Medium |
| **Cost** | Orphaned resources, oversized SKUs, unused reservations | Medium |
| **Operations** | Missing diagnostics, no alerts, no tags | Low |

### Step 5: Generate Remediation Guidance

For every high-priority finding:
1. Describe the risk in plain language
2. Offer remediation options (Portal, CLI, Bicep)
3. Give an estimate of effort and impact

See [azqr-remediation-patterns.md](azqr-remediation-patterns.md) for common fix templates.

### Step 6: Present Summary

Deliver a structured summary:

```markdown
## Compliance Assessment Summary

**Scope:** [Subscription/RG/MG name]
**Scanned:** [Date/Time]
**Resources Analyzed:** [Count]

### Key Findings

| Severity | Count | Top Issues |
|----------|-------|------------|
| Critical | X | [List top 3] |
| High | X | [List top 3] |
| Medium | X | [List top 3] |

### Recommended Actions

1. **[Issue]** - [Brief remediation]
2. **[Issue]** - [Brief remediation]
3. **[Issue]** - [Brief remediation]

### Next Steps
- [ ] Address critical security findings
- [ ] Review and remediate high-severity items
- [ ] Schedule follow-up scan to verify fixes
```

## Supported Azure Services

azqr covers 70+ Azure resource types, among them:

- Azure Kubernetes Service (AKS)
- API Management
- App Configuration
- App Service
- Container Apps
- Cosmos DB
- Container Registry
- Key Vault
- Load Balancer
- Azure Database for MySQL
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Service Bus
- Azure SQL Database
- Storage Accounts
- Virtual Machines
- Virtual Networks

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_extension_azqr` | Execute azqr scans through Azure MCP |
| `mcp_azure_mcp_subscription_list` | Enumerate the available subscriptions |
| `mcp_azure_mcp_group_list` | Enumerate resource groups in a subscription |

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| Permission denied | 403 errors during scan | Confirm the Reader role on the scope |
| Not authenticated | `AADSTS` errors | Start with `az login` |
| Slow scan | The scan runs very long | Scope to a resource group |

## Example Prompts

- "Check my Azure subscription for compliance issues"
- "Run azqr on my production resource group"
- "What Azure resources don't follow best practices?"
- "Assess my storage accounts for security issues"

## Reference Documentation

- [Recommendation Categories](azqr-recommendations.md)
- [Remediation Patterns](azqr-remediation-patterns.md)
- [Azure Quick Review Documentation](https://azure.github.io/azqr/docs/)
- [Azure Proactive Resiliency Library](https://aka.ms/aprl)
