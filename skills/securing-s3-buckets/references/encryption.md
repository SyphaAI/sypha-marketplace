# S3 Encryption Reference

## Choosing an Encryption Option

| Option | When to use | BucketKeyEnabled | Block SSE-C |
|---|---|---|---|
| SSE-S3 (AES256) | Default — no KMS needed | true | true |
| SSE-KMS (customer managed key) | Need key policy control or cross-account sharing | true | true |
| SSE-KMS (AWS managed `aws/s3`) | **Never** — no key policy control, blocks cross-account | — | — |

## SSE-S3 (Recommended Default)

```bash
aws s3api put-bucket-encryption \
  --bucket <bucket-name> \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true,"BlockedEncryptionTypes":{"EncryptionType":["SSE-C"]}}]}'
```

## SSE-KMS with Customer Managed Key

You MUST specify the KMS key by its full ARN (`arn:aws:kms:<region>:<account>:key/<key-id>`). Do NOT use a key alias.

You MUST apply a least-privilege key policy when creating a KMS key. Do NOT rely on the AWS default key policy — it grants `kms:*` to the account root, which permits any IAM principal with matching IAM permissions to perform all KMS operations on the key.

> **Important**: The S3 API accepts both `aws/s3` and key aliases (e.g. `alias/my-key`) without returning an error — it stores whatever value is provided. These are agent-enforced constraints, not API-enforced restrictions. Always verify the stored value with `get-bucket-encryption` after applying.

### Least-Privilege KMS Key Policy Template

Save the following as `key-policy.json` before creating the key. Replace `<account-id>`, `<region>`, and `<bucket-name>` with actual values.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKeyAdministration",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::<account-id>:role/<key-admin-role>"},
      "Action": [
        "kms:Create*",
        "kms:Describe*",
        "kms:Enable*",
        "kms:List*",
        "kms:Put*",
        "kms:Update*",
        "kms:Revoke*",
        "kms:Disable*",
        "kms:Get*",
        "kms:Delete*",
        "kms:TagResource",
        "kms:UntagResource",
        "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowS3EncryptionUsage",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::<account-id>:root"},
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "s3.<region>.amazonaws.com",
          "kms:CallerAccount": "<account-id>"
        }
      }
    }
  ]
}
```

**Key policy notes:**

- `AllowKeyAdministration` — delegates key management to a specific admin role. Replace `<key-admin-role>` with the actual name of your admin role.
- `AllowS3EncryptionUsage` — limits encrypt/decrypt operations to S3 within the specified region and account using `kms:ViaService` and `kms:CallerAccount` conditions. Narrow the `Principal` to specific roles if cross-account access is unnecessary.
- Do NOT add a blanket `kms:*` statement. If additional principals need access, add narrowly scoped statements for each one.

```bash
# Step 1: Create customer managed key with least-privilege policy
aws kms create-key \
  --description "S3 bucket encryption key" \
  --policy file://key-policy.json

# Step 2: Apply to bucket (use full key ARN, not alias)
aws s3api put-bucket-encryption \
  --bucket <bucket-name> \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"arn:aws:kms:<region>:<account>:key/<key-id>"},"BucketKeyEnabled":true,"BlockedEncryptionTypes":{"EncryptionType":["SSE-C"]}}]}'
```

## Why S3 Bucket Keys (always enable)

- Cuts KMS API calls by up to 99%
- Substantially reduces KMS costs for high-throughput workloads
- Has no effect on the security posture

## Why Block SSE-C (always block)

- SSE-C keys are held outside AWS — no CloudTrail audit trail exists for them
- Losing a key results in permanent data loss
- Rotation policies cannot be enforced on client-managed keys
- SSE-C is incompatible with centralized compliance requirements

## Enforce HTTPS in Transit

> **⚠️ If the bucket already has a policy**, merge this `DenyInsecureTransport` statement into the existing `Statement` array rather than replacing the whole policy. See [put-bucket-policy safety rules](../SKILL.md#put-bucket-policy-safety-rules).

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyInsecureTransport",
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": ["arn:aws:s3:::<bucket>/*", "arn:aws:s3:::<bucket>"],
    "Condition": {"Bool": {"aws:SecureTransport": "false"}}
  }]
}
```

`Principal: "*"` and `Action: "s3:*"` are intentional wildcards — a Deny policy must cover all principals and actions to be effective. Do NOT restrict these.

Do NOT pin TLS certificates — AWS rotates them on your behalf automatically.
