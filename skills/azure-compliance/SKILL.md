---
name: azure-compliance
description: >-
  Run Azure security and compliance audits with azqr combined with Key Vault
  expiration checks. Covers best-practice assessment, resource review,
  policy/compliance validation, and evaluation of security posture. WHEN:
  compliance scan, security audit, BEFORE running azqr (compliance cli tool),
  Azure best practices, Key Vault expiration check, expired certificates,
  expiring secrets, orphaned resources, compliance assessment.
metadata:
  author: Microsoft
  version: 1.1.1
  category: development
  source:
    repository: 'https://github.com/microsoft/azure-skills'
    path: skills/azure-compliance
    license_path: LICENSE
    commit: 2cd48ca625cddcc1d377d2861fbddd54417c70cc
---

# Azure Compliance & Security Auditing

## Quick Reference

| Property | Details |
|---|---|
| Best for | Compliance scanning, security auditing, and Key Vault expiration monitoring |
| Primary capabilities | Comprehensive Resources Assessment, Key Vault Expiration Monitoring |
| MCP tools | azqr, subscription and resource group listing, Key Vault item inspection |

## When to Use This Skill

- Run a compliance assessment using azqr or Azure Quick Review
- Compare Azure resource configuration to best practices
- Identify orphaned or misconfigured resources
- Audit Key Vault keys, secrets, and certificates for upcoming or past expiration

## Skill Activation Triggers

Invoke this skill whenever the user asks to:
- Check Azure compliance or best-practice conformance
- Assess Azure resources for configuration issues
- Run azqr or Azure Quick Review
- Find resources that are orphaned or misconfigured
- Review Azure security posture
- "Show me expired certificates/keys/secrets in my Key Vault"
- "Check what's expiring in the next 30 days"
- "Audit my Key Vault for compliance"
- "Find secrets without expiration dates"
- "Check certificate expiration dates"

## Prerequisites

- Authentication: the user is logged in to Azure via `az login`
- Read access to resource configuration and Key Vault metadata

## Assessments

| Assessment | Reference |
|------------|-----------|
| Comprehensive Compliance (azqr) | [references/azure-quick-review.md](references/azure-quick-review.md) |
| Key Vault Expiration | [references/azure-keyvault-expiration-audit.md](references/azure-keyvault-expiration-audit.md) |
| Resource Graph Queries | [references/azure-resource-graph.md](references/azure-resource-graph.md) |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_extension_azqr` | Run azqr compliance scans |
| `mcp_azure_mcp_subscription_list` | List the subscriptions available |
| `mcp_azure_mcp_group_list` | List resource groups |
| `keyvault_key_list` | List all keys held in the vault |
| `keyvault_key_get` | Fetch key details, including expiration |
| `keyvault_secret_list` | List all secrets held in the vault |
| `keyvault_secret_get` | Fetch secret details, including expiration |
| `keyvault_certificate_list` | List all certificates held in the vault |
| `keyvault_certificate_get` | Fetch certificate details, including expiration |

## Assessment Workflow

1. Choose the scope (subscription or resource group) for the Comprehensive Resources Assessment.
2. Execute azqr and collect the output artifacts.
3. Review the Scan Results and produce a summary of findings and recommendations.
4. Go over the Key Vault Expiration Monitoring output covering keys, secrets, and certificates.
5. Categorize the issues and suggest remediation or fix steps for every finding.

### Priority Classification

| Priority | Guidance |
|---|---|
| Critical | High-impact exposure that must be remediated immediately |
| High | Address within days to lower risk |
| Medium | Schedule a fix for the upcoming sprint |
| Low | Log it and address during routine maintenance |

## Error Handling

| Error | Message | Remediation |
|---|---|---|
| Authentication required | "Please login" | Execute `az login`, then try again |
| Access denied | "Forbidden" | Check permissions and correct role assignments |
| Missing resource | "Not found" | Double-check the chosen subscription and resource group |

## Best Practices

- Schedule compliance scans at a regular cadence (weekly or monthly)
- Monitor findings over time and confirm that remediations worked
- Keep compliance reporting separate from remediation execution
- Document and enforce Key Vault expiration policies

## SDK Quick References

For accessing Key Vault programmatically, consult the condensed SDK guides:

- **Key Vault (Python)**: [Secrets/Keys/Certs](references/sdk/azure-keyvault-py.md)
- **Secrets**: [TypeScript](references/sdk/azure-keyvault-secrets-ts.md) | [Rust](references/sdk/azure-keyvault-secrets-rust.md) | [Java](references/sdk/azure-security-keyvault-secrets-java.md)
- **Keys**: [.NET](references/sdk/azure-security-keyvault-keys-dotnet.md) | [Java](references/sdk/azure-security-keyvault-keys-java.md) | [TypeScript](references/sdk/azure-keyvault-keys-ts.md) | [Rust](references/sdk/azure-keyvault-keys-rust.md)
- **Certificates**: [Rust](references/sdk/azure-keyvault-certificates-rust.md)
