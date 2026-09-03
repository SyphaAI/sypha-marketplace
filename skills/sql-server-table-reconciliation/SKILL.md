---
name: sql-server-table-reconciliation
description: >-
  Trigger when: comparing SQL Server tables across instances, data migration
  validation, ETL verification, row mismatch detection, schema drift,
  reconciliation report, production vs staging comparison. Leverages the
  mssql-python driver with Apache Arrow for efficient columnar data transfer
  and comparison.
metadata:
  category: data
  source:
    repository: 'https://github.com/github/awesome-copilot'
    path: skills/sql-server-table-reconciliation
    license_path: LICENSE
    commit: bbb9295b63adb2db01f5e30bc32e454ab5f68382
---

# SQL Server Table Reconciliation

Compare matching tables across two SQL Server instances using Python with the `mssql-python` driver and Apache Arrow. Identify missing rows, column mismatches, and schema drift, then produce a reconciliation report.

## Workflow

1. Gather connection details for source and target
2. Identify the primary key or composite key
3. Detect schema differences
4. Pull data via Arrow for efficient columnar transfer
5. Compare rows and columns
6. Produce the reconciliation report

## Collect Inputs

| Parameter | Required | Description |
|-----------|----------|-------------|
| Source server | Yes | Source SQL Server (e.g. `prod-server.database.windows.net`) |
| Source database | Yes | Source database name |
| Target server | Yes | Target SQL Server (e.g. `staging-server.database.windows.net`) |
| Target database | Yes | Target database name |
| Tables | Yes | Comma-separated `schema.table` names, or `schema.*` wildcard (e.g. `dbo.Orders,dbo.Items` or `dbo.*`) |
| Auth mode | Yes | `sql` (user/password) or `entra` (Azure AD/token) |
| Primary key | Auto-detect | Column(s) forming the row identity. Auto-detect from metadata if not provided. |
| Columns to compare | All | Subset of columns, or all non-PK columns |
| Chunk size | `100000` | Rows per batch for large tables |
| Output format | `console` | `console`, `csv`, `parquet`, or `json` |

## Bundled Script

The reconciliation logic ships as a standalone script at `scripts/reconcile.py`. Run it with the appropriate arguments derived from user inputs:

```bash
python scripts/reconcile.py \
    --source-server <source_server> \
    --source-database <source_database> \
    --target-server <target_server> \
    --target-database <target_database> \
    --tables "<table_spec>" \
    --auth <sql|entra> \
    --chunk-size <chunk_size> \
    --output <console|csv|json>
```

### Optional arguments

| Argument | Description |
|----------|-------------|
| `--primary-key` | Comma-separated PK column(s). Omit to auto-detect. |
| `--columns` | Comma-separated columns to compare. Omit to compare all non-PK columns. |

### Example invocations

Single table with SQL auth:

```bash
python scripts/reconcile.py \
    --source-server prod-server.database.windows.net \
    --source-database ProdDB \
    --target-server staging-server.database.windows.net \
    --target-database StagingDB \
    --tables "dbo.Orders" \
    --auth sql \
    --output console
```

Wildcard with Entra auth and CSV output:

```bash
python scripts/reconcile.py \
    --source-server prod-server.database.windows.net \
    --source-database ProdDB \
    --target-server staging-server.database.windows.net \
    --target-database StagingDB \
    --tables "dbo.*" \
    --auth entra \
    --output csv
```

### Prerequisites

Install required packages before running:

```bash
pip install mssql-python pyarrow pandas
```

## Comparison Rules

- **Normalize types before comparing**: cast decimals to the same precision, trim strings, normalize datetime values to UTC
- **NULL handling**: `NULL == NULL` is treated as a match (both sides absent equals no difference)
- **Ignore row order**: always compare by PK join, never by position
- **Large tables**: extract in chunks using `OFFSET/FETCH` or `ROW_NUMBER()` partitioning

## Hash-Based Optimization (for large tables)

When a table exceeds 1M rows, run a hash pre-check:

```sql
SELECT {pk_cols},
       HASHBYTES('SHA2_256', CONCAT_WS('|', col1, col2, ...)) AS row_hash
FROM {table}
```

Evaluate hashes first; retrieve full rows only where hashes differ. This approach substantially reduces data transfer.

## Report Format

```
Reconciling dbo.EMPLOYEES...
Reconciling dbo.DEPARTMENTS...
Reconciling dbo.JOBS...

--- dbo.EMPLOYEES ---
  Source: 107  Target: 107
  Missing: 0  Extra: 0  Mismatches: 0
  Result: ✓ IDENTICAL

--- dbo.DEPARTMENTS ---
  Source: 27  Target: 27
  Missing: 0  Extra: 0  Mismatches: 3
  Result: ✗ DIFFERENCES FOUND

--- dbo.JOBS ---
  Source: 19  Target: 19
  Missing: 0  Extra: 0  Mismatches: 0
  Result: ✓ IDENTICAL

=== Summary: 2 passed, 1 failed, 0 skipped / 3 tables ===
```

When a single table is provided, include complete detail (schema drift, sample rows, mismatches). For multiple tables, use the compact per-table format shown above and expand to full detail only for tables with `FAIL` status.

## Performance Considerations

| Scenario | Strategy |
|----------|----------|
| < 100K rows | Single Arrow fetch, in-memory pandas compare |
| 100K–1M rows | Chunked extraction (100K batches), streaming comparison |
| > 1M rows | Hash pre-check → only fetch mismatched rows |
| Wide tables (100+ cols) | Compare PK + hash first, drill into specific columns on mismatch |
| Network-constrained | Use Arrow columnar format (10-50x smaller than row-by-row) |

## Constraints

- Always use the `mssql-python` driver (not pyodbc or pymssql)
- Always extract data through Apache Arrow via cursor (`cursor.arrow()`)
- Connections MUST use connection string format, not keyword arguments (kwargs like `encrypt=True` raise errors)
- Never run comparisons without first identifying the PK — prompt the user if auto-detection fails
- Handle connection failures gracefully using retry logic
- **Never hardcode credentials** in generated scripts — rely on `os.environ` / `getpass` (env vars: `MSSQL_USER`, `MSSQL_PASSWORD`)
- Never write credentials to output or logs
- Use parameterized queries (`?` placeholders) for metadata lookups — never interpolate user input into SQL via f-strings
