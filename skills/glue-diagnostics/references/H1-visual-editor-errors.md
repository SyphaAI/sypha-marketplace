---
title: "H1 — Visual Editor Errors"
description: "Diagnose Glue Studio visual editor errors and configuration issues"
status: active
severity: MEDIUM
triggers:
  - "Glue Studio error"
  - "visual editor error"
  - "visual ETL error"
  - "node configuration error"
  - "visual job failed"
owner: devops-agent
objective: "Resolve Glue Studio visual editor errors that prevent job creation or execution"
context: "Glue Studio offers a visual interface for building ETL jobs. Visual editor errors cover node configuration problems, incompatible node connections, absent required fields, unsupported data source configurations, and browser rendering failures. The visual editor produces PySpark code that may deviate from hand-written scripts. Not every PySpark operation is exposed as a visual node."
---

## Phase 1 — Triage

MUST:
- Identify the specific error in the Glue Studio console (node-level or job-level)
- Inspect node configurations for missing required fields
- Confirm data source and target configurations are valid
- Verify that node connections form a valid DAG (no cycles, all inputs connected)

SHOULD:
- Review the generated script tab for code-level errors
- Confirm IAM permissions for the Glue Studio user (glue:* and related permissions)
- Check whether the Glue version supports the selected transforms
- Verify that Data Catalog tables referenced by source nodes exist

MAY:
- Clear browser cache and retry if the visual editor is unresponsive
- Check Glue Studio service health in the AWS Health Dashboard
- Attempt to recreate the job from scratch if the visual state appears corrupted

## Phase 2 — Remediate

MUST:
- Correct the identified node configuration error
- Populate all required fields in each node
- Verify the job runs successfully after the fix

SHOULD:
- Switch to the script editor for issues that cannot be resolved through the visual editor
- Add custom code transform nodes for operations that are not supported natively
- Save the job frequently to avoid losing visual editor state

MAY:
- Export the job script and manage it under version control
- Use CloudFormation or Terraform to define and manage job configurations
- Record visual editor limitations for other team members

## Common Issues

- symptoms: "Visual editor shows 'Invalid node configuration' error"
  diagnosis: "A required field is missing in a transform node (for example, join key not specified or mapping not defined)."
  resolution: "Select the error node and complete all required configuration fields."

- symptoms: "Visual editor cannot connect two nodes"
  diagnosis: "The schema between source and target nodes is incompatible, or the node type does not accept that connection."
  resolution: "Insert an ApplyMapping or SelectFields node between the incompatible nodes to reconcile their schemas."

- symptoms: "Visual editor loads but shows blank canvas"
  diagnosis: "A browser cache problem or a corrupted job definition."
  resolution: "Clear browser cache. Try an alternate browser. If the problem persists, recreate the job."

## Output Format

```yaml
root_cause: "visual_editor_error — <specific_cause>"
evidence:
  - type: node_config
    content: "<node configuration and error message>"
  - type: job_definition
    content: "<visual job structure>"
severity: MEDIUM
mitigation:
  immediate: "Fix node configuration or use script editor"
  long_term: "Document limitations, use IaC for job management"
```


## Safety Ratings
```
safety_ratings:
  - "Check node configurations: GREEN — read-only inspection"
  - "Review generated script: GREEN — read-only code review"
  - "Fix node configuration: GREEN — visual editor change"
  - "Switch to script editor: YELLOW — disconnects from visual mode permanently"
  - "Recreate job: YELLOW — requires rebuilding the visual design"
```

## Escalation Conditions
- Job processes production data pipeline
- Visual editor errors blocking job creation
- Generated code not matching visual design
- Visual editor state corrupted requiring recreation
- Limitations requiring switch to script mode

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Job definition: ETL logic and data flow"
    - "Node configurations: data source and target details"
    - "Generated script: transformation code"
  handling: "Job definitions reveal data processing logic. Do not expose externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER edit generated script directly if you want to keep visual mode
- NEVER delete a visual job without exporting the script first

## Phase 3 — Rollback
- If node configuration was changed: undo in the visual editor
- If job was switched to script mode: CANNOT revert to visual mode — recreate as visual job
- If job was recreated: restore from previous job definition if available

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
