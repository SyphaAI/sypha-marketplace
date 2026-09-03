---
title: "F3 — Data Quality"
description: "Diagnose data quality issues in Glue ETL pipelines"
status: active
severity: MEDIUM
triggers:
  - "data quality"
  - "data validation"
  - "null values"
  - "duplicate records"
  - "data integrity"
  - "quality check failed"
owner: devops-agent
objective: "Identify and resolve data quality issues in Glue ETL processing"
context: "Data quality problems in Glue encompass unexpected nulls, duplicate records, type mismatches, out-of-range values, referential integrity violations, and encoding errors. Glue Data Quality (DQDL) offers rule-based validation. Typical causes include source data changes, absent validation logic, schema drift, and ETL errors. Quality problems frequently propagate without notice until downstream consumers begin reporting failures."
---

## Phase 1 — Triage

MUST:
- Identify the specific quality issue (nulls, duplicates, type errors, range violations)
- Examine source data for the quality problem: determine whether it originates in the source or in the ETL layer
- Review the ETL script for absent validation or incorrect transformations
- Check Glue Data Quality results if rules are configured: review CloudWatch logs

SHOULD:
- Sample output data to measure the scope of the quality issue
- Compare current output against results from previous successful runs
- Look for schema changes in source data that may be degrading quality
- Confirm encoding settings for text data (UTF-8, Latin-1)

MAY:
- Profile source data distribution to establish quality baselines
- Investigate upstream pipeline changes that may be affecting data quality
- Review Glue Data Quality rule definitions for gaps

## Phase 2 — Remediate

MUST:
- Add data validation targeting the identified quality issue
- Correct the ETL logic that is causing quality degradation
- Confirm output data quality after applying the fix

SHOULD:
- Introduce Glue Data Quality rules (DQDL) for automated validation
- Apply null handling (dropnulls, fillna) on critical columns
- Add deduplication logic (dropDuplicates on key columns)
- Validate data types before writing to the target

MAY:
- Configure Glue Data Quality alerts via EventBridge for rule failures
- Route records that fail quality checks to a data quarantine location
- Build data quality dashboards for continuous monitoring

## Common Issues

- symptoms: "Unexpected null values in output columns"
  diagnosis: "Source data contains nulls that the ETL script does not handle, or a join is producing nulls for unmatched records."
  resolution: "Add null filtering or default values. Switch to an inner join if nulls in output are not acceptable. Add DQDL rule: Completeness 'column' > 0.99"

- symptoms: "Duplicate records in target table"
  diagnosis: "The source data already contains duplicates, or a job bookmark issue is causing records to be reprocessed."
  resolution: "Add dropDuplicates() on key columns. Inspect bookmark state. Implement upsert logic on the target."

- symptoms: "Data type errors in downstream queries"
  diagnosis: "ETL output contains mixed types in a column (string and int) due to inconsistency in the source data."
  resolution: "Use resolveChoice() to enforce a uniform type. Add explicit type casting. Add DQDL rule: ColumnDataType 'column' = 'int'"

## Output Format

```yaml
root_cause: "data_quality — <specific_cause>"
evidence:
  - type: quality_metrics
    content: "<null counts, duplicate counts, type distribution>"
  - type: sample_data
    content: "<sample records showing quality issue>"
severity: MEDIUM
mitigation:
  immediate: "Add validation and fix ETL logic"
  long_term: "Implement DQDL rules, monitoring, and data quarantine"
```


## Safety Ratings
```
safety_ratings:
  - "Check data quality metrics: GREEN — read-only analysis"
  - "Sample output data: GREEN — read-only inspection"
  - "Add DQDL rules: GREEN — adds validation without changing data"
  - "Add null handling: GREEN — defensive code addition"
  - "Add deduplication: YELLOW — changes output data, may affect downstream"
```

## Escalation Conditions
- Job processes production data pipeline
- Data quality issues affecting downstream analytics
- Duplicate records causing incorrect business metrics
- Null values breaking downstream transformations
- Source data quality degradation requiring upstream fixes

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Data samples: business data content"
    - "Quality metrics: data integrity indicators"
    - "DQDL rules: data validation logic"
  handling: "Data samples contain business data. Do not expose externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER silently drop records without logging them to a quarantine location
- NEVER disable data quality checks in production without approval

## Phase 3 — Rollback
- If DQDL rules were added: remove rules if they cause false rejections
- If deduplication was added: remove if it incorrectly removes valid records
- If null handling was added: remove if it masks data quality issues
- If data quarantine was implemented: disable quarantine routing if not needed

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
