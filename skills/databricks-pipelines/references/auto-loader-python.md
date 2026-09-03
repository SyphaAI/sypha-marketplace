# Auto Loader (Python)

`spark.readStream.format("cloudFiles")` enables incremental ingestion from cloud storage. It returns a streaming DataFrame; use it inside `@dp.table()` or `@dp.append_flow()`.

```python
@dp.table()
def my_table():
    return (spark.readStream.format("cloudFiles")
                 .option("cloudFiles.format", "json")     # json, csv, parquet, avro, orc, xml, text, binaryFile
                 .load("s3://bucket/path"))
```

## Rules

- **Do not set `cloudFiles.schemaLocation`** — the pipeline manages the schema location and checkpoint automatically.
- Use `spark.readStream` (streaming), not `spark.read` (batch). Auto Loader is inherently a streaming operation.
- When providing an explicit `schema=`, include the rescued-data column (default name `_rescued_data STRING`; configurable via the `rescuedDataColumn` option).
- **Consult the official Databricks docs for any option before use** — each option has subtle semantics that are not fully covered here.

## Schema handling

- `cloudFiles.inferColumnTypes` — enables type inference (defaults to all-string for JSON/CSV/XML).
- `cloudFiles.schemaHints` — declares partial typing, e.g. `"id INT, amount DECIMAL(10,2)"`.
- `cloudFiles.schemaEvolutionMode` — controls how new columns are handled (`addNewColumns`, `rescue`, `failOnNewColumns`, `none`).
- Quarantine malformed rows using the rescued-data pattern described in [streaming-patterns.md#rescue-data-quarantine](streaming-patterns.md#rescue-data-quarantine).

## Common format-agnostic options

| Option | Notes |
|---|---|
| `cloudFiles.format` | json / csv / parquet / avro / orc / xml / text / binaryFile |
| `cloudFiles.inferColumnTypes` | Enable type inference |
| `cloudFiles.schemaHints` | Partial schema declaration |
| `cloudFiles.schemaEvolutionMode` | Schema-drift handling |
| `cloudFiles.includeExistingFiles` | Backfill on first run |
| `cloudFiles.allowOverwrites` | Re-process an overwritten file |
| `cloudFiles.maxFilesPerTrigger` / `maxBytesPerTrigger` | Throttle micro-batch size |
| `cloudFiles.maxFileAge` | Skip files older than the threshold |
| `cloudFiles.backfillInterval` | Periodically re-list to catch missed files |
| `cloudFiles.cleanSource` / `.cleanSource.retentionDuration` / `.cleanSource.moveDestination` | Source-side file cleanup |
| `cloudFiles.partitionColumns` | Hive-style partition discovery |
| `cloudFiles.useStrictGlobber` | Strict glob matching |
| `cloudFiles.validateOptions` | Validate options at start |
| `cloudFiles.schemaLocation` | **DO NOT SET** — managed by the pipeline |

Generic file options (apply to all formats): `ignoreCorruptFiles`, `ignoreMissingFiles`, `modifiedAfter`, `modifiedBefore`, `pathGlobFilter` / `fileNamePattern`, `recursiveFileLookup`.

Listing strategy:

- **Directory listing** (default for small/medium volumes): `cloudFiles.useIncrementalListing`.
- **File notification** (recommended at scale): `cloudFiles.useNotifications`, `cloudFiles.useManagedFileEvents`, `cloudFiles.fetchParallelism`, `cloudFiles.pathRewrites`, `cloudFiles.resourceTag`.

## Cloud-specific auth options

All clouds support `databricks.serviceCredential` to reference a UC service credential — prefer this over embedding keys inline.

- **AWS**: `cloudFiles.region`, `cloudFiles.queueUrl`, `cloudFiles.awsAccessKey` / `awsSecretKey`, `cloudFiles.roleArn` / `roleExternalId` / `roleSessionName`, `cloudFiles.stsEndpoint`.
- **Azure**: `cloudFiles.resourceGroup`, `cloudFiles.subscriptionId`, `cloudFiles.clientId` / `clientSecret`, `cloudFiles.connectionString`, `cloudFiles.tenantId`, `cloudFiles.queueName`.
- **GCP**: `cloudFiles.projectId`, `cloudFiles.client`, `cloudFiles.clientEmail`, `cloudFiles.privateKey` / `privateKeyId`, `cloudFiles.subscription`.

## Format-specific options

See [JSON](options-json.md), [CSV](options-csv.md), [Parquet](options-parquet.md), [Avro](options-avro.md), [ORC](options-orc.md), [XML](options-xml.md), [Text](options-text.md).
