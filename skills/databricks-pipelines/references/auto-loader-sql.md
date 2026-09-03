# Auto Loader (SQL)

`read_files()` provides incremental ingestion from cloud storage. Use it inside a streaming table as `FROM STREAM read_files(...)`.

```sql
-- In a streaming table definition
CREATE OR REFRESH STREAMING TABLE my_table
AS SELECT * FROM STREAM read_files('s3://bucket/path', format => 'json');

-- Or via a flow into a pre-created target
CREATE OR REFRESH STREAMING TABLE target_table;

CREATE FLOW ingest_flow
AS INSERT INTO target_table BY NAME
SELECT * FROM STREAM read_files('s3://bucket/path', format => 'json');
```

## Rules

- `FROM STREAM read_files(...)` (no extra parentheses around the function) is the canonical form for function sources. Without `STREAM`, `read_files` performs a batch read and will fail inside a streaming table.
- `inferColumnTypes` defaults to `true` for `read_files` (the opposite of `cloudFiles` in Python). Set it to `false` to force string types.
- For production tables, use `schemaHints => 'col1 TYPE, ...'`; use `schemaEvolutionMode => '...'` to govern schema-drift behavior.
- Unity Catalog pipelines must rely on external locations to load files.
- **Consult the official Databricks docs for any option before use.**

## Common format-agnostic options

| Option | Notes |
|---|---|
| `format` | json / csv / parquet / avro / orc / xml / text / binaryFile |
| `inferColumnTypes` | Boolean. Defaults to true. |
| `partitionColumns` | Hive-style partition discovery |
| `schemaHints` | Partial schema declaration |
| `schemaEvolutionMode` | Schema-drift handling |
| `schemaLocation` | Managed automatically — don't set manually |
| `includeExistingFiles` | Backfill on first run |
| `allowOverwrites` | Re-process overwritten files |
| `maxFilesPerTrigger` / `maxBytesPerTrigger` | Throttle micro-batch size |
| `useStrictGlobber` | Strict glob matching |

Generic file options: `ignoreCorruptFiles`, `ignoreMissingFiles`, `modifiedAfter`, `modifiedBefore`, `pathGlobFilter` / `fileNamePattern`, `recursiveFileLookup`.

## Format-specific options

See [JSON](options-json.md), [CSV](options-csv.md), [Parquet](options-parquet.md), [Avro](options-avro.md), [ORC](options-orc.md), [XML](options-xml.md), [Text](options-text.md).
