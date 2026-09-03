---
name: purview-data-map
description: >-
  Guidance for the Microsoft Purview Data Map - the foundation that scans and
  maps data sources across multicloud and on-premises estates to power
  cataloging and governance. Covers source registration, integration runtimes
  (managed vs self-hosted), scan rule sets, classifications, collections, and
  cost control. WHEN: Purview Data Map, scan data sources, register data source,
  data discovery, integration runtime, map enterprise data, multicloud data
  scanning, classification scan, collections, glossary.
metadata:
  author: Microsoft
  version: 0.1.0
  category: data
  source:
    repository: 'https://github.com/vinayaklatthe/microsoft-security-skills'
    path: skills/purview-data-map
    license_path: LICENSE
    commit: 15f16df4ae50261328da8b82f3f0964cac0899ae
---

# Microsoft Purview Data Map

The Data Map forms the foundational layer of Microsoft Purview data governance: it discovers, scans,
and maps metadata and classifications from data sources spanning Azure, multicloud, SaaS, and
on-premises — feeding the Unified Catalog, lineage, and downstream protection decisions.

## When to use
Use this skill when building an enterprise-wide inventory of data assets and their classifications to
underpin governance, security, and data product publishing.

Do not use this skill for in-tenant Microsoft 365 classification (use `purview-data-classification`)
or for AI prompt visibility (use `purview-dspm-ai`).

## Pick the right integration runtime
| Source location | Use this runtime |
|---|---|
| Azure (Storage, SQL, Synapse, Fabric, Cosmos) | **Managed** (Azure-hosted) runtime |
| AWS S3 / RDS, GCP BigQuery, public SaaS | Managed runtime, with credentials in Key Vault |
| On-premises SQL, Oracle, file shares | **Self-hosted integration runtime (SHIR)** on a domain-joined Windows host |
| Private-endpoint-only Azure sources | SHIR or VNet-integrated managed runtime |
| Power BI tenant | Native connector, no runtime config |

Rule of thumb: start with the managed runtime; deploy SHIR only when network or private-endpoint reach
demands it — and treat the SHIR host as Tier-0 infrastructure.

## Approach
1. **Plan collections** - Design the collection hierarchy (by business domain or geography)
   before registering any sources; collections govern RBAC and asset organization.
   *Verify: a draft collection tree exists and maps to data-owner accountability.*
2. **Register sources** - Attach data sources (Azure Storage, SQL, Synapse, Fabric, AWS S3,
   databases, Power BI, etc.) to the appropriate collection using suitable credentials.
   *Verify: each registered source shows the correct subscription/account and target collection.*
3. **Choose an integration runtime** - Use the **managed** runtime for cloud sources; deploy a
   **self-hosted integration runtime** to securely reach on-premises or private-network sources.
   *Verify: SHIR status is Running and self-update is enabled.*
4. **Configure scans and rule sets** - Schedule scans with scan rule sets; apply
   **classifications** (built-in SITs and custom) and lineage extraction wherever supported. Begin
   with incremental, not full scans.
   *Verify: scan history shows successful runs with a classified asset count.*
5. **Curate** - Review discovered assets, attach glossary terms, and designate data owners/stewards;
   refine custom classifications based on real-world matches.
   *Verify: top assets have owners and at least one glossary term.*
6. **Govern access** - Use collections to structure assets and scope permissions by domain;
   assign roles at the collection level rather than root.
   *Verify: collection-admin roles are assigned to domain owners, not the platform team alone.*
7. **Operate** - Track scan failures, classification drift, and cost; calibrate scan frequency to
   match the criticality of each source.
   *Verify: a weekly scan-health report is in place.*

## Guardrails
- Scope and schedule scans carefully to keep costs and source load manageable; on day one, sample first and run full scans second.
- Treat the self-hosted integration runtime host as sensitive infrastructure — it holds
  credentials and connects directly to production data sources; keep it patched, restrict logons, and monitor it.
- Validate classification accuracy before using it to drive downstream protection — sample matches
  per SIT and adjust confidence levels accordingly.
- Store credentials in Key Vault; never hard-code secrets into scan configuration.
- Plan capacity carefully — Data Map is billed by capacity units; oversized scans drive up cost without adding governance value.

## Common anti-patterns
- Registering every source into the root collection and granting everyone the Data Reader role.
- Scheduling weekly full scans against petabyte-scale data lakes — this exhausts capacity and budget rapidly.
- Running SHIR on a developer workstation or shared jump host.
- Omitting the glossary and ownership step — assets end up classified but no one acts on the findings.
- Treating the Data Map as a one-time load rather than a continuously curated catalogue.

## Example prompts
- `Register and scan data sources in the Purview Data Map.`
- `Configure an integration runtime for multicloud data scanning.`
- `How do I map enterprise data and run classification scans?`
- `Plan data discovery across cloud and on-prem sources.`
- `Design a Purview collection hierarchy aligned to business domains.`

## Microsoft Learn
- Data Map overview: https://learn.microsoft.com/purview/concept-elastic-data-map
- Register & scan sources: https://learn.microsoft.com/purview/scan-data-sources
- Manage integration runtimes: https://learn.microsoft.com/purview/manage-integration-runtimes
- Classifications: https://learn.microsoft.com/purview/concept-classification
- Collections & access control: https://learn.microsoft.com/purview/how-to-create-and-manage-collections
- Pricing & capacity: https://learn.microsoft.com/purview/concept-elastic-data-map
