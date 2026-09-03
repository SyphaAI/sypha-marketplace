# S3 Tables Access Control

Always apply least-privilege permissions when configuring access to S3 Tables.

## Bucket Policy (s3tables actions)

Actions: `s3tables:GetTableBucket`, `s3tables:GetNamespace`, `s3tables:GetTable`, `s3tables:GetTableMetadataLocation`, `s3tables:GetTableData`

Resources:

- `arn:aws:s3tables:{region}:{account_id}:bucket/{bucket_name}`
- `arn:aws:s3tables:{region}:{account_id}:bucket/{bucket_name}/table/*`

Apply with `aws s3tables put-table-bucket-policy --table-bucket-arn <ARN> --resource-policy '<POLICY_JSON>'`.

## IAM Policy (glue actions)

Actions: `glue:GetCatalog`, `glue:GetDatabase`, `glue:GetTable`

Resources (all three actions on each):

- `arn:aws:glue:{region}:{account_id}:catalog` (root -- required for federated catalog resolution)
- `arn:aws:glue:{region}:{account_id}:catalog/s3tablescatalog`
- `arn:aws:glue:{region}:{account_id}:catalog/s3tablescatalog/*`
- `arn:aws:glue:{region}:{account_id}:database/s3tablescatalog/*/*`
- `arn:aws:glue:{region}:{account_id}:table/s3tablescatalog/*/*/*`

## SSE-KMS

When the table bucket uses SSE-KMS, the querying principal additionally requires `kms:Decrypt` and `kms:GenerateDataKey` on the KMS key.

## Glue ETL Service Role

See `table-creation-glue-etl.md` for the permissions required by the Glue job service role.

## Additional Resources

For the latest IAM guidance, search AWS docs for `"S3 Tables identity-based policies IAM"`, `"S3 Tables access management"`, and `"S3 Tables Glue catalog prerequisites"`.
