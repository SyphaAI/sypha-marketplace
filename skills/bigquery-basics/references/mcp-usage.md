# BigQuery MCP Usage

BigQuery is backed by a remote Model Context Protocol (MCP) server that
exposes a collection of tools for automated data management and analysis.

## MCP Tools for BigQuery

- **list_dataset_ids:** Returns the dataset IDs available in a Google Cloud project.
- **get_dataset_info:** Retrieves metadata about a specific BigQuery dataset.
- **list_table_ids:** Lists the table IDs within a BigQuery dataset.
- **get_table_info:** Retrieves metadata about a specific BigQuery table.
- **execute_sql:** Runs a SQL query against the project and returns the results.
This tool accepts only `SELECT` statements. `INSERT`, `UPDATE`, and `DELETE`
statements and stored procedures are not permitted. Submitting a query without
a `SELECT` statement will produce an error. See the GoogleSQL documentation for
guidance on building queries. Note that `execute_sql` may have side effects if
the query calls remote functions or Python UDFs. Every query run through this
tool receives a label identifying the tool as the source, which can be used to
filter queries with the label-value pair `goog-mcp-server: true`. Query costs
are billed to the project specified in the `project_id` field.

## Setup Instructions

To establish a connection to the BigQuery MCP server, see [Configure a client connection](https://docs.cloud.google.com/bigquery/docs/use-bigquery-mcp.md.txt).

## Supported Operations

Agents connected to the BigQuery MCP remote server can carry out tasks such as:

- Answering data questions by generating and executing SQL.
- Fetching dataset metadata.
- Fetching table metadata.

For further information about the BigQuery MCP server, visit:
[Use the BigQuery MCP server](https://docs.cloud.google.com/bigquery/docs/use-bigquery-mcp.md.txt).
As an alternative, you can use
[MCP Toolbox](https://mcp-toolbox.dev/integrations/bigquery/source/), an
open-source CLI that spins up a local MCP server for BigQuery connections. For
guidance on connecting BigQuery to your tooling, see
[Connect LLMs to BigQuery with MCP](https://docs.cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox.md.txt)
for details. For additional specialized capabilities and advanced analytics
workflows, use supported BigQuery data analytics integrations for your MCP client.
