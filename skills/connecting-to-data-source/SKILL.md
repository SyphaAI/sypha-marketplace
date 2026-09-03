---
name: connecting-to-data-source
description: >-
  Build and troubleshoot AWS Glue connections to JDBC databases (Oracle, SQL
  Server, PostgreSQL, MySQL, RDS), Redshift, Snowflake, and BigQuery. Collects
  connection hints from the user, discovers existing connections and RDS/Redshift
  candidates, stores credentials in Secrets Manager or via IAM DB auth,
  configures VPC, and runs tests. Triggers on: connect to database, set up Glue
  connection, register data source, connect to Snowflake/BigQuery/RDS,
  connection timeout, test connection, troubleshoot connection. Do NOT use for
  moving data (use ingesting-into-data-lake), creating tables (use
  creating-data-lake-table), queries (use querying-data-lake), catalog
  exploration (use exploring-data-catalog), or SaaS (Salesforce, ServiceNow,
  SAP, MongoDB, Kafka).
metadata:
  upstream:
    version: 1
    argument-hint: '[source-type|connection-name|hostname]'
  category: data
  source:
    repository: 'https://github.com/aws/agent-toolkit-for-aws'
    path: plugins/aws-data-analytics/skills/connecting-to-data-source
    license_path: LICENSE
    commit: cbdc61a29707dc97989d5d11a2b53ad584781e78
---

# Connect to Data Source

Register an external data source with AWS Glue so that downstream skills (ingesting-into-data-lake) can pull data from it. A Glue connection holds the network configuration, driver, and credential reference for a single source. Create it once per source and reuse it across jobs.

## Philosophy

**A connection is a named pipe, not a pipeline.** This skill delivers a tested, reusable Glue connection. It does not transfer data.

## Common Tasks

You MUST run commands through AWS MCP server tools when connected — they supply validation, sandboxed execution, and audit logging. Fall back to the AWS CLI only when MCP is unavailable. You MUST explain each step before running it.

## Workflow

### 1. Verify Dependencies and Context

- You MUST check whether AWS MCP tools or the AWS CLI are available and notify the user if either is absent
- You MUST confirm the target AWS region and verify credentials using `aws sts get-caller-identity`

### 2. Classify the Source

Ask the user which source type they intend to connect, or infer it from available hints:

| User says... | Source type | Connection type | Reference |
|---|---|---|---|
| "Oracle", "SQL Server", "Postgres", "MySQL", "RDS \<engine\>" | JDBC database | `JDBC` | [jdbc-setup.md](references/jdbc-setup.md) |
| "Redshift", "my cluster", "my data warehouse on AWS" | Redshift | `JDBC` | [jdbc-setup.md](references/jdbc-setup.md) (Redshift section) |
| "Snowflake" | Snowflake | `SNOWFLAKE` | [snowflake-setup.md](references/snowflake-setup.md) |
| "BigQuery", "Google analytics warehouse" | BigQuery | `BIGQUERY` | [bigquery-setup.md](references/bigquery-setup.md) |

If the user specifies DynamoDB or a local file, stop and explain: DynamoDB is accessed directly by Glue without a connection, and local files are handled by the ingesting-into-data-lake skill's local-upload workflow.

### 3. Gather Connection Hints from the User

You MUST request any hints the user can supply — do not make assumptions.

**For all sources:**

- Desired connection name (lowercase, hyphens: `oracle-prod-sales`, `snowflake-analytics`)
- Existing Secrets Manager secret, or create one
- Is source reachable from a Glue VPC (same, peered, VPN, Direct Connect)

**JDBC:** hostname/endpoint, port, database, whether RDS/Aurora/self-managed, IAM DB auth enabled (Aurora/RDS MySQL/Postgres), SSL required.

**Snowflake:** account identifier, warehouse, role, default database, auth (password, key-pair, OAuth).

**BigQuery:** GCP project ID, location, whether service account JSON is provisioned.

### 4. Discover Existing Connections and Candidate Sources

Verify what already exists before creating anything new.

**Existing Glue connections:**

```bash
aws glue get-connections --filter ConnectionType=<TYPE> --region <REGION>
```

If a suitable connection already exists, confirm with the user and skip to Step 7.

**Candidate sources in account** (JDBC/Redshift only):

- RDS: `aws rds describe-db-instances`
- Aurora: `aws rds describe-db-clusters`
- Redshift: `aws redshift describe-clusters`

Present the candidates to the user and let them choose. See [discovery.md](references/discovery.md).

### 5. Register Credentials

You MUST promote AWS Secrets Manager over plaintext passwords. You SHOULD prefer IAM database authentication where it is supported (Aurora/RDS MySQL and PostgreSQL, Redshift). See [credential-security.md](references/credential-security.md).

- You MUST obtain user confirmation before creating a new Secrets Manager secret
- You MUST NOT write plaintext credentials into chat or logs
- For IAM DB auth, no secret is required

### 6. Create the Glue Connection

Follow the source-specific reference for connection properties:

```bash
aws glue create-connection --connection-input '<JSON>' --region <REGION>
```

Private sources need `PhysicalConnectionRequirements` (SubnetId, SecurityGroupIdList, AvailabilityZone). See [network-setup.md](references/network-setup.md).

### 7. Test the Connection

You MUST test the connection before handing off. Testing proceeds in two phases: a quick API check followed by an engine-level verification.

#### Phase A: Glue TestConnection (network and credential sanity check)

```bash
aws glue test-connection --connection-name <NAME> --region <REGION>
```

This confirms that Glue can reach the source and authenticate. It does NOT guarantee the connection works end-to-end with the query engine the user intends to use.

#### Phase B: Engine-level verification

Once TestConnection succeeds, verify the connection operates correctly with the user's intended engine by executing a minimal query through it:

- **Glue ETL (default):** Run a smoke-test Glue job that reads one row via the connection. See [troubleshooting.md](references/troubleshooting.md).
- **Athena:** If the user plans to query via Athena with a federated connector, run a `SELECT 1` through the Athena connection to confirm the Lambda-based connector can reach the source.
- **Glue Crawler:** If the user plans to crawl the source, run a test crawl on a single table.

Phase B surfaces problems that TestConnection does not catch: driver compatibility at job runtime, catalog configuration, Spark-level serialization, and engine-specific auth flows (e.g., the Snowflake SNOWFLAKE type works in ETL but not via JDBC crawlers).

If both phases succeed, inform the user that the connection name is ready for use with `ingesting-into-data-lake`. If either phase fails, proceed to Step 8.

### 8. Troubleshoot (only if test failed)

Diagnose in order: network, credentials, then driver. See [troubleshooting.md](references/troubleshooting.md).

**Constraints:**

- You MUST inspect VPC routing, security groups, and the S3 VPC endpoint before attributing failures to credentials
- You MUST confirm that the Glue role has read access to the Secrets Manager secret
- You MUST NOT rotate credentials without explicit user confirmation

## Argument Routing

- No args: Walk the user through Steps 1-7 interactively
- Source type keyword (e.g., `snowflake`, `oracle`): Jump to Step 2 with the type pre-filled
- Existing connection name: Jump to Step 7 (test), then Step 8 if it fails
- Hostname or RDS endpoint: Jump to Step 4 with the candidate pre-filled

## Gotchas

- Glue's `SNOWFLAKE` connection type is separate from a `JDBC` connection configured for Snowflake. You MUST use `SNOWFLAKE` for Spark ETL jobs; do not use JDBC.
- Connection names cannot be changed after creation. Choose them carefully.
- `PhysicalConnectionRequirements.AvailabilityZone` MUST match the subnet's AZ, or the connection will fail at job runtime rather than at creation time.
- IAM database authentication tokens expire after 15 minutes. The Glue job obtains a fresh token on every connection; do not cache them.
- An S3 VPC gateway endpoint MUST be present in the VPC used by private-source connections. Without it, Glue jobs cannot read their scripts or write results to S3.

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `Connect timed out` | VPC routing, SG rule, or NAT gateway missing | See [troubleshooting.md](references/troubleshooting.md) |
| `Access denied for user` / `ORA-01017` | Credentials wrong, Secrets Manager access missing, or IAM DB auth misconfigured | See [troubleshooting.md](references/troubleshooting.md) |
| `No suitable driver found` | Custom driver JAR not set or wrong class name | See [troubleshooting.md](references/troubleshooting.md) |
| `SSL handshake failed` | `JDBC_ENFORCE_SSL` mismatch between Glue and source | See [troubleshooting.md](references/troubleshooting.md) |
| `UnableToFindVpcEndpoint` | S3 VPC endpoint missing | Create S3 gateway endpoint in the connection's VPC |

## References

- [jdbc-setup.md](references/jdbc-setup.md) -- Oracle, SQL Server, PostgreSQL, MySQL, RDS, Redshift
- [snowflake-setup.md](references/snowflake-setup.md) -- Glue `SNOWFLAKE` type, auth modes
- [bigquery-setup.md](references/bigquery-setup.md) -- Glue `BIGQUERY` type, GCP service accounts
- [discovery.md](references/discovery.md) -- Finding existing connections and candidate sources
- [credential-security.md](references/credential-security.md) -- Secrets Manager and IAM DB auth
- [network-setup.md](references/network-setup.md) -- VPC, subnets, security groups, endpoints
- [troubleshooting.md](references/troubleshooting.md) -- Connection errors and diagnostic flow
