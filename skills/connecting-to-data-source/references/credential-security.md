# Credential Security

Preferred order for authenticating Glue connections to data sources:

1. IAM database authentication (where supported)
2. AWS Secrets Manager (`SECRET_ID`)
3. Plaintext `USERNAME`/`PASSWORD` in connection properties (not recommended)

## Contents

- [IAM Database Authentication](#iam-database-authentication)
- [AWS Secrets Manager](#aws-secrets-manager)
- [Plaintext Credentials](#plaintext-credentials)
- [Rotation](#rotation)

## IAM Database Authentication

Supported sources:

- Aurora MySQL, Aurora PostgreSQL
- RDS MySQL, RDS PostgreSQL
- Amazon Redshift (via `GetClusterCredentials` / `GetCredentials`)

Advantages:

- Eliminates long-lived database passwords
- No secrets to rotate
- Database access governed by IAM policies
- Audit trail recorded in CloudTrail

### RDS / Aurora Setup

1. Enable IAM DB auth on the cluster or instance:

   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier <ID> \
     --enable-iam-database-authentication \
     --apply-immediately
   ```

2. Create a DB user that authenticates via IAM (MySQL):

   ```sql
   CREATE USER 'etl_user'@'%' IDENTIFIED WITH AWSAuthenticationPlugin AS 'RDS';
   GRANT SELECT ON app_db.* TO 'etl_user'@'%';
   ```

   PostgreSQL:

   ```sql
   CREATE USER etl_user;
   GRANT rds_iam TO etl_user;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO etl_user;
   ```

3. Grant the Glue job role the `rds-db:connect` action:

   ```json
   {
     "Effect": "Allow",
     "Action": "rds-db:connect",
     "Resource": "arn:aws:rds-db:<region>:<account>:dbuser:<resource-id>/etl_user"
   }
   ```

4. In the Glue connection, leave `SECRET_ID`, `USERNAME`, and `PASSWORD` unset. Glue mints a fresh auth token on each connection.

### Redshift Setup

Grant the Glue role `redshift:GetClusterCredentials` (provisioned) or `redshift-serverless:GetCredentials` (serverless), scoped to the cluster/workgroup and DB user.

Set up the connection with the Redshift endpoint and a DB user. No password is required.

## AWS Secrets Manager

When IAM DB auth is unsupported (Oracle, SQL Server, Snowflake, BigQuery, self-managed databases), use Secrets Manager instead.

### Create Secret

JDBC sources:

```bash
aws secretsmanager create-secret \
  --name glue/<connection-name>/credentials \
  --secret-string '{"username":"etl_user","password":"<password>"}' \
  --region <region>
```

Snowflake (key names are Glue-specific):

```bash
aws secretsmanager create-secret \
  --name glue/snowflake-analytics/credentials \
  --secret-string '{"snowflakeUser":"ETL_USER","snowflakePassword":"<password>"}' \
  --region <region>
```

BigQuery (base64 of service account JSON, stored as the secret string directly):

```bash
base64 -i <sa>.json | tr -d '\n' | \
aws secretsmanager create-secret \
  --name glue/bigquery/<project-id>/credentials \
  --secret-string file:///dev/stdin \
  --region <region>
```

### Grant Glue Role Access

```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:glue/<connection-name>/credentials-*"
}
```

The `-*` suffix matches the random 6-character suffix that Secrets Manager appends to the secret name.

### Reference in Connection

```json
"ConnectionProperties": {
  "JDBC_CONNECTION_URL": "...",
  "SECRET_ID": "glue/<connection-name>/credentials"
}
```

Leave `USERNAME` and `PASSWORD` unset. Glue retrieves them from the secret at job runtime.

## Plaintext Credentials

Not recommended. Reserve for:

- Disposable developer sandboxes
- Sources whose Glue connector does not support Secrets Manager integration

If unavoidable, supply `USERNAME` and `PASSWORD` in `ConnectionProperties`. The password is encrypted at rest in the Data Catalog but is exposed in `get-connection` responses to any principal holding `glue:GetConnection`.

## Rotation

Secrets Manager rotation:

- Turn on automatic rotation for the secret (7, 30, 60, or 90-day intervals)
- The rotation Lambda updates the password in the source database and writes the new value to the secret
- Glue picks up the updated value on the next job run; no connection change is needed
- For Aurora/RDS, use the AWS-supplied rotation template

IAM DB auth: no rotation required — tokens are generated per connection and expire after 15 minutes.

Service account keys (BigQuery) / key-pairs (Snowflake): rotate by creating a new key at the source, updating the Secrets Manager value, and allowing the old key to expire or deleting it at the source.
