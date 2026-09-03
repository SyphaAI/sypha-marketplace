# Key Vault Expiration Audit & Compliance

Automated auditing of Azure Key Vault resources that surfaces expired or soon-to-expire keys, secrets, and certificates before they can disrupt services.

## Overview

This skill watches Azure Key Vault resources (keys, secrets, certificates) for expiration problems. It helps avoid service disruptions by flagging:
- **Expired resources** that are actively causing problems
- **Expiring soon** (inside a customizable days threshold)
- **Missing expiration dates** (a security risk)
- **Disabled resources** that should be cleaned up

## Core Workflow

1. **List Resources**: Enumerate the keys, secrets, and certificates in the target vault(s)
2. **Get Details**: Pull expiration metadata for every resource
3. **Analyze Status**: Check expiration dates against today's date and the threshold
4. **Generate Report**: Group findings by priority and pair them with actionable recommendations

## Audit Patterns

### Pattern 1: Single Vault Quick Scan
Examine a single Key Vault for every expiration issue, with a configurable day threshold (default: 30 days).

**Tools**: `keyvault_key_list`, `keyvault_key_get`, `keyvault_secret_list`, `keyvault_secret_get`, `keyvault_certificate_list`, `keyvault_certificate_get`

### Pattern 2: Multi-Vault Compliance Report
Sweep several vaults across the subscription for a full security review.

**Use for**: Quarterly audits, organization-wide compliance checks

### Pattern 3: Resource Type Focus
Limit the audit to keys, secrets, OR certificates when a particular resource type is called out.

**Use for**: Certificate renewal planning, secret rotation tracking

### Pattern 4: Emergency Expired Finder
Fast scan targeting resources that have already expired (negative days) to debug an active incident.

**Use for**: Production issues, authentication failures

## Key Data Fields

When pulling resource details, look at these fields:
- **expiresOn**: Expiration timestamp (null = no expiration set - security risk!)
- **enabled**: Whether the resource is active (false = disabled/inactive)
- **notBefore**: The point at which the resource becomes valid
- **createdOn/updatedOn**: Useful for tracking resource age and the last rotation
- **subject/issuer**: Metadata specific to certificates

## Report Format

Structure the findings as:
- **Summary Statistics**: Per resource type — total count, expired count, expiring count, no-expiration count
- **Critical Issues**: Expired resources that need action right away
- **Warnings**: Items expiring inside the threshold (e.g., 30 days)
- **Risks**: Resources lacking expiration dates
- **Recommendations**: Set expiration policies, rotate credentials, remove disabled items

## Remediation Priority

**🔴 Critical** - Expired (< 0 days): Rotate immediately
**🟠 High** - Expiring 0-7 days: Schedule rotation within 24 hours
**🟡 Medium** - Expiring 8-30 days: Plan rotation within 1 week
**🟡 Medium** - No expiration set: Apply expiration policy
**🟢 Low** - Active (> 30 days): Monitor on regular schedule

## Best Practices

- Audit weekly so problems surface early
- Every resource should carry an expiration date (Azure Policy recommendation)
- Set up Azure Event Grid to notify 30 days ahead
- Rotation schedule: Secrets every 60-90 days, Keys annually, Certificates per CA requirements (max 1 year)
- Give production Key Vaults priority over dev/test
- Use Azure Functions or Logic Apps to automate rotation

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `keyvault_key_list` | Enumerate all keys in a vault |
| `keyvault_key_get` | Fetch key details, expiration included |
| `keyvault_secret_list` | Enumerate all secrets in a vault |
| `keyvault_secret_get` | Fetch secret details, expiration included |
| `keyvault_certificate_list` | Enumerate all certificates in a vault |
| `keyvault_certificate_get` | Fetch certificate details, expiration included |

**Required**: `vault` (Key Vault name)
**Optional**: `subscription`, `tenant`

## Fallback Strategy: Azure CLI Commands

Should the Azure MCP Key Vault tools fail, time out, or be unavailable, fall back to Azure CLI commands.

### CLI Command Reference

| Operation | Azure CLI Command |
|-----------|-------------------|
| List secrets | `az keyvault secret list --vault-name <vault-name>` |
| Get secret details | `az keyvault secret show --vault-name <vault-name> --name <secret-name>` |
| List keys | `az keyvault key list --vault-name <vault-name>` |
| Get key details | `az keyvault key show --vault-name <vault-name> --name <key-name>` |
| List certificates | `az keyvault certificate list --vault-name <vault-name>` |
| Get certificate details | `az keyvault certificate show --vault-name <vault-name> --name <cert-name>` |

### When to Fallback

Move to Azure CLI when:
- The MCP tool comes back with a timeout error
- The MCP tool reports "service unavailable" or connection errors
- The MCP tool needs more than 30 seconds to respond
- The response is empty even though the vault is known to contain resources

## Common Issues

- **Access Denied**: Confirm RBAC permissions (Key Vault Reader + data plane access)
- **Vault Not Found**: Verify the vault name and subscription context
- **Null expiresOn**: The resource carries no expiration (security risk - requires policy)
- **Time zones**: Every timestamp is UTC
