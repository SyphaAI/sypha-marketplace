# BigQuery Client Libraries

Google Cloud client libraries offer a language-idiomatic way to work with
BigQuery from your programming language of choice.

## Getting Started

Before using the client libraries, make sure the Google Cloud SDK is installed
and authenticated.
[Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### Python

- **Installation:**

  ```bash
  pip install --upgrade google-cloud-bigquery
  ```

- **Usage Example:**

  ```python
  from google.cloud import bigquery
  client = bigquery.Client()
  query_job = client.query("SELECT * FROM `project.dataset.table` LIMIT 10")
  results = query_job.result()
  ```

- [Python Reference](https://docs.cloud.google.com/python/docs/reference/bigquery/latest.md.txt)

### Java

- **Maven Dependency:**

  ```xml
  <dependency>
    <groupId>com.google.cloud</groupId>
    <artifactId>google-cloud-bigquery</artifactId>
  </dependency>
  ```

- **Usage Example:**

  ```java
  BigQuery bigquery = BigQueryOptions.getDefaultInstance().getService();
  QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(
      "SELECT * FROM dataset.table").build();
  TableResult results = bigquery.query(queryConfig);
  ```

- [Java Reference](https://docs.cloud.google.com/java/docs/reference/google-cloud-bigquery/latest/overview.md.txt)

### Node.js (TypeScript)

- **Installation:**

  ```bash
  npm install @google-cloud/bigquery
  ```

- **Usage Example:**

  ```typescript
  import {BigQuery} from '@google-cloud/bigquery';
  const bigquery = new BigQuery();
  const [rows] = await bigquery.query('SELECT * FROM dataset.table');
  ```

- [Node.js Reference](https://googleapis.dev/nodejs/bigquery/latest/index.html)

### Go

- **Installation:**

  ```bash
  go get cloud.google.com/go/bigquery
  ```

- **Usage Example:**

  ```go
  ctx := context.Background()
  client, _ := bigquery.NewClient(ctx, "project-id")
  q := client.Query("SELECT * FROM dataset.table")
  it, _ := q.Read(ctx)
  ```

- [Go Reference](https://docs.cloud.google.com/go/docs/reference/cloud.google.com/go/bigquery/latest.md.txt)

## BigQuery DataFrames (BigFrames)

Python developers can use `bigframes`, which exposes a pandas-like API that
runs computations directly inside BigQuery.

```bash
pip install --upgrade bigframes
```

- [BigFrames Guide](https://dataframes.bigquery.dev/)
