# Snowflake Connection Setup

AWS Glue native Snowflake connection (type `SNOWFLAKE`, not `JDBC`). This connection type is required for Glue Spark ETL jobs that read from or write to Snowflake.

## Contents

- [Connection Type](#connection-type)
- [Authentication Modes](#authentication-modes)
- [Connection JSON Template](#connection-json-template)
- [PrivateLink](#privatelink)
- [Further Reading](#further-reading)

## Connection Type

Use `ConnectionType: SNOWFLAKE`. Do NOT configure a JDBC connection with the Snowflake JDBC URL — that approach is limited to Glue crawlers and cannot be used with Glue for Spark ETL jobs. The two connection types are stored independently in the Data Catalog.

## Authentication Modes

| Mode | When to use | Secret contents |
|---|---|---|
| User + password | Quick start, non-production | `username`, `password` |
| Key-pair (RSA) | Production, long-lived workloads | `username`, `private_key` (PEM, base64) |
| OAuth 2.0 | Enterprise SSO, credential-free for end users | `client_id`, `client_secret`, `refresh_token`, token URL |

OAuth 2.0 support for Glue Snowflake connections shipped in April 2026. For current Snowflake OAuth setup instructions, refer to [Snowflake's OAuth docs](https://docs.snowflake.com/en/user-guide/oauth-intro) rather than reproducing them here.

## Connection JSON Template

Password-based:

```json
{
  "Name": "snowflake-analytics",
  "ConnectionType": "SNOWFLAKE",
  "ConnectionProperties": {
    "HOST": "<account>.<region>.snowflakecomputing.com",
    "WAREHOUSE": "<warehouse-name>",
    "ROLE": "<role-name>",
    "DATABASE": "<default-database>",
    "SECRET_ID": "<secrets-manager-arn>"
  }
}
```

The secret must include `snowflakeUser` and `snowflakePassword` keys, as required by Glue's Snowflake connection convention.

Account identifier formats differ — consult the [Snowflake account identifier docs](https://docs.snowflake.com/en/user-guide/admin-account-identifier) for the correct form for your region and cloud provider.

For private sources, add `PhysicalConnectionRequirements` following the pattern in [jdbc-setup.md](jdbc-setup.md#connection-json-template).

## PrivateLink

Snowflake accounts set up for AWS PrivateLink use a distinct hostname pattern. Glue jobs connect using the PrivateLink hostname directly. Update the Glue connection's security group to permit outbound traffic to the PrivateLink endpoint. See [Snowflake PrivateLink docs](https://docs.snowflake.com/en/user-guide/admin-security-privatelink).

## Further Reading

- [AWS Glue: Creating a Snowflake connection](https://docs.aws.amazon.com/glue/latest/ug/creating-snowflake-connection.html)
- [AWS Glue: Snowflake connections (programming)](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-connect-snowflake-home.html)
