# Azure Resource Graph Queries for Compliance Auditing

Azure Resource Graph (ARG) provides fast resource querying across subscriptions with KQL through `az graph query`. It is useful for compliance scanning, tag audits, and configuration validation.

## How to Query

Generate `az graph query` commands with the `extension_cli_generate` MCP tool:

```yaml
mcp_azure_mcp_extension_cli_generate
  intent: "query Azure Resource Graph to <describe what you want to audit>"
  cli-type: "az"
```

Or build the command yourself:

```bash
az graph query -q "<KQL>" --query "data[].{name:name, type:type}" -o table
```

> ⚠️ **Prerequisite:** `az extension add --name resource-graph`

## Key Tables

| Table | Contains |
|-------|----------|
| `Resources` | Every ARM resource (name, type, location, properties, tags) |
| `ResourceContainers` | Subscriptions, resource groups, management groups |
| `AuthorizationResources` | Role definitions and role assignments |
| `AdvisorResources` | Recommendations from Azure Advisor |

## Compliance Query Patterns

**Locate resources that lack a required tag:**

```kql
Resources
| where isnull(tags['Environment']) or isnull(tags['CostCenter'])
| project name, type, resourceGroup, tags
```

**Analyze tag coverage:**

```kql
Resources
| extend hasEnvTag = isnotnull(tags['Environment'])
| summarize total=count(), tagged=countif(hasEnvTag) by type
| extend coverage=round(100.0 * tagged / total, 1)
| order by coverage asc
```

**Locate storage accounts that do not enforce HTTPS:**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where properties.supportsHttpsTrafficOnly == false
| project name, resourceGroup, location
```

**Locate resources where public network access is enabled:**

```kql
Resources
| where properties.publicNetworkAccess =~ 'Enabled'
| project name, type, resourceGroup, location
```

**List role assignments across subscriptions:**

```kql
AuthorizationResources
| where type == 'microsoft.authorization/roleassignments'
| extend principalType = tostring(properties.principalType)
| summarize count() by principalType
```

**Locate resource groups that have no locks:**

```kql
ResourceContainers
| where type == 'microsoft.resources/subscriptions/resourcegroups'
| project rgName=name, rgId=id
| join kind=leftanti (
    Resources
    | where type == 'microsoft.authorization/locks'
    | project rgId=tostring(properties.resourceId)
) on rgId
```

## Tips

- Match types case-insensitively with `=~` (resource types are lowercase)
- Drill into properties using `properties.fieldName`
- Cap the number of results with `--first N`
- Restrict the query to particular subscriptions with `--subscriptions`
- Pair with `AdvisorResources` to surface security recommendations
