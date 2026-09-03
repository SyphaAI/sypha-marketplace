# Discovery Checklist

## Output Structure

Present findings in the following order:

1. Catalog Landscape: catalog count broken down by type (Glue, S3 Tables, Redshift-federated, Remote Iceberg), connection status for federated catalogs
2. Executive Summary: total databases, total tables, primary formats, estimated volume
3. Database Inventory: organized by catalog and database with per-database table counts
4. Unregistered Assets: S3 Tables absent from Glue (not queryable via Athena), with instructions for registration
5. Schema Analysis: data types, nullable fields, key patterns
6. Storage Analysis: formats, partitioning strategies, S3 locations
7. Recommendations: optimization opportunities, data quality concerns, missing metadata, tables that need Glue registration

## Column Classification

Assign each column to one of the following categories:

- **Identifier**: Unique keys, foreign keys, entity IDs
- **Dimension**: Categorical attributes used for grouping or filtering (status, type, region)
- **Metric**: Quantitative values used for measurement (revenue, count, duration)
- **Temporal**: Dates and timestamps (created_at, updated_at, event_date)
- **Text**: Free-form text fields (description, notes)
- **Boolean**: True/false flags
- **Structural**: JSON, arrays, and nested structures (common in Glue tables sourced from JSON)

## Quality Scoring

Score each column's completeness as follows:

- **Complete** (>99% non-null): dependable for analysis
- **Mostly complete** (95-99%): investigate the nulls before incorporating into calculations
- **Incomplete** (80-95%): determine the cause; imputation or filtering may be necessary
- **Sparse** (<80%): generally not usable without substantial cleanup

## Column Profiling (when deep-diving a table)

For numeric columns: min, max, mean, median, p5, p95, zero count, negative count
For string columns: min/max length, empty-string count, distinct values, pattern consistency
For date columns: min/max date, null dates, future dates (when unexpected), gap detection
For boolean columns: true/false/null distribution

## What to Flag

- Tables lacking partition keys on datasets exceeding 1 GB
- CSV tables that would benefit from Parquet conversion (cost and performance)
- Databases or tables without descriptions
- Tables with no recent data (stale or abandoned)
- Inconsistent naming conventions across databases
- Tables where key columns carry high null percentages
- Columns that appear to act as foreign keys (potential join targets)
- Hierarchical dimensions (country > state > city)
- Columns with unusually low cardinality (possible default values)
- S3 Tables not registered in Glue (present but not queryable via Athena)
- Federated catalogs exhibiting connection errors or stale metadata

## Format Detection

Map SerDe libraries to human-readable format names:

- `org.apache.hadoop.hive.ql.io.parquet` = Parquet
- `org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe` = CSV/TSV
- `org.openx.data.jsonserde.JsonSerDe` = JSON
- `org.apache.hadoop.hive.serde2.OpenCSVSerde` = CSV
- `org.apache.hadoop.hive.ql.io.orc` = ORC
