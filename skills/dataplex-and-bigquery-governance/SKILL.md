---
name: dataplex-and-bigquery-governance
description: >-
  Guides agents through GCP-native data governance workflows using Dataplex and
  BigQuery. Invoke when designing lakes, zones, policy tags, metadata quality,
  lineage, discovery, and governed publishing across Cloud Storage, BigQuery,
  Dataflow, Dataproc, and Google Cloud analytics platforms.
metadata:
  category: data
  source:
    repository: 'https://github.com/vaquarkhan/data-engineering-agent-skills'
    path: skills/dataplex-and-bigquery-governance
    license_path: LICENSE
    commit: 421ef57e8d42c464b29339193c18dd5bd2946bc2
---

# Dataplex And BigQuery Governance

## Overview

Apply this skill when governance on `GCP` revolves around `Dataplex`, `BigQuery`, and related Google Cloud metadata controls. It assists agents in defining governance zones, policy-tag boundaries, lineage expectations, and trusted publishing patterns for warehouse and lake platforms.

## When to Use

- designing `Dataplex` lakes, zones, or governance domains
- defining `BigQuery` policy tags and governed publish boundaries
- strengthening metadata quality, lineage, and discovery on `GCP`
- unifying warehouse and lake governance across `Cloud Storage`, `BigQuery`, `Dataflow`, and `Dataproc`
- enabling governed analytics delivery under regional or regulated-data controls

Do not reduce `BigQuery` governance to a permissions-only concern. Trusted publishing also depends on metadata, ownership, and well-defined policy boundaries.

## Workflow

1. Define the governance boundary.
   Determine:
   - lakes and zones
   - datasets and domains
   - producer versus consumer boundaries
   - ownership expectations

2. Define metadata and policy controls.
   Specify:
   - policy tags
   - classifications
   - lineage coverage
   - discovery metadata
   - trusted versus exploratory asset signaling

3. Align lake and warehouse governance.
   Make explicit how `Cloud Storage`, `BigQuery`, and processing services conform to the same control model.

4. Design governed publish behavior.
   Establish:
   - clear serving boundaries
   - ownership visibility
   - release or validation evidence where appropriate
   - rules governing schema and policy changes

5. Validate day-2 operations.
   Assess whether onboarding, schema evolution, and new domains remain manageable within the governance model.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "Policy tags are the whole governance design." | Tags help, but they do not replace ownership, zone design, trusted publishing, or metadata quality. |
| "Dataplex is only for lake governance." | Many teams need a unified governance model spanning storage, warehouse, and processing surfaces. |
| "Discovery will happen automatically once assets are scanned." | Meaningful discovery requires curated metadata and trust signals. |

## Red Flags

- lake, dataset, and domain boundaries are inconsistent
- policy tags exist without ownership or publish context
- warehouse and lake governance operate differently with no documented rule
- certification or trusted-asset behavior is absent
- schema and policy changes are operationally ambiguous

## Verification

- [ ] Governance boundaries are explicit across lake and warehouse surfaces
- [ ] Policy tags, metadata, and lineage expectations are defined
- [ ] Publish behavior is governed and auditable
- [ ] Ownership and discovery expectations are visible
- [ ] Day-2 operations are compatible with the governance design
