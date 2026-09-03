# Create Secrets Using Best Practices

## Overview

This SOP describes a thorough approach to creating and managing secrets in AWS Secrets Manager in accordance with security best practices. It covers secret creation with KMS encryption, automatic rotation, least-privilege IAM policies, CloudTrail auditing, and lifecycle management with appropriate tagging and deletion policies.

## Parameters

- **secret_name** (required): The name of the secret to create
- **secret_description** (required): Description of what the secret contains
- **secret_type** (required): Type of secret (database, api-key, oauth, custom)
- **secret_value** (required): The secret value or JSON structure
- **aws_region** (required): The AWS region where the secret will be created
- **kms_key_id** (optional): KMS key ID for encryption (will create if not provided)
- **enable_rotation** (optional, default: true): Whether to enable automatic rotation
- **rotation_interval** (optional, default: 30): Rotation interval in days
- **lambda_function_arn** (optional): ARN of Lambda function for custom rotation
- **allowed_principals** (optional): List of IAM principals that should have access
- **tags** (optional): Key-value pairs for resource tagging
- **recovery_window** (optional, default: 30): Recovery window in days before permanent deletion

**Constraints for parameter acquisition:**

- You MUST collect all required parameters in a single prompt rather than asking for them one at a time
- You MUST support multiple input methods including:
  - Direct input: Text provided directly in the conversation
  - File path: Path to a local file containing secret configuration
  - URL: Link to configuration resources
- You MUST validate that secret_type is one of: database, api-key, oauth, custom
- You MUST confirm that all parameters have been acquired before proceeding
- You MUST NOT log or display the actual secret value in any output

## Steps

### 1. Verify Dependencies

Check that required tools are present and alert the user if any are missing.

**Constraints:**

- You MUST confirm the following tools are available in your context:
  - call_aws
- You MUST ONLY check for tool existence and MUST NOT attempt to run the tools, because executing tools during verification can cause unintended side effects
- You MUST notify the user clearly about any missing tools
- You MUST ask whether the user wants to continue despite missing tools
- You MUST respect the user's decision to proceed or abort
- You MUST explain the reason for every tool call before executing it throughout the entire SOP
- You MUST verify AWS CLI is properly configured with this command:

  ```
  aws sts get-caller-identity
  ```

### 2. Create or Verify KMS Key

Prepare a KMS key for secret encryption if one was not supplied.

**Constraints:**

- If kms_key_id is provided, You MUST confirm the key exists and is accessible
- If kms_key_id is not provided, You MUST create a new KMS key dedicated to secrets
- You MUST configure the KMS key policy to grant the calling principal `kms:GenerateDataKey`, `kms:Decrypt`, and `kms:DescribeKey` permissions, scoped with the condition key `kms:ViaService` set to `secretsmanager.{aws_region}.amazonaws.com` so the key can only be used through Secrets Manager
- If allowed_principals is provided, You MUST add those principals to the key policy with `kms:Decrypt` and `kms:DescribeKey` permissions (read-only access to decrypt secrets)
- You MUST ensure the key policy retains the root account as key administrator to prevent lockout
- You MUST enable automatic rotation for the KMS key
- You MUST tag the KMS key with appropriate metadata

### 3. Create the Secret

Create the secret in AWS Secrets Manager with the appropriate configuration.

**Constraints:**

- You MUST create the secret using the specified KMS key for encryption
- You MUST apply the provided description and tags
- You MUST structure the secret according to the secret_type:
  - For database: JSON with host, username, password, engine, port, dbname
  - For api-key: JSON with key and optional metadata
  - For oauth: JSON with client_id, client_secret, and optional fields
  - For custom: Use the provided structure as-is
- You MUST set the recovery window using the recovery_window parameter for deletion protection
- You MUST NOT display the secret value in any output or logs

### 4. Configure Automatic Rotation

Enable automatic rotation when requested.

**Constraints:**

- If enable_rotation is true, You MUST configure automatic rotation
- You MUST set the rotation interval as specified
- For database secrets, You MUST use the appropriate AWS-managed rotation function
- For custom secrets, You MUST require and use the lambda_function_arn parameter
- You MUST confirm that the rotation function (specified by lambda_function_arn) has the permissions needed to access the secret
- You MUST test the rotation configuration by triggering an initial rotation
- You MUST handle rotation setup failures gracefully and supply clear error messages

### 5. Create Least-Privilege IAM Policy

Create an IAM policy that grants only the permissions strictly necessary.

**Constraints:**

- You MUST create a read-only policy permitting only:
  - `secretsmanager:GetSecretValue` for the specific secret ARN
  - `secretsmanager:DescribeSecret` for the specific secret ARN
  - `kms:Decrypt` for the specific KMS key ARN
  - `kms:DescribeKey` for the specific KMS key ARN
- You MUST include the condition key `aws:SecureTransport` set to true to enforce HTTPS
- You MUST scope all resource ARNs to the specific secret and KMS key — do NOT use wildcards
- If enable_rotation is true, You MUST create a separate rotation policy that additionally permits:
  - `secretsmanager:PutSecretValue` for the specific secret ARN
  - `secretsmanager:UpdateSecretVersionStage` for the specific secret ARN
  - `kms:GenerateDataKey` for the specific KMS key ARN (required when writing new secret values)
- If allowed_principals is provided, You MUST attach the read-only policy to those specific principals
- If allowed_principals is not provided, You MUST still create the policy and provide instructions for manual attachment
- You MUST supply the policy ARN and JSON in case manual attachment is needed

### 6. Enable CloudTrail Auditing

Ensure CloudTrail is set up to audit Secrets Manager operations.

**Constraints:**

- You MUST confirm CloudTrail is enabled in the region
- You MUST ensure CloudTrail captures Secrets Manager API calls
- You MUST configure CloudTrail to write logs to a secure S3 bucket with encryption
- You MUST set up CloudWatch Logs integration for real-time monitoring
- You MUST create CloudWatch alarms for suspicious secret access patterns
- You MUST offer guidance on monitoring and alerting best practices

### 7. Configure Lifecycle Management

Establish appropriate lifecycle management and monitoring.

**Constraints:**

- You MUST apply suitable tags for cost allocation and resource management
- You MUST configure CloudWatch metrics for secret usage monitoring
- You MUST create CloudWatch alarms covering:
  - Failed secret retrievals
  - Rotation failures
  - Unusual access patterns
- You MUST set up backup and disaster recovery procedures
- You MUST document the secret management procedures for the team

### 8. Validate Configuration

Carry out a thorough validation of the secret setup.

**Constraints:**

- You MUST test secret retrieval using the IAM policy that was created
- You MUST confirm that encryption is functioning correctly
- You MUST validate the rotation configuration (if rotation is enabled)
- You MUST confirm that CloudTrail logging is recording secret operations
- You MUST verify that all CloudWatch alarms are configured correctly
- You MUST deliver a summary of all created resources and their ARNs
- You MUST produce documentation for ongoing secret management

## Examples

### Example Input for Database Secret

```
secret_name: "prod-database-credentials"
secret_description: "Production database credentials for main application"
secret_type: "database"
secret_value: {
  "host": "prod-db.example.com",
  "username": "app_user",
  "password": "secure_password_123",
  "engine": "mysql",
  "port": 3306,
  "dbname": "production"
}
aws_region: "us-east-1"
enable_rotation: true
rotation_interval: 30
tags: {
  "Environment": "Production",
  "Application": "MainApp",
  "Owner": "DevOps"
}
```

### Example Input for API Key Secret

```
secret_name: "third-party-api-key"
secret_description: "API key for external service integration"
secret_type: "api-key"
secret_value: {
  "api_key": "EXAMPLE-API-KEY-REPLACE-ME",
  "service_name": "ExternalAPI",
  "endpoint": "https://api.external.com"
}
aws_region: "us-west-2"
enable_rotation: false
```

## Troubleshooting

### KMS Key Access Issues
If KMS key access errors occur, confirm that:

- The IAM user/role has kms:CreateKey and kms:PutKeyPolicy permissions
- The key policy includes the required principals
- The Secrets Manager service has access to the key

### Rotation Setup Failures
If automatic rotation setup fails:

- Confirm the Lambda function exists and has the required permissions
- Verify the rotation function can reach both the secret and the target system
- Confirm network connectivity between Lambda and the target system
- Examine CloudWatch logs for the rotation function

### CloudTrail Configuration Issues
If CloudTrail setup runs into problems:

- Confirm S3 bucket permissions for CloudTrail
- Verify that CloudTrail has the necessary IAM permissions
- Confirm the S3 bucket is in the same region or is correctly configured for cross-region access

### Secret Access Denied
If secret retrieval fails:

- Confirm the IAM policy is attached to the correct principal
- Verify the KMS key policy permits the principal to decrypt
- Confirm the secret exists in the specified region
- Confirm the principal is using HTTPS (aws:SecureTransport condition)
