# Connection Troubleshooting

Diagnose Glue connection failures. Work through checks in this order: network → credentials → driver → SSL. The majority of failures stem from network issues.

## Contents

- [Test Decision Tree](#test-decision-tree)
- [Network](#network)
- [Credentials](#credentials)
- [Driver](#driver)
- [SSL](#ssl)
- [Smoke-Test Glue Job Template](#smoke-test-glue-job-template)

## Test Decision Tree

1. Run `aws glue test-connection --connection-name <NAME>`. If it fails, read the error message.
2. If error mentions `timeout`, `unreachable`, `UnableToFindVpcEndpoint`, or `ENI` -- go to [Network](#network).
3. If error mentions `authentication`, `Access denied`, `invalid username/password`, `ORA-01017`, `28000` -- go to [Credentials](#credentials).
4. If error mentions `No suitable driver`, `ClassNotFoundException` -- go to [Driver](#driver).
5. If error mentions `SSL handshake`, `certificate`, `TLS` -- go to [SSL](#ssl).
6. If TestConnection passes but the engine-level smoke test fails, the problem is engine-specific (driver version, catalog config, Spark serialization). Run the smoke-test Glue job to obtain a more informative error. See [Smoke-Test Glue Job Template](#smoke-test-glue-job-template).

## Network

The majority of connection failures are network-related. Investigate in the following order:

### 1. Subnet and routing

```bash
aws glue get-connection --name <NAME> \
  --query 'Connection.PhysicalConnectionRequirements'
```

Record the SubnetId. Inspect its route table:

```bash
aws ec2 describe-route-tables \
  --filters Name=association.subnet-id,Values=<SUBNET_ID>
```

Confirm a route to the source's VPC CIDR is present.

### 2. Security groups

Confirm the Glue SG permits outbound traffic to the source port AND includes a self-referencing rule:

```bash
aws ec2 describe-security-groups --group-ids <GLUE_SG>
```

Confirm the source SG permits inbound traffic from the Glue SG:

```bash
aws ec2 describe-security-groups --group-ids <SOURCE_SG>
```

### 3. S3 VPC endpoint

```bash
aws ec2 describe-vpc-endpoints \
  --filters Name=vpc-id,Values=<VPC_ID> Name=service-name,Values=com.amazonaws.<region>.s3
```

If the endpoint is absent and the subnet has no NAT gateway, create the endpoint. See [network-setup.md](network-setup.md#s3-vpc-endpoint).

### 4. Test from EC2 in the same subnet

Spin up or reuse an existing EC2 instance in the Glue subnet with the Glue SG attached:

```bash
telnet <source-host> <source-port>
nc -zv <source-host> <source-port>
```

If the EC2 instance cannot reach the source, resolve the routing/SG/NACL issues before attributing the problem to Glue.

### 5. Database firewall

Source-side ACLs that exist outside of AWS SGs:

- Oracle: `listener.ora` restricts connecting hosts
- SQL Server: Windows Firewall on the host
- PostgreSQL: `pg_hba.conf`
- MySQL: user host restrictions (`SELECT user, host FROM mysql.user`)
- Self-managed in a VPC: NACLs on the subnet

## Credentials

Work through this checklist in order:

### 1. Secrets Manager access

```bash
# Impersonate the Glue role and fetch the secret
aws sts assume-role --role-arn <GLUE_ROLE_ARN> --role-session-name test \
  | jq -r '.Credentials'
# then with those creds:
aws secretsmanager get-secret-value --secret-id <SECRET_ID>
```

If AccessDenied: the Glue role is missing `secretsmanager:GetSecretValue` on the secret ARN. See [credential-security.md](credential-security.md).

### 2. Secret contents match expected keys

- JDBC: `username`, `password`
- Snowflake: `snowflakeUser`, `snowflakePassword`
- BigQuery: bare base64 string (no JSON keys)

### 3. IAM DB auth (if enabled)

Confirm the Glue role has `rds-db:connect` on `arn:aws:rds-db:<region>:<account>:dbuser:<resource-id>/<db-user>`.

Confirm the DB user is configured with `IDENTIFIED WITH AWSAuthenticationPlugin` (MySQL) or `GRANT rds_iam TO <user>` (PostgreSQL).

### 4. Direct credential test

From EC2 in the Glue subnet:

```bash
# Oracle
sqlplus <user>/<password>@//host:1521/service
# PostgreSQL
PGPASSWORD=<password> psql -h host -U user -d db -c "SELECT 1"
# MySQL
mysql -h host -u user -p<password> -e "SELECT 1"
```

### 5. Password edge cases

- Special characters (`@`, `#`, `%`, `:`) within the password may break JDBC URL parsing. Storing the password in Secrets Manager avoids URL encoding issues entirely.
- Expired password: Oracle `SELECT account_status FROM dba_users`; for MySQL / Postgres, check the user's password expiry settings.
- Locked account: Oracle `ALTER USER <user> ACCOUNT UNLOCK`.

## Driver

For built-in drivers (Oracle, SQL Server, PostgreSQL, MySQL, Redshift), no action is required.

For custom drivers:

### 1. JAR accessible

Verify the Glue role can read the JAR:

```bash
aws s3 head-object --bucket <SCRIPTS_BUCKET> --key jdbc-drivers/<driver>.jar
```

### 2. Driver class name matches

| Engine | Correct class |
|---|---|
| Oracle | `oracle.jdbc.OracleDriver` |
| SQL Server | `com.microsoft.sqlserver.jdbc.SQLServerDriver` |
| PostgreSQL | `org.postgresql.Driver` |
| MySQL 8.x | `com.mysql.cj.jdbc.Driver` |
| MySQL 5.x | `com.mysql.jdbc.Driver` (deprecated but sometimes needed) |
| Redshift | `com.amazon.redshift.jdbc.Driver` |

### 3. Driver version compatibility

The driver's major version must be equal to or higher than the database major version. Downgrading is acceptable for minor versions but not for major versions.

## SSL

### 1. Enforcement mismatch

The source requires SSL but the connection does not enable it:

```json
"JDBC_ENFORCE_SSL": "true"
```

### 2. Self-signed certificates

The source presents a certificate that is not in the default Java truststore:

- Import the certificate into a custom truststore
- Upload the truststore to S3
- Add to Glue job args: `--extra-jars s3://...` and JVM args pointing at the truststore

For AWS RDS and Aurora, the RDS CA bundle is already included in the default truststore.

### 3. TLS version

Older databases may require TLS 1.0/1.1; Glue 5.1 or higher defaults to 1.2+. Either upgrade the database or use a connection property to negotiate a lower version (not recommended).

## Smoke-Test Glue Job Template

When `test-connection` passes but the engine-level verification fails (or when `test-connection` fails with an uninformative message), a minimal Glue job yields a clearer error.

Save to `s3://<scripts>/test-connection.py`:

```python
import sys
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'connection_name', 'source_type'])
sc = SparkContext()
glueContext = GlueContext(sc)

test_queries = {
    'oracle': '(SELECT 1 FROM DUAL) AS t',
    'sqlserver': '(SELECT 1) AS t',
    'postgresql': '(SELECT 1) AS t',
    'mysql': '(SELECT 1) AS t',
    'redshift': '(SELECT 1) AS t',
}

source_type = args['source_type']
if source_type not in test_queries:
    raise ValueError(
        f"Unsupported source_type '{source_type}'. "
        "This JDBC smoke test supports: oracle, sqlserver, postgresql, mysql, redshift. "
        "For Snowflake/BigQuery, use their native connection_type."
    )

try:
    df = glueContext.create_dynamic_frame.from_options(
        connection_type='jdbc',
        connection_options={
            'useConnectionProperties': 'true',
            'connectionName': args['connection_name'],
            'dbtable': test_queries[args['source_type']]
        }
    ).toDF()
    print(f"SUCCESS: {df.collect()}")
except Exception as e:
    print(f"FAIL: {type(e).__name__}: {e}")
    raise
```

Create the job and start a run:

```bash
aws glue create-job \
  --name test-connection-smoke \
  --role <GLUE_ROLE_ARN> \
  --command Name=glueetl,ScriptLocation=s3://<scripts>/test-connection.py,PythonVersion=3 \
  --connections Connections=<CONNECTION_NAME> \
  --glue-version 5.1 \
  --number-of-workers 2 \
  --worker-type G.1X

aws glue start-job-run \
  --job-name test-connection-smoke \
  --arguments '{"--connection_name":"<CONNECTION_NAME>","--source_type":"<TYPE>"}'
```

Examine CloudWatch logs for the specific JDBC error. In most cases, errors are more descriptive in the logs than in `get-connection-test` output.

Remove the test job once you are done.
