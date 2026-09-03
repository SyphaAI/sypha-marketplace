# BigQuery IAM & Security

BigQuery relies on Identity and Access Management (IAM) to enforce fine-grained
access control over its resources. As a security best practice, adhere to the
**principle of least privilege**: assign only the permissions needed to carry
out a specific action. Apply the least permissive IAM role at the finest
granularity available—such as the table or view level—wherever possible.

## Predefined IAM Roles

For a full list of predefined roles and detailed usage guidance, see [BigQuery IAM roles](https://docs.cloud.google.com/bigquery/docs/access-control.md.txt).

## Service Accounts and Agents

- **Default Service Account:** BigQuery operates with a managed service account
  (`bq-PROJECT_NUMBER@bigquery-encryption.iam.gserviceaccount.com` or the broader
  BigQuery Service Agent
  `service-PROJECT_NUMBER@gcp-sa-bigquery.iam.gserviceaccount.com`) to handle
  internal operations.

- **Service Account Impersonation:** Use
  `gcloud config set auth/impersonate_service_account` to obtain secure,
  short-lived credential access.

## Data Security

- **Encryption at Rest:** All stored data is encrypted by default with
  Google-managed keys. For additional control, use Customer-Managed Encryption
  Keys (CMEK).

- **VPC Service Controls:** Establish a service perimeter to guard against
  data exfiltration.

- **Column-Level Security:** Apply policy tags to limit access to sensitive
  columns.

- **Row-Level Security:** Configure row access policies to filter data
  according to the requesting user's identity.

- **Data Masking:** Hide sensitive values in a table while allowing
  authorized users to access the surrounding data.

- **Audit Logs:** Capture user activity and system events to support data
  governance policies and detect potential security risks.

- **Authorized Views:** Permit users to query a view without being granted
  direct access to the underlying tables.

For additional details, see:
[BigQuery Security Overview](https://cloud.google.com/bigquery/docs/data-governance).
