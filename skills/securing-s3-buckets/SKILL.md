---
name: securing-s3-buckets
description: >
  Create and secure S3 buckets in accordance with AWS best practices for access control,
  encryption, monitoring, and remediation of misconfigurations. Use when the
  user wants to secure a new bucket, audit an existing bucket, fix a security
  finding, configure encryption, or enable logging and monitoring. Do NOT use
  for general S3 data operations, S3 Tables setup, or discovering existing data
  assets.
metadata:
  upstream:
    version: 1
  category: development
  source:
    repository: 'https://github.com/aws/agent-toolkit-for-aws'
    path: skills/specialized-skills/storage-skills/securing-s3-buckets
    license_path: LICENSE
    commit: cbdc61a29707dc97989d5d11a2b53ad584781e78
---

## Overview

Applies layered S3 security controls across five workflows: securing new buckets,
auditing existing configurations, remediating findings, configuring encryption, and
enabling monitoring. Adheres to AWS Well-Architected security best practices.

Run commands through the AWS MCP server when available (sandboxed execution, audit logging, observability). Fall back to the AWS CLI or shell otherwise.

## Common Tasks

### 0. Verify Dependencies

Confirm all required tools are present before proceeding.

**Constraints:**

- You MUST inform the user if required tools are missing
- You SHOULD confirm credentials with `aws sts get-caller-identity`

See [references/iam-permissions.md](references/iam-permissions.md) for IAM permissions by workflow.

### 1. Classify the Request

| User intent | Workflow |
|---|---|
| Secure a new bucket | A: Secure New Bucket |
| Audit / review existing bucket | B: Audit Existing Bucket |
| Fix a specific finding | C: Remediate Issue |
| Configure encryption | D: Configure Encryption |
| Enable logging / monitoring | E: Enable Monitoring |

**Constraints:**

- You MUST ask for all required parameters upfront
- You MUST confirm bucket name and region before any write operation
- You MAY infer region from user context if clearly stated
- You SHOULD run `aws iam simulate-principal-policy` to validate permissions before write operations
- You SHOULD display write commands and wait for confirmation before executing

### put-bucket-policy Safety Rules

These rules apply to ALL workflows that invoke `put-bucket-policy`:

- You MUST attempt to retrieve the existing policy first (`aws s3api get-bucket-policy`) — `put-bucket-policy` replaces the entire policy
- If a policy exists, you MUST back it up before making any changes: `aws s3api get-bucket-policy --bucket <name> --output text > backup-policy-$(date +%s).json`
- If `NoSuchBucketPolicy` is returned, proceed with a new policy — no backup is required
- You MUST merge new statements into the existing policy's Statement array (if one is present)
- You MUST validate merged JSON syntax before applying it (e.g. `echo '<policy>' | python3 -m json.tool`)
- You SHOULD display the full `put-bucket-policy` command and wait for confirmation

### 2. Workflow A — Secure New Bucket

See [references/workflows.md](references/workflows.md) for full CLI steps.

**Required steps (execute in order, do not skip):**

1. Create bucket with `--bucket-namespace account-regional`
2. Enable versioning
3. Enable encryption (SSE-S3 + Bucket Keys + block SSE-C)
4. Enable logging (ask user which option — conditional)
5. Enforce HTTPS-only via `DenyInsecureTransport` bucket policy
6. Enable ABAC

**Constraints:**

- You MUST pass `--bucket-namespace account-regional` on the `create-bucket` call — this is REQUIRED, not optional. Example:

  ```
  aws s3api create-bucket --bucket <name> --bucket-namespace account-regional --region <region>
  ```

- You MUST NOT modify Block Public Access — S3 enables it by default on new buckets
- You MUST NOT modify ACL ownership controls — S3 disables ACLs (`BucketOwnerEnforced`) by default
- You MUST apply a bucket policy containing a `DenyInsecureTransport` statement that denies `s3:*` when `aws:SecureTransport` is `false` — this is REQUIRED, not optional. Example:

  ```
  aws s3api put-bucket-policy --bucket <name> --policy '{"Version":"2012-10-17","Statement":[{"Sid":"DenyInsecureTransport","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":["arn:aws:s3:::<name>/*","arn:aws:s3:::<name>"],"Condition":{"Bool":{"aws:SecureTransport":"false"}}}]}'
  ```

- You MUST ask the user which logging option they prefer before step 4
- You MUST follow the [put-bucket-policy safety rules](#put-bucket-policy-safety-rules) for steps 4 and 5
- You SHOULD confirm that each step succeeded before moving to the next

### 3. Workflow B — Audit Existing Bucket

See [references/audit-checklist.md](references/audit-checklist.md) for the full checklist.

**Constraints:**

- You MUST execute all read-only audit commands before reporting any findings
- You MUST NOT issue any write or modify commands during an audit
- You MUST report each control as PASS / FAIL / NOT CONFIGURED along with its severity
- For logging: report PASS if either S3 server access logging OR CloudTrail data events are enabled; report NOT CONFIGURED only if neither is active

### 4. Workflow C — Remediate Issue

See [references/remediation.md](references/remediation.md) for fix commands by issue type.

**Constraints:**

- You MUST determine the issue type before applying any fix
- You MUST follow the [put-bucket-policy safety rules](#put-bucket-policy-safety-rules) when modifying policies
- You MUST re-run the relevant audit check after applying the fix to verify it was resolved

### 5. Workflow D — Configure Encryption

See [references/encryption.md](references/encryption.md) for encryption options and commands.

**Constraints:**

- You MUST default to SSE-S3 with S3 Bucket Keys enabled and SSE-C blocked, unless the user explicitly requests KMS
- When using SSE-KMS, you MUST use a customer managed key — NEVER the AWS managed `aws/s3` key
- You MUST reference customer-managed KMS keys by their full ARN, not by alias
- You MUST include `BucketKeyEnabled: true` and `BlockedEncryptionTypes: [SSE-C]` in all configurations
- **Note**: The S3 API accepts `aws/s3` and aliases without returning an error — these are agent-enforced constraints. Always verify with `get-bucket-encryption` after applying.

### 6. Workflow E — Enable Monitoring

See [references/workflows.md](references/workflows.md) for full CLI steps.

**Constraints:**

- You MUST verify whether a GuardDuty detector already exists before creating one
- You MUST use the trail's home region (not the bucket's region) for all CloudTrail commands
- You SHOULD enable all four core recommended AWS Config rules

## Troubleshooting

**`ObjectLockConfigurationNotFoundError`** — Object Lock is not enabled on this bucket. Treat as NOT CONFIGURED, not a failure.

**`AccessDenied` on audit commands** — Investigate the IAM policy, bucket policy, Block Public Access settings, VPC endpoint policy, and SCPs/RCPs. Use `aws iam simulate-principal-policy` to diagnose.

**`put-bucket-policy` silently removes existing statements** — See [put-bucket-policy safety rules](#put-bucket-policy-safety-rules).

**GuardDuty `BadRequestException: detector already exists`** — Run `aws guardduty list-detectors` first; call `create-detector` only if the result is empty.

**CloudTrail changes not taking effect** — Confirm you are using `--region <trail-home-region>` and not the bucket's region. Identify the trail's home region with `aws cloudtrail describe-trails --query 'trailList[*].[Name,HomeRegion]'`.

## Additional Resources

- [references/iam-permissions.md](references/iam-permissions.md) — IAM permissions by workflow
- [references/audit-checklist.md](references/audit-checklist.md) — Per-control checklist with severity and pass conditions
- [references/encryption.md](references/encryption.md) — Encryption options, KMS guidance, SSE-C blocking
- [references/remediation.md](references/remediation.md) — Fix commands for common findings
- [references/workflows.md](references/workflows.md) — Full CLI command sequences for Workflows A and E
- [AWS S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
