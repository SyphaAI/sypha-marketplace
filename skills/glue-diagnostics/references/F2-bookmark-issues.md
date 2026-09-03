---
title: "F2 — Bookmark Issues"
description: "Diagnose job bookmark problems causing data reprocessing or missed data"
status: active
severity: HIGH
triggers:
  - "job bookmark"
  - "reprocessing data"
  - "duplicate data"
  - "missed data"
  - "incremental processing"
  - "bookmark reset"
owner: devops-agent
objective: "Resolve job bookmark issues that cause data duplication or missed records"
context: "Job bookmarks record which data has already been processed for incremental ETL. They are compatible with S3 sources (using file modification timestamps) and JDBC sources (using primary key ranges). Bookmarks depend on job.init() and job.commit() being present in the script. If job.commit() is absent, the bookmark is never persisted. Resetting a bookmark triggers a full reprocessing run. Bookmarks are not supported for DynamoDB, Kinesis, or Kafka sources."
---

## Phase 1 — Triage

MUST:
- Check bookmark state: `aws glue get-job-bookmark --job-name <name>`
- Verify job script includes job.init() and job.commit() calls
- Check job configuration for bookmark enabled: `aws glue get-job --name <name>` (DefaultArguments --job-bookmark-option)
- Verify the source type supports bookmarks (S3 or JDBC only)

SHOULD:
- Determine whether the job failed before reaching job.commit() (bookmark is not updated on failure)
- Confirm that S3 source files have consistent modification timestamps
- Look for files added with timestamps older than the bookmark's last processed timestamp (these will be skipped)
- Review bookmark run details for the most recent successful commit

MAY:
- Determine whether multiple concurrent job runs are competing for the same bookmark
- Verify bookmark behavior following job parameter changes
- Test bookmark behavior against a controlled set of files

## Phase 2 — Remediate

MUST:
- Add job.init() at script start and job.commit() at script end if missing
- Enable bookmarks in job configuration: `--job-bookmark-option job-bookmark-enable`
- Reset bookmark if data needs to be reprocessed: `aws glue reset-job-bookmark --job-name <name>`

SHOULD:
- Place job.commit() inside a finally block so it executes even when partial failures occur
- Use the transformation_ctx parameter in from_catalog() and write_dynamic_frame() to enable bookmark tracking
- Refrain from modifying source files after their initial write, since bookmarks track by timestamp

MAY:
- Build custom bookmark logic for sources that do not natively support bookmarks
- Use job run IDs to maintain processing state in an external store
- Add idempotency checks on the target to handle records that may be processed more than once

## Common Issues

- symptoms: "Job reprocesses all data every run despite bookmarks enabled"
  diagnosis: "job.init() or job.commit() is missing from the script, or transformation_ctx is not set."
  resolution: "Add job.init() at the start and job.commit() at the end. Set the transformation_ctx parameter in read/write operations."

- symptoms: "New files in S3 are skipped by the job"
  diagnosis: "The files were added with modification timestamps that predate the bookmark's last processed timestamp."
  resolution: "Make sure new files carry current timestamps. Reset the bookmark if necessary. Avoid copying files with preserved timestamps."

- symptoms: "Bookmark not advancing after job completes"
  diagnosis: "The job fails or exits before reaching job.commit(), preventing the bookmark state from being saved."
  resolution: "Move job.commit() into a finally block. Investigate silent errors occurring before the commit call."

## Output Format

```yaml
root_cause: "bookmark_issue — <specific_cause>"
evidence:
  - type: bookmark_state
    content: "<current bookmark state and last run>"
  - type: job_script
    content: "<presence of job.init()/job.commit()>"
severity: HIGH
mitigation:
  immediate: "Fix bookmark code integration or reset bookmark"
  long_term: "Use transformation_ctx, finally blocks, and idempotent writes"
```


## Safety Ratings
```
safety_ratings:
  - "Check bookmark state: GREEN — read-only API call"
  - "Check job script for init/commit: GREEN — read-only code review"
  - "Enable bookmarks: GREEN — adds incremental processing"
  - "Reset bookmark: RED — causes full data reprocessing on next run"
  - "Add transformation_ctx: GREEN — code change for bookmark tracking"
```

## Escalation Conditions
- Job processes production data pipeline
- Bookmark reset causing full reprocessing of large datasets
- Duplicate data in target from bookmark failures
- Missing data from bookmark skipping files
- Bookmark not advancing blocking incremental processing

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Bookmark state: processing progress and timestamps"
    - "S3 file timestamps: data ingestion patterns"
    - "Job script: ETL logic including bookmark integration"
  handling: "Bookmark state reveals data processing patterns. Do not expose externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER reset bookmarks on production jobs without confirming target can handle reprocessed data
- NEVER remove job.commit() from a script that uses bookmarks

## Phase 3 — Rollback
- If bookmark was reset: CANNOT undo — job will reprocess all data on next run
- If bookmark was enabled: disable bookmarks to return to full processing mode
- If transformation_ctx was added: remove if it causes incorrect bookmark tracking
- If job.commit() was moved: restore to original position in the script

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
