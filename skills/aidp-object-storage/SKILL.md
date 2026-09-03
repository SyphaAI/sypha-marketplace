---
description: >-
  Native reads and writes against OCI Object Storage from an AIDP notebook via
  the `oci://` URI scheme. Apply when the user brings up OCI Object Storage,
  "oci://", external volumes, external tables backed by Object Storage,
  CSV/Parquet/JSON/Delta files in a bucket, or wants data landed in OCI
  buckets. Authentication happens implicitly through the workspace's IAM
  identity — no keys appear in the notebook.
allowed-tools: 'Read, Write, Edit, Bash'
metadata:
  category: data
  source:
    repository: 'https://github.com/oracle-samples/oracle-aidp-samples'
    path: >-
      ai/claude-code-plugins/oracle-ai-data-platform-workbench-spark-connectors/skills/aidp-object-storage
    license_path: LICENSE.txt
    commit: 6dba86bf4d92b6874bdb929b675b29137d673a71
name: aidp-object-storage
---

# `aidp-object-storage` — OCI Object Storage native (`oci://`)

Work with Object Storage data straight from Spark, both reading and writing. The IAM identity of the AIDP cluster is applied automatically — no `OCI_CONFIG`, no API keys, no inline PEM.

## When to use
- Writing or reading CSV / Parquet / JSON / Avro / Delta files in an OCI bucket from Spark.
- Registering an **External Volume** (`/Volumes/...`) that is backed by an OCI bucket.
- Defining an **External Table** (`USING CSV/PARQUET/...`) over an `oci://` path.
- The user mentions: "oci://", "Object Storage bucket", "external volume", "external table".

## When NOT to use
- For **Iceberg** tables on OCI Object Storage → use [`aidp-iceberg`](../aidp-iceberg/SKILL.md).
- For **AWS S3** → use [`aidp-aws-s3`](../aidp-aws-s3/SKILL.md).
- For **Azure ADLS Gen2** → use [`aidp-azure-adls`](../aidp-azure-adls/SKILL.md).

## URI form
```
oci://<bucket>@<namespace>/<path>
```
Here the namespace refers to the tenancy's Object Storage namespace (OCI Console > Object Storage > Bucket Details).

## Direct read/write
```python
oci_path = "oci://my-bucket@mynamespace/folder/file"

# Write
df.write.mode("overwrite").option("header", True).format("csv").save(oci_path)

# Read
df_read = spark.read.option("header", True).format("csv").load(oci_path)
df_read.show()
```

The identical pattern works with `format("parquet")`, `format("json")`, `format("delta")`.

## External Volume (DDL)
Mount a bucket a single time, then refer to it by Volume path from then on:

```sql
CREATE EXTERNAL VOLUME IF NOT EXISTS default.default.ext_volume
LOCATION 'oci://my-bucket@mynamespace/';
```
Then:
```python
volume_path = "/Volumes/default/default/ext_volume/folder/file"
df.write.format("csv").option("header", True).save(volume_path)
spark.read.option("header", True).format("csv").load(volume_path).show()
```
Remove it with `DROP VOLUME default.default.ext_volume`.

## External Table (DDL)
Create a table whose underlying data sits in `oci://`:

```sql
CREATE TABLE IF NOT EXISTS default.default.ext_table (name STRING, age INT)
USING CSV
OPTIONS (path='oci://my-bucket@mynamespace/folder/file', delimiter=',', header='true');
```
Query it as you would any Spark table:
```python
spark.sql("SELECT * FROM default.default.ext_table").show()
```
Remove it with `DROP TABLE default.default.ext_table`.

## Gotchas
- **Auth is implicit** — the IAM identity of the AIDP cluster is what gets used. OCI keys are never typed by the user. When reads come back with 404/403, the workspace identity is missing bucket privileges; correct this in OCI IAM.
- **Namespace ≠ tenancy name.** The Object Storage namespace is its own immutable string. Look it up under `OCI Console > Profile > Tenancy: <tenancy_name>` — the `object_storage_namespace` field.
- **External volume path is `/Volumes/<catalog>/<schema>/<volume>/...`**, NOT `oci://...`. After a volume is registered, refer to files through the Volume path.
- **External table `path` option uses `oci://` directly**, not the Volume path. Either approach works; pick based on whether you prefer a re-mountable abstraction (Volume) or a plain direct reference (Table).
- **`/Workspace/...` is NOT for data.** It is a FUSE-mounted file system meant for notebooks/configs. Put data files in `oci://` or `/Volumes/...`.

## References
- Official sample: [oracle-samples/oracle-aidp-samples → `getting-started/Access_Object_Storage_Data.ipynb`](https://github.com/oracle-samples/oracle-aidp-samples/blob/main/getting-started/Access_Object_Storage_Data.ipynb)
