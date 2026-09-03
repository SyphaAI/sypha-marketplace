---
title: "H2 — Job Generation Issues"
description: "Diagnose issues with Glue Studio generated code not matching visual design"
status: active
severity: MEDIUM
triggers:
  - "generated code wrong"
  - "script does not match visual"
  - "code generation error"
  - "visual to script mismatch"
  - "auto-generated script"
owner: devops-agent
objective: "Resolve discrepancies between Glue Studio visual design and generated job scripts"
context: "Glue Studio produces PySpark scripts from the visual DAG. Generated code may diverge from expectations because of transform ordering, implicit type conversions, default join types, or limitations in the visual editor. Making direct edits to the generated script moves the job into 'script mode', permanently severing its connection to the visual editor. Custom code nodes provide a way to blend visual and code-based approaches."
---

## Phase 1 — Triage

MUST:
- Compare the visual design against the generated script in the Script tab
- Identify the specific discrepancy (wrong transform order, missing operation, incorrect parameters)
- Confirm whether the job is currently in visual mode or script mode
- Verify the generated code compiles and runs without syntax errors

SHOULD:
- Examine the generated code for implicit defaults (for example, join type defaults to inner)
- Verify that custom code nodes are producing correct output
- Confirm ApplyMapping transformations align with expected column mappings
- Look for DynamicFrame vs DataFrame conversion issues in the generated code

MAY:
- Contrast the generated code with an equivalent hand-written script
- Review the Glue Studio version for known code generation defects
- Consult AWS documentation for the expected code generation behavior

## Phase 2 — Remediate

MUST:
- Correct the discrepancy either within the visual editor or by modifying the script
- When editing the script, account for the fact that the job permanently switches to script mode
- Confirm the corrected job produces the expected output

SHOULD:
- Use custom code transform nodes for operations that the visual editor generates incorrectly
- Prefer keeping the job in visual mode when possible for easier long-term maintenance
- Record any manual script modifications for the rest of the team

MAY:
- Manage the job as a pure script if the visual editor's limitations are too constraining
- Store the job script in version control
- Build reusable custom transform nodes for frequently used patterns

## Common Issues

- symptoms: "Generated join uses wrong join type"
  diagnosis: "The visual editor defaults to an inner join, and the join type configuration was either not visible or not changed."
  resolution: "Set the join type explicitly in the Join node configuration. Confirm the change in the generated script."

- symptoms: "Generated code has wrong column order in output"
  diagnosis: "The visual editor does not guarantee column ordering, and ApplyMapping may reorder columns."
  resolution: "Insert a SelectFields node after the transformation to enforce the desired column order."

- symptoms: "Editing script disconnected the visual editor"
  diagnosis: "Manual edits to the script permanently switch the job from visual mode to script mode."
  resolution: "Create a new visual job and rebuild the design. Use custom code nodes in future rather than editing the generated script directly."

## Output Format

```yaml
root_cause: "job_generation — <specific_cause>"
evidence:
  - type: visual_design
    content: "<visual DAG description>"
  - type: generated_script
    content: "<relevant generated code section>"
severity: MEDIUM
mitigation:
  immediate: "Fix in visual editor or switch to script mode"
  long_term: "Use custom code nodes, maintain scripts in version control"
```


## Safety Ratings
```
safety_ratings:
  - "Compare visual design with generated script: GREEN — read-only analysis"
  - "Fix in visual editor: GREEN — visual editor change"
  - "Add custom code transform node: GREEN — extends visual design"
  - "Edit generated script directly: YELLOW — permanently switches to script mode"
```

## Escalation Conditions
- Job processes production data pipeline
- Generated code producing incorrect output
- Visual editor limitations requiring script mode
- Code generation bugs requiring workarounds
- Join type or column ordering issues in generated code

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Generated script: ETL transformation logic"
    - "Visual DAG: data flow design"
    - "Node parameters: data source and target details"
  handling: "Generated scripts reveal data processing logic. Do not expose externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER edit generated script if visual mode needs to be preserved
- NEVER assume generated code is correct without verification

## Phase 3 — Rollback
- If visual design was changed: undo changes in the visual editor
- If custom code node was added: remove the node if it causes errors
- If script was edited directly: CANNOT revert to visual mode — recreate as visual job
- If job was switched to script mode: maintain the script version in source control

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
