# BigQuery Connection Setup

AWS Glue native BigQuery connection (type `BIGQUERY`). Authentication uses a GCP service account, with credentials stored in AWS Secrets Manager.

## Contents

- [Prerequisites](#prerequisites)
- [Service Account Setup](#service-account-setup)
- [Secrets Manager Storage](#secrets-manager-storage)
- [Connection JSON Template](#connection-json-template)
- [Further Reading](#further-reading)

## Prerequisites

- GCP project with BigQuery enabled
- A service account in that project with BigQuery access (typically `roles/bigquery.dataViewer` plus `roles/bigquery.jobUser` for query execution)
- Service account JSON key file obtained from GCP
- AWS Secrets Manager secret located in the same region as the Glue job

## Service Account Setup

Service account and key creation take place in GCP, not in AWS. For current instructions, refer to the [GCP service account docs](https://cloud.google.com/iam/docs/service-accounts-create) and [BigQuery access control](https://cloud.google.com/bigquery/docs/access-control).

Minimum GCP IAM roles for read-only ingestion:

- `roles/bigquery.dataViewer` on the target dataset
- `roles/bigquery.jobUser` on the project (required to execute queries)

For cross-project reads, assign both roles in each source project.

## Secrets Manager Storage

Base64-encode the service account JSON and store the result in Secrets Manager. The Glue BigQuery connection expects the secret value to be the raw base64 string, not a JSON wrapper.

```bash
base64 -i <service-account>.json | tr -d '\n' > sa.b64
aws secretsmanager create-secret \
  --name glue/bigquery/<project-id>/credentials \
  --secret-string file://sa.b64 \
  --region <region>
rm sa.b64
```

To rotate, generate a new key in GCP and update the secret value. Glue will use the new value on the next job run.

## Connection JSON Template

```json
{
  "Name": "bigquery-<project-id>",
  "ConnectionType": "BIGQUERY",
  "ConnectionProperties": {
    "SECRET_ID": "glue/bigquery/<project-id>/credentials"
  }
}
```

Glue's BigQuery connection communicates with Google APIs over the internet. No `PhysicalConnectionRequirements` are necessary unless the Glue job must run inside a specific VPC for other reasons (e.g., it also reads from a private RDS). In that case, ensure the subnet has NAT gateway egress so Glue can reach `bigquery.googleapis.com`.

## Further Reading

- [AWS Glue: Creating a BigQuery connection](https://docs.aws.amazon.com/glue/latest/dg/creating-bigquery-connection.html)
- [AWS Glue: Creating a BigQuery source node](https://docs.aws.amazon.com/glue/latest/dg/creating-bigquery-source-node.html)
- [GCP service account keys](https://cloud.google.com/iam/docs/keys-create-delete)
