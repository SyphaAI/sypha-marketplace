---
name: bigquery-basics
description: >-
  Handles datasets, tables, and jobs in BigQuery. Use when interacting with
  BigQuery, running SQL queries, managing BigQuery resources (datasets, tables,
  views), or carrying out basic data ingestion and analysis.
metadata:
  category: data
  source:
    repository: 'https://github.com/google/skills'
    path: skills/cloud/bigquery-basics
    license_path: LICENSE
    commit: 28d90a333c4d900bcc76e498363e0c835dc69a5c
---

# BigQuery Basics

BigQuery is a serverless, AI-ready data platform built for high-speed analysis
of large datasets using SQL and Python. Its disaggregated architecture keeps
compute and storage separate so each can scale independently, and it delivers
built-in machine learning, geospatial analysis, and business intelligence
capabilities out of the box.

## Setup and Basic Usage

1.  **Enable the BigQuery API:**

    ```bash
    gcloud services enable bigquery.googleapis.com --quiet
    ```

2.  **Create a Dataset:**

    ```bash
    bq mk --dataset --location=US my_dataset
    ```

3.  **Create a Table:**

    Create a file called `schema.json` containing your table schema:

    ```json
    [
      {
        "name": "name",
        "type": "STRING",
        "mode": "REQUIRED"
      },
      {
        "name": "post_abbr",
        "type": "STRING",
        "mode": "NULLABLE"
      }
    ]
    ```

    Then provision the table using the `bq` tool:

    ```bash
    bq mk --table my_dataset.mytable schema.json
    ```

4.  **Run a Query:**

    ```bash
    bq query --use_legacy_sql=false \
    'SELECT name FROM `bigquery-public-data.usa_names.usa_1910_2013` \
    WHERE state = "TX" LIMIT 10'
    ```

## Reference Directory

- [Core Concepts](references/core-concepts.md): Storage types, analytics
  workflows, and BigQuery Studio features.

- [CLI Usage](references/cli-usage.md): Key `bq` command-line tool
  operations for managing data and jobs.

- [Client Libraries](references/client-library-usage.md): Working with Google
  Cloud client libraries for Python, Java, Node.js, and Go.

- [MCP Usage](references/mcp-usage.md): Connecting to the BigQuery remote MCP
  server and related client integrations.

- [Infrastructure as Code](references/iac-usage.md): Terraform examples
  covering datasets, tables, and reservations.

- [IAM & Security](references/iam-security.md): Roles, permissions, and data
  governance best practices.

*If you require product information not covered by these references, use the
Developer Knowledge MCP server `search_documents` tool.*

## Related Skills

- [BigQuery AI & ML Skill](../bigquery-ai-ml):
  SKILL.md file covering BigQuery AI and ML capabilities (forecast, anomaly
  detection, text generation).
