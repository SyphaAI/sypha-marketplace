# Network Setup

VPC, subnet, and security group settings for Glue connections to private data sources. Skip this reference when the source is accessible over the public internet (Snowflake default endpoint, BigQuery, public RDS).

## Contents

- [When Networking Is Required](#when-networking-is-required)
- [VPC and Subnet](#vpc-and-subnet)
- [Security Group Rules](#security-group-rules)
- [S3 VPC Endpoint](#s3-vpc-endpoint)
- [NAT Gateway](#nat-gateway)
- [Cross-VPC and On-Prem](#cross-vpc-and-on-prem)

## When Networking Is Required

Networking configuration is required for:

- RDS/Aurora hosted in private subnets
- Redshift hosted in private subnets
- Self-managed databases running inside a VPC
- Snowflake accessed via PrivateLink
- BigQuery when the Glue job also needs to reach private AWS resources (in that case, the Glue subnet requires NAT egress to reach Google APIs)

Networking configuration is not required for:

- Public Snowflake endpoints
- Public BigQuery (the default)
- Public RDS instances (not advised for production workloads)

## VPC and Subnet

The Glue connection's `SubnetId` controls where Glue provisions ENIs at job runtime. Constraints:

- MUST reside in the same VPC as the source (or a peered/VPN-connected VPC)
- SHOULD be a private subnet with NAT gateway egress (Glue requires internet access to fetch dependencies and write to CloudWatch)
- MUST have a route to the source's VPC
- `AvailabilityZone` in `PhysicalConnectionRequirements` MUST correspond to the subnet's AZ

Match AZ to source for lower latency:

```bash
aws rds describe-db-instances --db-instance-identifier <ID> \
  --query 'DBInstances[0].AvailabilityZone'
```

## Security Group Rules

Two security groups are involved: one for Glue and one for the source.

**Glue security group (outbound):**

- Permit TCP to the source port (1521 Oracle, 1433 SQL Server, 5432 Postgres, 3306 MySQL, 5439 Redshift)
- Destination: the source's security group ID
- Self-referencing rule on all ports: Glue ENIs must communicate with each other within a job. This rule is required even for single-worker jobs.

**Source security group (inbound):**

- Permit TCP on the source port from Glue's security group ID (not a CIDR — ENI addresses change between runs)

Verify:

```bash
aws ec2 describe-security-groups --group-ids <glue-sg> \
  --query 'SecurityGroups[0].IpPermissionsEgress'
aws ec2 describe-security-groups --group-ids <source-sg> \
  --query 'SecurityGroups[0].IpPermissions'
```

## S3 VPC Endpoint

Glue jobs load their scripts from S3 and write results back to S3. The Glue subnet MUST have either a NAT gateway or an S3 VPC gateway endpoint; the endpoint is preferred because it avoids NAT costs and keeps traffic on the AWS backbone.

Check:

```bash
aws ec2 describe-vpc-endpoints \
  --filters Name=vpc-id,Values=<VPC_ID> Name=service-name,Values=com.amazonaws.<region>.s3
```

Create if missing:

```bash
aws ec2 create-vpc-endpoint \
  --vpc-id <VPC_ID> \
  --service-name com.amazonaws.<region>.s3 \
  --route-table-ids <RTB_ID>
```

Without one of these, Glue jobs fail at startup with `UnableToFindVpcEndpoint`.

## NAT Gateway

A NAT gateway is required when:

- Glue must reach the internet (BigQuery, public Snowflake endpoints, external APIs)
- The subnet lacks an S3 VPC endpoint

A NAT gateway is not required when:

- The source is in the same VPC AND an S3 VPC endpoint is present AND no other internet access is needed

NAT gateways accrue per-hour and per-GB charges. For purely private-VPC ETL backed by an S3 endpoint, omit the NAT gateway.

## Cross-VPC and On-Prem

**Peered VPCs:** The Glue subnet's route table MUST include a route to the source VPC's CIDR via the peering connection. Both VPCs must reside in the same region.

**Transit Gateway:** Route tables in both VPCs attached to the TGW MUST contain routes to each other's CIDR.

**On-premises via VPN/Direct Connect:** The Glue subnet's route table MUST have a route to the on-prem CIDR via a virtual private gateway (VPN) or transit gateway (Direct Connect). The source firewall must allow inbound traffic from Glue's ENI IPs (which change per job — use the subnet CIDR instead).

Validate reachability from an EC2 instance in the same subnet before creating the Glue connection:

```bash
# From EC2 in Glue's intended subnet
telnet <source-host> <source-port>
```

If the EC2 instance cannot reach the source, Glue will not be able to either. Resolve routing issues before proceeding.
