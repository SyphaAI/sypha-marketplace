# Creating Tables via Athena DDL

An alternative to the S3 Tables API. Use this path when the user specifically wants SQL DDL or requires schema evolution via ALTER TABLE after the table is created.

## Prerequisites

- The Glue catalog (`s3tablescatalog`) MUST be registered (see Step 5 in SKILL.md)
- The Athena workgroup MUST use engine version 3 (required for Iceberg support)
- An output S3 bucket MUST exist in the same region as the table bucket for Athena query results. If Athena has not been used in this region before, the user MUST first configure a query result location in the Athena workgroup settings or via `--result-configuration` on each query.

## CREATE TABLE

The catalog reference belongs in `--query-execution-context`, NOT in the SQL statement. Use `<database>.<table>` format in SQL:

```sql
CREATE TABLE <namespace>.<table_name> (
  <column_definitions>
)
PARTITIONED BY (<partition_columns>)
TBLPROPERTIES ('table_type' = 'ICEBERG')
```

**CRITICAL: Do NOT include a LOCATION clause.** S3 Tables manages storage automatically. This behavior differs from regular Athena external tables.

**CRITICAL: Do NOT put the catalog name in the SQL.** Athena cannot parse `s3tablescatalog/<bucket>` as a catalog identifier in DDL; it must go in the execution context only.

## Execute via Athena

```bash
aws athena start-query-execution \
  --query-string "<DDL>" \
  --query-execution-context '{"Catalog": "s3tablescatalog/<BUCKET_NAME>", "Database": "<NAMESPACE>"}' \
  --work-group "<WORKGROUP>" \
  --result-configuration '{"OutputLocation": "s3://<RESULTS_BUCKET>/output/"}'
```

Check the status with `aws athena get-query-execution --query-execution-id <ID>`.

The results bucket MUST be in the same region as the table bucket.

## Querying

Apply the same execution context pattern for SELECT queries:

```bash
aws athena start-query-execution \
  --query-string "SELECT * FROM <namespace>.<table_name> LIMIT 10" \
  --query-execution-context '{"Catalog": "s3tablescatalog/<BUCKET_NAME>", "Database": "<NAMESPACE>"}' \
  --work-group "<WORKGROUP>" \
  --result-configuration '{"OutputLocation": "s3://<RESULTS_BUCKET>/output/"}'
```

## Constraints

- All table and column names MUST be lowercase
- You MUST NOT include a LOCATION clause
- You MUST NOT place the catalog name in the SQL -- use the execution context instead
- The output S3 bucket MUST be in the same region
- The querying principal requires `athena:StartQueryExecution`, `athena:GetQueryExecution`, `athena:GetQueryResults` plus S3 access to the results bucket. S3 Tables and Glue permissions are also needed — see `access-control.md`.

## Schema Evolution

ALTER TABLE uses the same `--query-execution-context` pattern:

```bash
aws athena start-query-execution \
  --query-string "ALTER TABLE <namespace>.<table_name> ADD COLUMNS (<col> <type>)" \
  --query-execution-context '{"Catalog": "s3tablescatalog/<BUCKET_NAME>", "Database": "<NAMESPACE>"}' \
  --work-group "<WORKGROUP>" \
  --result-configuration '{"OutputLocation": "s3://<RESULTS_BUCKET>/output/"}'
```

Supported operations: `ALTER TABLE ADD COLUMNS`, `ALTER TABLE DROP COLUMN`. WARNING: schema changes affect all subsequent queries. You MUST confirm with the user before executing.

**Alternative**: Schema evolution is also available through the S3 Tables Iceberg REST API or the S3 Tables Catalog for Apache Iceberg (open-source). Search AWS docs for `"S3 Tables Catalog for Apache Iceberg"` for setup instructions.

## Additional Resources

For the latest Athena DDL syntax, search AWS docs for `"Creating Iceberg tables in Athena"` and `"Supported data types for Iceberg tables in Athena"`.
