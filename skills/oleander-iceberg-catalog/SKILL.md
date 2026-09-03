---
name: oleander-iceberg-catalog
description: >-
  Guidance for reading and writing oleander Iceberg catalog tables in Spark
  jobs, covering naming conventions, write modes, and catalog hierarchy.
metadata:
  category: data
  source:
    repository: 'https://github.com/oleanderhq/skills'
    path: skills/oleander-iceberg-catalog
    license_path: LICENSE
    commit: e67bc57b5bdb98f68c29d034a0cc1bb71c973e61
---

# oleander Iceberg Catalog

Apply this skill when reading from or writing to the oleander Iceberg catalog in a Spark job.

## Catalog hierarchy

Tables are addressed as `catalog.namespace.table`:

- **catalog**: always `oleander` for the managed Lakekeeper-backed catalog
- **namespace**: a logical grouping (e.g., `default`, `san_francisco`, `my_org`)
- **table**: the table name

The `default` and `telemetry` namespaces are available immediately without additional setup. The `telemetry` namespace holds oleander-managed data available for direct querying (for example `oleander.telemetry.run_events`, `oleander.telemetry.traces`, and `oleander.telemetry.logs`).

Examples:

```bash
oleander.default.sf_311
oleander.san_francisco.district_stats
oleander.my_namespace.results
```

## Reading tables

Use `spark.table()` with the fully qualified name:

```python
df = spark.table("oleander.default.sf_311")
```

Do not build table paths as raw S3 URIs. Always reference the catalog name so Iceberg metadata and lineage are tracked correctly.

## Writing tables

**Append** (add rows to an existing or new table):

```python
df.writeTo("oleander.my_namespace.my_table").append()
```

**Overwrite** (replace table contents):

```python
df.write.mode("overwrite").saveAsTable("oleander.my_namespace.my_table")
```

Use `writeTo(...).append()` for incremental pipelines. Use `write.mode("overwrite").saveAsTable(...)` when the entire result set is replaced on each run.

## Prefer Spark writes over driver writes

Do not collect data to the driver and write from Python memory. Keep writes as Spark DataFrame operations so Iceberg manages the transaction, partitioning, and metadata.

Bad:

```python
rows = df.collect()
# write rows from Python memory
```

Good:

```python
df.write.mode("overwrite").saveAsTable("oleander.my_namespace.my_table")
```

## Parameterize table names

Accept table names as arguments or environment variables so scripts remain reusable:

```python
import os, argparse

parser = argparse.ArgumentParser()
parser.add_argument("--input-table", default="oleander.default.sf_311")
parser.add_argument("--output-catalog", default="oleander.my_namespace")
args = parser.parse_args()

df = spark.table(args.input_table)
df.write.mode("overwrite").saveAsTable(f"{args.output_catalog}.results")
```

## Namespace conventions

- Use lowercase, underscore-separated names for namespaces and tables.
- Tie the namespace to the domain or data source, not the job name.
- Avoid deep namespace nesting; a single level is typically sufficient.

## Cache reused tables, then unpersist

When a table is read and referenced in multiple downstream transforms, cache it once and unpersist when finished:

```python
df = spark.table("oleander.default.sf_311")
df.cache()
# ... multiple transforms ...
df.unpersist()
```

Do not cache tables that are accessed only once.
