---
title: "D2 — Schema Evolution"
description: "Troubleshoot schema evolution issues when source data schemas change over time"
status: active
severity: MEDIUM
triggers:
  - "schema evolution"
  - "column type changed"
  - "new columns not visible"
  - "schema mismatch between partitions"
  - "incompatible schema"
owner: devops-agent
objective: "Resolve schema evolution conflicts between old and new data formats in the Data Catalog"
context: "Schema evolution occurs when source data adds columns, removes columns, or changes column types over time. Parquet and ORC support schema evolution natively (add columns). CSV and JSON require careful handling. Crawlers may or may not update schemas based on SchemaChangePolicy. Partition-level schema differences can cause query failures in Athena and Spark."
---

## Phase 1 — Triage

MUST:
- Check current table schema: `aws glue get-table --database-name <db> --table-name <table>`
- Compare partition schemas for inconsistencies: `aws glue get-partitions --database-name <db> --table-name <table>`
- Determine what changed (new columns, removed columns, type changes)
- Check crawler SchemaChangePolicy: `aws glue get-crawler --name <crawler-name>`

SHOULD:
- Examine source file schemas across different time periods
- Confirm whether Parquet/ORC files use compatible schema evolution (column addition is safe; type changes are not)
- Assess whether downstream jobs are compatible with the updated schema

MAY:
- Check Glue Schema Registry for schema versions if the registry is in use
- Review Athena query errors that may be related to schema mismatches

## Phase 2 — Remediate

MUST:
- Update the table schema to incorporate new columns with the correct types
- Correct partition-level schema inconsistencies: `aws glue batch-update-partition`
- Verify that downstream jobs correctly handle the schema change

SHOULD:
- Use Parquet or ORC to gain native schema evolution support (column addition without file rewrites)
- Set the crawler SchemaChangePolicy to LOG to prevent automatic schema overwrites
- Apply DynamicFrame resolveChoice() within Glue jobs to handle ambiguous column types

MAY:
- Adopt Glue Schema Registry for versioning schemas and enforcing compatibility
- Write schema migration scripts for breaking schema changes
- Leverage Athena's schema-on-read behavior with IGNORE_MISSING_COLUMNS

## Common Issues

- symptoms: "New columns added to source data not visible in queries"
  diagnosis: "The catalog table schema has not been updated to include the new columns."
  resolution: "Run crawler with UPDATE_IN_DATABASE policy, or manually add columns with update-table."

- symptoms: "Query fails with 'column type mismatch' across partitions"
  diagnosis: "Different partitions carry different schemas (e.g., old partitions store a value as string while new partitions store it as int)."
  resolution: "Update all partition schemas to be consistent. Use batch-update-partition. Consider backfilling old data."

- symptoms: "Crawler overwrites schema and breaks downstream jobs"
  diagnosis: "SchemaChangePolicy is set to UPDATE_IN_DATABASE and the crawler has detected a different schema."
  resolution: "Set SchemaChangePolicy to LOG. Manually review and apply schema changes. Define tables manually for critical schemas."

## Output Format

```yaml
root_cause: "schema_evolution — <specific_cause>"
evidence:
  - type: table_schema
    content: "<current vs expected schema>"
  - type: partition_schemas
    content: "<schema differences across partitions>"
severity: MEDIUM
mitigation:
  immediate: "Update table and partition schemas for consistency"
  long_term: "Use columnar formats, Schema Registry, and LOG policy"
```


## Safety Ratings
```
safety_ratings:
  - "Check table and partition schemas: GREEN — read-only API calls"
  - "Check crawler SchemaChangePolicy: GREEN — read-only inspection"
  - "Update table schema: YELLOW — changes metadata for all consumers"
  - "Batch update partition schemas: YELLOW — changes partition metadata"
  - "Set SchemaChangePolicy to LOG: GREEN — prevents automatic overwrites"
```

## Escalation Conditions
- Job processes production data pipeline
- Schema changes breaking downstream queries
- Partition-level schema inconsistencies across time periods
- Breaking schema changes requiring data backfill
- Schema evolution affecting multiple consumers

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Table schemas: data structure and column names"
    - "Partition schemas: per-partition data structure"
    - "Schema versions: data evolution history"
  handling: "Schema details reveal data structure. Do not expose column names externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER allow crawlers to automatically overwrite production table schemas
- NEVER change column types without understanding impact on existing partitions

## Phase 3 — Rollback
- If table schema was updated: restore previous schema definition
- If partition schemas were batch-updated: restore previous partition schemas
- If SchemaChangePolicy was changed: restore previous policy
- If Schema Registry version was published: cannot delete versions, but can set compatibility mode

## Escalation Conditions

escalation_conditions:
  - "Remediation requires modifying IAM policies in a production account"
  - "Remediation requires disabling a security control even temporarily"
  - "Root cause cannot be identified after 3 hypothesis pivots"
  - "Blast radius affects more than one account or region"
  - "Issue involves potential data loss or exposure"

## Prohibited Actions

prohibited_actions:
  - "NEVER suggest disabling encryption for Glue jobs"
  - "NEVER suggest overly broad Glue service role"
  - "NEVER suggest public S3 access for data catalog"
