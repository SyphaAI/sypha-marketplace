---
title: "G1 — IAM Permissions"
description: "Diagnose IAM permission issues affecting Glue jobs, crawlers, and connections"
status: active
severity: HIGH
triggers:
  - "access denied"
  - "not authorized"
  - "IAM permission"
  - "role permission"
  - "insufficient permissions"
  - "AssumeRole failed"
owner: devops-agent
objective: "Identify and resolve IAM permission issues preventing Glue operations"
context: "Glue relies on IAM roles for jobs, crawlers, and dev endpoints. Those roles must have permissions covering Glue service actions, S3 data access, CloudWatch logging, KMS decryption when data is encrypted, and any target service such as RDS, Redshift, or DynamoDB. The AWSGlueServiceRole managed policy addresses basic Glue operations but does not grant access to S3 data buckets. Cross-account scenarios additionally require trust policies and resource-based policies."
---

## Phase 1 — Triage

MUST:
- Check the IAM role attached to the job/crawler: `aws glue get-job --name <name>` or `aws glue get-crawler --name <name>`
- Review role policies: `aws iam list-attached-role-policies --role-name <role>` and `aws iam list-role-policies --role-name <role>`
- Check the specific error message for the denied action
- Confirm the role trust policy permits Glue to assume it: `aws iam get-role --role-name <role>`

SHOULD:
- Inspect S3 bucket policies that might be denying access
- Check KMS key policies when the job accesses encrypted data
- Look for SCPs (Service Control Policies) that could be restricting Glue actions
- Query CloudTrail for the specific AccessDenied event

MAY:
- Use IAM Policy Simulator to validate permissions before making changes
- Examine resource-based policies on target services
- Confirm cross-account role assumption chains if applicable

## Phase 2 — Remediate

MUST:
- Add the missing IAM permissions to the role
- Confirm that the trust policy includes `glue.amazonaws.com` as a trusted principal
- Verify the fix resolves the access denied error

SHOULD:
- Use AWSGlueServiceRole managed policy as a starting baseline
- Grant specific S3 bucket permissions for data access rather than S3 full access
- Add CloudWatch Logs permissions to enable job logging
- Apply the least-privilege principle for all production roles

MAY:
- Deploy IAM Access Analyzer to surface unused permissions
- Create dedicated roles for different job categories (ETL, crawlers, dev endpoints)
- Use permission boundaries to cap the maximum allowable permissions

## Common Issues

- symptoms: "Job fails with 'Access Denied' on S3 GetObject"
  diagnosis: "The IAM role carries AWSGlueServiceRole but lacks permissions for the S3 data bucket."
  resolution: "Add s3:GetObject and s3:ListBucket for the specific data bucket to the role policy."

- symptoms: "Crawler fails with 'not authorized to perform glue:CreateTable'"
  diagnosis: "The IAM role is missing write permissions for the Glue Data Catalog."
  resolution: "Add glue:CreateTable, glue:UpdateTable, and glue:CreatePartition to the role policy."

- symptoms: "Job fails with 'AssumeRole' error for cross-account access"
  diagnosis: "The target account role's trust policy does not permit the Glue role to assume it."
  resolution: "Update the target role trust policy to allow the Glue role ARN. Add sts:AssumeRole to the Glue role."

## Output Format

```yaml
root_cause: "iam_permissions — <specific_denied_action>"
evidence:
  - type: iam_role
    content: "<role ARN and attached policies>"
  - type: error_message
    content: "<specific access denied error>"
severity: HIGH
mitigation:
  immediate: "Add missing IAM permissions"
  long_term: "Implement least-privilege roles, use IAM Access Analyzer"
```


## Safety Ratings
```
safety_ratings:
  - "Check IAM role and policies: GREEN — read-only IAM inspection"
  - "Check CloudTrail for denied events: GREEN — read-only audit log query"
  - "Add missing IAM permissions: YELLOW — changes access scope"
  - "Update trust policy: YELLOW — changes who can assume the role"
  - "Attach AWSGlueServiceRole: YELLOW — grants broad Glue permissions"
```

## Escalation Conditions
- Job processes production data pipeline
- IAM permission issues blocking multiple Glue components
- Fix requires cross-account role trust policy changes
- SCP restrictions blocking Glue operations
- Permission changes affecting other services using the same role

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "IAM role ARNs and policies: permission configuration"
    - "Trust policies: cross-service and cross-account access"
    - "CloudTrail events: API call history with parameters"
  handling: "IAM policies reveal access patterns. Do not expose role ARNs or policies externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER grant AdministratorAccess or s3:* to Glue roles
- NEVER modify IAM roles shared by multiple services without understanding the blast radius

## Phase 3 — Rollback
- If IAM permissions were added: remove the added policy statements
- If trust policy was updated: restore previous trust policy
- If managed policy was attached: detach the policy
- If cross-account role was modified: revert changes in both accounts

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
