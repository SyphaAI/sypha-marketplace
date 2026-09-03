# S3 Tables Best Practices

## Iceberg Type Mapping

For the complete list of supported Iceberg data types and their query engine mappings, search AWS docs for `"Supported data types for Iceberg tables in Athena"`. Complex types (list, map, struct) require `schemaV2` rather than `schema` in API metadata. Search AWS docs for `"IcebergSchemaV2 S3 Tables"` for the full specification. Example with a nested struct:

```json
{"iceberg":{"schemaV2":{"type":"struct","fields":[
  {"id":1,"name":"device_id","required":true,"type":"string"},
  {"id":2,"name":"location","required":false,"type":{
    "type":"struct","fields":[
      {"id":3,"name":"latitude","required":true,"type":"double"},
      {"id":4,"name":"longitude","required":true,"type":"double"}
    ]}}
]}}}
```

Key rules: the top-level must have `"type":"struct"`, all fields require an explicit `"id"`, and a nested struct uses `"type":{"type":"struct","fields":[...]}`.

**Default choices when the type is ambiguous:**

- IDs: use `long` (safer than `int` for future growth)
- Text: use `string` (Iceberg does not require a length specification)
- Timestamps: use `timestamp` unless timezone awareness is required, in which case use `timestamptz`
- Money: use `int` or `long` storing cents or the smallest unit to prevent floating-point errors. Use `decimal(p,s)` only when fractional amounts are unavoidable.

## Partition Strategy

Select partitions based on query access patterns, not data structure.

**Time-series** (events, logs, metrics):

- High/medium-volume (≥100K rows/day): `PARTITIONED BY (event_date)` with identity transform
- Low-volume (<100K rows/day): partition by month transform

**Multi-tenant**: `PARTITIONED BY (tenant_id)`, and add a date partition if per-tenant volume is high.

**No clear pattern**: Begin without partitions. Iceberg supports adding partitions later without rewriting data.

**Partition guidelines:**

- Choose columns with low cardinality (10-10,000 unique values) that appear frequently in WHERE clauses
- Cap partition levels at 2-3
- Do NOT partition by high-cardinality columns (user_id, transaction_id)
- Target partition sizes of 100MB-1GB

## Naming Conventions

All names MUST be lowercase (Glue Data Catalog requirement).

- **Table bucket**: lowercase, numbers, hyphens. 3-63 chars. Name by team or domain (e.g., `analytics-tables`, `marketing-data`)
- **Namespace**: lowercase, underscores. Name by data stage or domain (e.g., `raw_events`, `processed`, `analytics`)
- **Table**: lowercase, underscores. Name by entity (e.g., `customer_orders`, `click_events`)
- **Columns**: lowercase, snake_case. Use descriptive names and avoid abbreviations.

## Schema Design

- Choose descriptive names that are unlikely to require renaming later
- Avoid cramming JSON strings into single columns — use Iceberg struct/map/array types instead
- For schema evolution, see `athena-ddl-path.md`.

## Storage Class

The default is STANDARD. For tables that store infrequently accessed historical data, enable Intelligent Tiering at bucket creation:

```bash
aws s3tables create-table-bucket --name <NAME> --region <REGION> \
  --storage-class-configuration '{"storageClass":"INTELLIGENT_TIERING"}'
```

The bucket default can be updated with `aws s3tables put-table-bucket-storage-class` (applies to new tables only). The per-table storage class is fixed at creation via `create-table --storage-class-configuration` and cannot be changed afterward.

## Common Errors

| Error | Fix |
|-------|-----|
| "Access denied creating table bucket" | Need `s3tables:CreateTableBucket`, `s3tables:ListTableBuckets`. For full workflow see Step 6 in SKILL.md and `references/table-creation-glue-etl.md` for granular permissions. |
| "Namespace not found" | Namespaces must exist before tables. Create with `aws s3tables create-namespace`. |
| Table not visible in Athena | Run `aws glue get-catalog --catalog-id s3tablescatalog`. If missing, follow Step 5 in SKILL.md. If present, check execution context format in `athena-ddl-path.md`. |
| Write operations fail | Verify IAM role has `s3tables:PutTableData` and `s3tables:UpdateTableMetadataLocation`. |
| `AccessDeniedException` despite correct IAM policy | `s3tablescatalog` may be in Lake Formation mode. Check with `aws glue get-catalog --catalog-id s3tablescatalog` — if `CreateDatabaseDefaultPermissions` is empty, the catalog is in LF mode. Migrate with `aws glue update-catalog` using `OverwriteChildResourcePermissionsWithDefault: Accept`. WARNING: this propagates to ALL child resources and removes existing LF grants. You MUST confirm with user. Search AWS docs for `"Change access control from Lake Formation to IAM"`. |
| Shell escaping errors with `--catalog-input` JSON | Save JSON to a file and use `--catalog-input file://catalog-input.json` instead of inline JSON. |
