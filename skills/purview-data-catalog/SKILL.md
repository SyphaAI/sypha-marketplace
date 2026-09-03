---
name: purview-data-catalog
description: >-
  Guidance for the Microsoft Purview Unified Catalog (data catalog) —
  business-friendly discovery, governance domains, data products, glossary
  terms, and data quality on top of the Data Map. Covers governance domains,
  data products, and curation. WHEN: Purview data catalog, unified catalog, data
  products, governance domain, business glossary, data quality, data discovery
  for analysts, curate data assets, data stewardship.
metadata:
  author: Microsoft
  version: 0.1.0
  category: data
  source:
    repository: 'https://github.com/vinayaklatthe/microsoft-security-skills'
    path: skills/purview-data-catalog
    license_path: LICENSE
    commit: 15f16df4ae50261328da8b82f3f0964cac0899ae
---

# Microsoft Purview Unified Catalog

The Unified Catalog delivers business-friendly data discovery and governance built on top of the
Data Map: it organizes assets into **governance domains** and **data products** with glossary
terms, ownership, and data quality. This skill covers the **catalog/business layer**; the Data
Map (`purview-data-map`) handles the technical scanning layer below it.

## When to use
Apply this skill when analysts and data consumers need to **find, trust, and request**
data — not when the goal is to *scan* sources (that is the Data Map's responsibility).

**Do not use this skill** for:
- Scanning lakehouses, databases, SaaS sources (use `purview-data-map`)
- Sensitivity labels for security/compliance (use `purview-data-classification`)
- Lifecycle/retention rules (use `purview-data-lifecycle`)
- AI data discovery (use `purview-dspm-ai`)

## Pick the right object for the job

| If you want to... | Object | Owned by |
|---|---|---|
| Define a business area with accountability (Finance, HR, Supply Chain) | **Governance domain** | Domain owner (business) |
| Bundle related assets into something an analyst can request and consume | **Data product** | Data product owner (business) |
| Give a business term a shared definition tied to data assets | **Glossary term** | Domain steward |
| Measure trustworthiness of a critical data element | **Data quality rule** + score | Data steward |
| Show how a column flows from source to report | **Lineage** (auto, from Data Map scans) | System-generated |
| Grant a consumer access to a data product | **Access policy / request workflow** | Data product owner |

> **Rule of thumb:** begin with **1-2 governance domains and 5-10 data products**. A catalog
> containing 200 lightly-curated products delivers less value than one with 10 well-maintained ones.
> Depth of curation always outweighs breadth of coverage.

## Approach

A catalog rollout fails when IT "loads everything" without business ownership in place. Follow the
sequence; each step is a prerequisite for the next.

1. **Pre-requisite: Data Map is scanning and producing technical metadata** — The Unified
   Catalog depends on the Data Map. Verify that scans are running, lineage is being populated,
   and classifications are triggering **before** designing domains.
   *Verify: Data Map shows scanned assets with classifications (e.g. "Credit Card Number")
   and at least one lineage link source → sink.*
2. **Pick the right governance domains** — Start with **2-3 high-pain business areas**, not the
   org chart. Strong initial candidates: Finance (regulatory pressure), Customer (consent and CRM
   sprawl), HR (privacy). Each domain requires a named **business owner** with available time, not a
   delegated IT stand-in.
   *Verify: each domain has a named accountable owner from the business side with a
   recurring 30-min weekly slot for curation.*
3. **Publish 3-5 data products per domain** — A data product groups related assets around a
   specific consumer use case (e.g. *"Customer 360 for marketing analysts"*). Every product must include:
   description, linked glossary terms, an owner, access guidance, and at least one data quality
   rule on a key column. Avoid publishing empty shells.
   *Verify: a representative consumer can locate the product, understand its contents, and
   request access through the in-portal workflow without outside assistance.*
4. **Build the glossary in parallel, not first** — Assembling a 500-term glossary upfront
   results in a graveyard of terms with no asset links. Define terms **alongside the products** that need them;
   each term must link to at least one data product or asset before publication.
   *Verify: every published glossary term is linked to ≥1 data asset.*
5. **Assign stewardship to named individuals, not teams** — "Owned by the data team" means
   owned by nobody. Each governance domain and data product must have a single named steward.
   Stewardship workload should stay below 4 hours/week per steward, or the practice will break down.
6. **Configure data quality on critical data elements only** — Avoid scanning everything. Select
   **5-10 critical data elements** per data product (e.g. *customer_id*, *order_amount*,
   *date_of_birth*) and define rules covering completeness, uniqueness, validity, and freshness. Surface
   the resulting score on the product page.
   *Verify: each high-priority data product shows a quality score and the rules behind it.*
7. **Drive adoption through discoverability** — Connect the catalog to Power BI (catalog endorsement
   appears in the BI service), Microsoft Search, and Teams. If consumers cannot find products
   in the tools they already use, catalog adoption will not happen.
   *Verify: a Power BI dataset surfaces its catalog endorsement; a Teams search returns a
   linked data product.*
8. **Run it as an ongoing programme** — Monthly: audit unowned assets, stale products, and
   broken lineage. Quarterly: domain owner review of curation completeness. Annually:
   retire and sunset obsolete products.

## Guardrails
- **Align catalog access with Data Map collection permissions.** A consumer without scan-level
  access cannot see the underlying asset even if the catalog product is published to them —
  permissions are AND, not OR. Coordinate both together.
- **Curation is a continuous programme, not a one-time load.** Without consistent weekly steward effort,
  the catalog becomes stale within a quarter and consumer trust collapses.
- **Avoid auto-bulk-publishing.** Importing 10,000 assets via scan does not create a catalog. Assets without
  curation are noise that obscures the valuable products.
- **Glossary terms without asset links are graveyards.** Enforce a "must link to publish" policy.
- **Data quality rules consume compute.** Each rule executes on a schedule and reads data. Restrict them to
  critical data elements; do not attach quality rules to every column.
- **Unchecked domain growth kills the programme.** 3 domains with depth beats 30 with names only.
  Add a domain only once an existing one contains more than 10 well-curated data products.
- **Personal data requires governance, not just publishing.** If a product includes personal data,
  coordinate with the privacy team (Priva) before making it visible in consumer search.

## Common anti-patterns
- **"Build the glossary first."** 500 terms, 0 asset links, programme collapses within 6 months.
  Build terms in step with the products that require them.
- **"Auto-publish every scanned asset."** The catalog floods with noise, consumers cannot find anything,
  trust drops and never recovers.
- **"One steward owns 50 products."** That is not stewardship — it is a queue. Cap ownership at ~10 products per
  steward.
- **"Catalog as compliance theatre."** Published to check an audit box, with no consumer usage
  and no curation budget. Either invest properly or sunset it.
- **"Skip discoverability integration."** The catalog exists but consumers keep searching Teams/SharePoint
  for data instead. Wire it into existing workflows or accept zero adoption.
- **"Data quality on everything."** Compute costs explode and meaningful signal drowns in noise.
  Restrict quality rules to critical data elements only.

## Example prompts
- `Set up the Purview unified catalog with governance domains and data products.`
- `Which governance domains should I start with?`
- `Build a business glossary and data quality rules.`
- `How do analysts discover and curate data assets?`
- `Establish data stewardship in the data catalog.`
- `How many data products should one steward own?`

## Microsoft Learn
- Unified Catalog overview: https://learn.microsoft.com/purview/unified-catalog
- Governance domains: https://learn.microsoft.com/purview/concept-governance-domain
- Data products: https://learn.microsoft.com/purview/concept-data-products
- Glossary terms: https://learn.microsoft.com/purview/concept-business-glossary
- Data quality overview: https://learn.microsoft.com/purview/data-quality-overview
- Roles in Unified Catalog: https://learn.microsoft.com/purview/catalog-permissions
- Power BI integration: https://learn.microsoft.com/purview/how-to-search-catalog
