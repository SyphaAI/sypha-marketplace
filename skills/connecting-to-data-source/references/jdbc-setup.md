# JDBC Connection Setup

AWS Glue JDBC connection configuration for Oracle, SQL Server, PostgreSQL, MySQL, MariaDB, Amazon RDS, Amazon Aurora, and Amazon Redshift.

## Contents

- [URL Formats and Drivers](#url-formats-and-drivers)
- [Built-in Drivers](#built-in-drivers)
- [Custom Driver Upload](#custom-driver-upload)
- [Connection JSON Template](#connection-json-template)
- [Redshift](#redshift)
- [RDS and Aurora Considerations](#rds-and-aurora-considerations)

## URL Formats and Drivers

| Engine | JDBC URL template | Driver class |
|---|---|---|
| Oracle | `jdbc:oracle:thin:@//<host>:<port>/<service>` | `oracle.jdbc.OracleDriver` |
| SQL Server | `jdbc:sqlserver://<host>:<port>;databaseName=<db>` | `com.microsoft.sqlserver.jdbc.SQLServerDriver` |
| PostgreSQL | `jdbc:postgresql://<host>:<port>/<db>` | `org.postgresql.Driver` |
| MySQL / MariaDB | `jdbc:mysql://<host>:<port>/<db>` | `com.mysql.cj.jdbc.Driver` |
| Redshift | `jdbc:redshift://<cluster>.<region>.redshift.amazonaws.com:5439/<db>` | `com.amazon.redshift.jdbc.Driver` |

For Oracle, the service name form (`@//host:port/service`) is preferred. The SID form (`@host:port:SID`) still works but was deprecated starting with Oracle 12c.

## Built-in Drivers

Glue bundles drivers for Oracle, SQL Server, PostgreSQL, MySQL, and Redshift. `JDBC_DRIVER_JAR_URI` is not required for these engines.

## Custom Driver Upload

For driver versions not included with Glue, upload the JAR to S3 and reference it as follows:

```bash
aws s3 cp ojdbc8-21.jar s3://<scripts-bucket>/jdbc-drivers/
```

Add to connection properties:

```json
"JDBC_DRIVER_JAR_URI": "s3://<scripts-bucket>/jdbc-drivers/ojdbc8-21.jar",
"JDBC_DRIVER_CLASS_NAME": "oracle.jdbc.OracleDriver"
```

## Connection JSON Template

```json
{
  "Name": "<connection-name>",
  "ConnectionType": "JDBC",
  "ConnectionProperties": {
    "JDBC_CONNECTION_URL": "<url>",
    "SECRET_ID": "<secrets-manager-arn-or-name>",
    "JDBC_ENFORCE_SSL": "true"
  },
  "PhysicalConnectionRequirements": {
    "SubnetId": "subnet-xxxxx",
    "SecurityGroupIdList": ["sg-xxxxx"],
    "AvailabilityZone": "<region>-<az>"
  }
}
```

The secret must include `username` and `password` keys. When using `SECRET_ID`, omit `USERNAME` and `PASSWORD` from the connection properties.

## Redshift

Redshift supports both JDBC password authentication and IAM-based GetClusterCredentials.

**Password-based:** use the JDBC template above.

**IAM-based (preferred for human/role users):** refer to the AWS docs for `"Redshift GetClusterCredentials Glue"`. The Glue role requires `redshift:GetClusterCredentials` on the cluster; no Secrets Manager secret is needed.

For Redshift Serverless, use the workgroup endpoint with `redshift-serverless:GetCredentials`.

## RDS and Aurora Considerations

- RDS endpoint format: `<instance-id>.<hash>.<region>.rds.amazonaws.com`
- Aurora cluster endpoint (writer): `<cluster-id>.cluster-<hash>.<region>.rds.amazonaws.com`
- Aurora reader endpoint (read-only, load balanced): `<cluster-id>.cluster-ro-<hash>.<region>.rds.amazonaws.com` — preferred for ETL reads
- Aurora custom endpoints: point to a subset of instances, handy for dedicated ETL reader pools

**IAM database authentication** (Aurora MySQL, Aurora PostgreSQL, RDS MySQL, RDS PostgreSQL):

- Enable it on the DB cluster/instance: `--enable-iam-database-authentication`
- Create a DB user: `CREATE USER etl_user IDENTIFIED WITH AWSAuthenticationPlugin AS 'RDS'`
- No Secrets Manager secret is required; the Glue role invokes `rds-db:connect` at runtime to obtain a 15-minute token
- See [credential-security.md](credential-security.md) for the full IAM policy

Favor IAM auth over password auth wherever it is supported.
