---
title: "B3 — Partition Issues"
description: "Troubleshoot crawler partition detection and management problems"
status: active
severity: MEDIUM
triggers:
  - "partitions not detected"
  - "too many partitions"
  - "partition not found"
  - "missing partitions"
  - "partition schema mismatch"
  - "MSCK REPAIR"
owner: devops-agent
objective: "Resolve partition detection, registration, and management issues in the Glue Data Catalog"
context: "Crawlers detect partitions based on S3 folder structure (e.g., year=2024/month=01/). New partitions are not visible until a crawler runs or they are manually registered. Too many small partitions degrade query performance. Partition key types must be consistent across all partitions. The Data Catalog has a limit of 10 million partitions per table."
---

## Phase 1 — Triage

MUST:
- Check existing partitions: `aws glue get-partitions --database-name <db> --table-name <table> --max-results 20`
- Verify S3 folder structure matches expected partition scheme
- Check crawler configuration for partition handling: `aws glue get-crawler --name <crawler-name>`
- Verify partition keys in the table definition: `aws glue get-table --database-name <db> --table-name <table>`

SHOULD:
- Tally the total partition count to check against limits
- Confirm that partition key data types are consistent throughout
- Ensure new S3 folders adhere to the expected naming convention
- Inspect crawler recrawl policy settings

MAY:
- Review Athena MSCK REPAIR TABLE output for partition discovery results
- Confirm S3 listing permissions for deeply nested paths

## Phase 2 — Remediate

MUST:
- Register missing partitions: `aws glue batch-create-partition --database-name <db> --table-name <table> --partition-input-list <partitions>`
- Correct partition key naming when S3 folders do not conform to the expected format

SHOULD:
- Prefer batch-create-partition for programmatic partition registration over crawlers for high-frequency updates
- Apply partition pruning in queries to prevent full-partition scans
- Configure S3 event-driven partition registration for near-real-time catalog updates

MAY:
- Merge small partitions to boost query performance
- Put in place partition lifecycle management to retire outdated partitions

## Common Issues

- symptoms: "New partitions not appearing in Athena queries"
  diagnosis: "The Data Catalog was not updated after new S3 folders were created."
  resolution: "Run crawler, execute MSCK REPAIR TABLE in Athena, or call batch-create-partition API."

- symptoms: "Crawler creates thousands of partitions, queries are slow"
  diagnosis: "Data is over-partitioned (e.g., partitioned by hour for low-volume datasets)."
  resolution: "Restructure partitioning scheme. Use fewer partition keys. Consolidate small partitions."

- symptoms: "Partition values have inconsistent types"
  diagnosis: "Certain partition folders use varying formats (2024 vs 2024-01-01) for the same key."
  resolution: "Standardize S3 folder naming. Manually fix partition metadata with batch-update-partition."

## Output Format

```yaml
root_cause: "partition_issue — <specific_cause>"
evidence:
  - type: partition_metadata
    content: "<partition keys and values>"
  - type: s3_structure
    content: "<S3 folder layout>"
severity: MEDIUM
mitigation:
  immediate: "Register missing partitions or fix partition metadata"
  long_term: "Standardize partitioning scheme, automate partition management"
```


## Safety Ratings
```
safety_ratings:
  - "Check partitions and S3 structure: GREEN — read-only API calls"
  - "Register missing partitions: GREEN — adds metadata, no data change"
  - "Fix partition key naming: YELLOW — changes metadata structure"
  - "Drop old partitions: YELLOW — removes metadata (data in S3 remains)"
  - "Batch update partition schemas: YELLOW — changes partition metadata for all consumers"
```

## Escalation Conditions
- Job processes production data pipeline
- Missing partitions causing incomplete query results
- Partition limit (10M) approaching
- Partition schema inconsistencies breaking queries
- Over-partitioning degrading query performance

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Partition keys and values: data organization structure"
    - "S3 folder structure: data storage layout"
    - "Table metadata: schema and partition information"
  handling: "Partition values may reveal business data patterns. Do not expose externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER drop partitions without confirming the underlying S3 data is no longer needed for queries
- NEVER change partition key types without updating all existing partitions

## Phase 3 — Rollback
- If partitions were registered: delete incorrect partitions via batch-delete-partition
- If partition schemas were updated: restore previous partition schemas
- If partitions were dropped: re-register them from S3 folder structure
- If partition key naming was changed: revert to previous naming convention

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
