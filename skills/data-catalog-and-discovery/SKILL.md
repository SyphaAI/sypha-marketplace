---
name: data-catalog-and-discovery
description: >-
  Walks agents through data catalog, discovery, and metadata quality workflows.
  Invoke when publishing datasets, improving discoverability, curating lineage
  metadata, or helping other teams locate and trust data products.
metadata:
  category: data
  source:
    repository: 'https://github.com/vaquarkhan/data-engineering-agent-skills'
    path: skills/data-catalog-and-discovery
    license_path: LICENSE
    commit: 421ef57e8d42c464b29339193c18dd5bd2946bc2
---

# Data Catalog And Discovery

## Overview

Apply this skill when the work goes beyond constructing data pipelines to ensuring the data is understandable and easy to find. It guides agents to treat metadata, ownership, lineage, and usage context as first-class delivery outputs rather than as tasks deferred until later.

## When to Use

- publishing a new shared dataset
- improving catalog metadata quality
- curating lineage, tags, or ownership information
- reducing duplicate datasets created because teams cannot find trusted ones

Filling in a title and description is not sufficient. Achieving real discovery quality also requires operational context.

## Workflow

1. Establish the discovery contract.
   Required fields:
   - owner
   - business description
   - technical description
   - grain
   - freshness expectation
   - intended consumers

2. Attach the asset to its lineage.
   Document upstream sources, transformation layers, and key downstream consumers where available.

3. Include trust signals.
   Common signals:
   - quality status
   - SLA or freshness status
   - certification or review state
   - deprecation state

4. Tag for genuine discoverability, not superficial taxonomy.

5. Update metadata whenever the contract changes.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The table name is descriptive enough." | Names alone do not explain grain, trust, or ownership. |
| "We can catalog it after people start using it." | Poor discovery usually leads to duplicate local copies first. |
| "Lineage is a platform problem, not a delivery problem." | Producers know the business meaning and must help make lineage useful. |

## Red Flags

- shared datasets have no owner or description
- certified and experimental assets are indistinguishable
- metadata is copied from schema names without business meaning
- deprecation state is absent for old assets

## Verification

- [ ] Ownership, description, grain, and freshness are documented
- [ ] Lineage or source context is attached
- [ ] Trust signals exist for consumers
- [ ] Discovery metadata is updated when the contract changes
