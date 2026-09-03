# Data Exploration

Commands for discovering table schemas and running SQL queries in Databricks.

## Finding Tables by Keyword

**⚠️ START HERE if you are unsure which catalog/schema holds your data.**

Use `information_schema` to search for tables by keyword — do NOT manually iterate through `catalogs list` → `schemas list` → `tables list`. Manual enumeration requires 10+ unnecessary steps.

```bash
# Find tables matching a keyword
databricks experimental aitools tools query \
  "SELECT table_catalog, table_schema, table_name FROM system.information_schema.tables WHERE table_name LIKE '%keyword%'" \
  --profile <PROFILE>

# Then discover schema for the tables you found
databricks experimental aitools tools discover-schema catalog.schema.table1 catalog.schema.table2 --profile <PROFILE>
```

## Identifier Names & Quoting — Read Before Writing Any Query

**Use catalog, schema, and table names EXACTLY as provided.** Never normalize them: do not
convert a hyphen (`-`) to an underscore (`_`), and do not add or remove characters.
`hello-world` and `hello_world` are *different* catalogs — silently "correcting" the name
queries an object that does not exist, producing `NO_SUCH_CATALOG` / `TABLE_OR_VIEW_NOT_FOUND`.
(Case is not significant — Unity Catalog stores names in lowercase — but there is no
reason to modify what you were given.)

**Hyphens and other special characters are valid in Unity Catalog names.** For catalogs,
only `.`, space, and `/` are prohibited — a hyphen is permitted. A name like `hello-world`
is a valid, legal catalog name; do not assume it "must" use an underscore.

**In SQL, backtick-quote any identifier segment that contains a character outside
`[a-zA-Z0-9_]`** (hyphens, spaces, etc.), one segment at a time. Without quoting, `hello-world` is
parsed as `hello` minus `world`, which is a syntax error. Quote only the segments that require it:

```sql
-- ❌ Renamed the catalog (hyphen → underscore): catalog does not exist
SHOW TABLES IN hello_world.demo

-- ❌ Correct name, but unquoted hyphen → PARSE_SYNTAX_ERROR
SHOW TABLES IN hello-world.demo

-- ✅ Correct name, special-character part backtick-quoted
SHOW TABLES IN `hello-world`.demo

-- ✅ Fully qualified, each special-character part quoted independently
SELECT * FROM `hello-world`.demo.items LIMIT 10
```

**CLI positional arguments are not SQL — pass the literal name without backticks.** Commands
such as `discover-schema CATALOG.SCHEMA.TABLE` and `tables get CATALOG.SCHEMA.TABLE` accept the
plain name (e.g. `discover-schema hello-world.demo.items`). Backticks are only appropriate
inside the SQL string of `... tools query "<SQL>"`.

> Note: the legacy `hive_metastore` is stricter than Unity Catalog — table names there permit
> only alphanumeric ASCII characters and underscores, so hyphens are not valid even when backtick-quoted.
> This guidance applies to Unity Catalog names.

> References (Databricks):
> [Names](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-names) — allowed
> characters in catalog/schema/table names ·
> [SQL identifiers](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-identifiers) —
> backtick-quoting rules for special characters.

## Overview

The `databricks experimental aitools tools` command group offers utilities for data discovery and exploration:
- **discover-schema**: Batch-retrieve table metadata, columns, types, sample data, and statistics
- **query**: Run SQL queries against Databricks SQL warehouses

**When to use this**: Reach for these commands whenever you need to:
- Inspect table schemas and metadata
- Execute SQL queries against warehouse data
- Examine data structure and content
- Validate data or review table statistics

## Prerequisites

1. **Authenticated Databricks CLI** - refer to [CLI Authentication Guide](databricks-cli-auth.md) for OAuth2 setup and profile configuration
2. **Access to Unity Catalog tables** with the necessary read permissions
3. **SQL Warehouse** (required for the query command - auto-detected unless `DATABRICKS_WAREHOUSE_ID` is set)

## Discover Schema

Batch-retrieve table metadata including columns, types, sample data, and null counts.

### Command Syntax

```bash
databricks experimental aitools tools discover-schema TABLE... [flags]
```

Tables must be provided in **CATALOG.SCHEMA.TABLE** format.

### What It Returns

For each table, the command returns:
- Column names and data types
- Sample data (5 rows)
- Null counts per column
- Total row count

### Examples

```bash
# Discover schema for a single table
databricks experimental aitools tools discover-schema samples.nyctaxi.trips --profile my-workspace

# Discover schema for multiple tables
databricks experimental aitools tools discover-schema \
  catalog.schema.table1 \
  catalog.schema.table2 \
  --profile my-workspace

# Get JSON output
databricks experimental aitools tools discover-schema \
  samples.nyctaxi.trips \
  --output json \
  --profile my-workspace
```

### Common Use Cases

1. **Understanding table structure before querying**
   ```bash
   databricks experimental aitools tools discover-schema catalog.schema.customer_data --profile my-workspace
   ```

2. **Comparing schemas across multiple tables**
   ```bash
   databricks experimental aitools tools discover-schema \
     catalog.schema.table_v1 \
     catalog.schema.table_v2 \
     --profile my-workspace
   ```

3. **Identifying columns with null values**
   - Null counts surface data quality issues at a glance

## Query

Run SQL statements against a Databricks SQL warehouse and retrieve results.

### Command Syntax

```bash
databricks experimental aitools tools query "SQL" [flags]
```

### Warehouse Selection

The command **auto-detects** an available warehouse unless one of the following applies:
- The `DATABRICKS_WAREHOUSE_ID` environment variable is set
- A warehouse is specified through another configuration method

To confirm which warehouse will be selected:
```bash
# Get the default warehouse that would be auto-detected
databricks experimental aitools tools get-default-warehouse --profile my-workspace
```

### Output

The command returns:
- Query results in JSON format
- Row count
- Execution metadata

### Examples

```bash
# Simple SELECT query
databricks experimental aitools tools query \
  "SELECT * FROM samples.nyctaxi.trips LIMIT 5" \
  --profile my-workspace

# Aggregation query
databricks experimental aitools tools query \
  "SELECT vendor_id, COUNT(*) as trip_count FROM samples.nyctaxi.trips GROUP BY vendor_id" \
  --profile my-workspace

# With JSON output
databricks experimental aitools tools query \
  "SELECT * FROM catalog.schema.table WHERE date > '2024-01-01'" \
  --output json \
  --profile my-workspace

# Using specific warehouse
DATABRICKS_WAREHOUSE_ID=abc123 databricks experimental aitools tools query \
  "SELECT * FROM samples.nyctaxi.trips LIMIT 10" \
  --profile my-workspace
```

### Common Use Cases

1. **Exploratory data analysis**
   ```bash
   # Check table size
   databricks experimental aitools tools query \
     "SELECT COUNT(*) FROM catalog.schema.table" \
     --profile my-workspace

   # View sample data
   databricks experimental aitools tools query \
     "SELECT * FROM catalog.schema.table LIMIT 10" \
     --profile my-workspace

   # Get column statistics
   databricks experimental aitools tools query \
     "SELECT MIN(column), MAX(column), AVG(column) FROM catalog.schema.table" \
     --profile my-workspace
   ```

2. **Data validation**
   ```bash
   # Check for null values
   databricks experimental aitools tools query \
     "SELECT COUNT(*) FROM catalog.schema.table WHERE column IS NULL" \
     --profile my-workspace

   # Verify data freshness
   databricks experimental aitools tools query \
     "SELECT MAX(timestamp_column) FROM catalog.schema.table" \
     --profile my-workspace
   ```

3. **Quick analytics**
   ```bash
   # Group by analysis
   databricks experimental aitools tools query \
     "SELECT category, COUNT(*), AVG(value) FROM catalog.schema.table GROUP BY category" \
     --profile my-workspace
   ```

## Workflow: Complete Data Exploration

The following illustrates a typical workflow combining both commands:

```bash
# 1. Discover the schema first
databricks experimental aitools tools discover-schema \
  samples.nyctaxi.trips \
  --profile my-workspace

# 2. Based on discovered columns, run targeted queries
databricks experimental aitools tools query \
  "SELECT vendor_id, payment_type, COUNT(*) as trips, AVG(fare_amount) as avg_fare
   FROM samples.nyctaxi.trips
   GROUP BY vendor_id, payment_type
   ORDER BY trips DESC
   LIMIT 10" \
  --profile my-workspace

# 3. Investigate specific patterns found in the data
databricks experimental aitools tools query \
  "SELECT * FROM samples.nyctaxi.trips
   WHERE fare_amount > 100
   LIMIT 20" \
  --profile my-workspace
```

## Agent Shell Tips

Bash commands issued across separate agent tool calls may run in independent shells:

```bash
# ✅ RECOMMENDED: Use --profile flag
databricks experimental aitools tools discover-schema samples.nyctaxi.trips --profile my-workspace

# ✅ ALTERNATIVE: Chain with &&
export DATABRICKS_CONFIG_PROFILE=my-workspace && \
  databricks experimental aitools tools query "SELECT * FROM samples.nyctaxi.trips LIMIT 5"

# ❌ DOES NOT WORK: Separate export
export DATABRICKS_CONFIG_PROFILE=my-workspace
databricks experimental aitools tools query "SELECT * FROM samples.nyctaxi.trips LIMIT 5"
```

## Flags

Both commands support:

| Flag | Description | Default |
|------|-------------|---------|
| `--profile` | Profile name from ~/.databrickscfg | Default profile |
| `--output` | Output format: `text` or `json` | `text` |
| `--debug` | Enable debug logging | `false` |
| `--target` | Bundle target to use (if applicable) | - |

## Troubleshooting

### Table Not Found

**Symptom**: `Error: TABLE_OR_VIEW_NOT_FOUND` or `NO_SUCH_CATALOG_EXCEPTION`

**Solution**:
1. Confirm the table name follows the format: `CATALOG.SCHEMA.TABLE`
2. **Names are literal** — a hyphen is not an underscore; do not normalize it.
   See [Identifier Names & Quoting](#identifier-names--quoting--read-before-writing-any-query).
3. Verify that you have read permissions on the table
4. List available tables:
   ```bash
   databricks tables list <catalog> <schema> --profile my-workspace
   ```

### Warehouse Not Available

**Symptom**: `Error: No available SQL warehouse found`

**Solution**:
1. Look up the default warehouse:
   ```bash
   databricks experimental aitools tools get-default-warehouse --profile my-workspace
   ```
2. List all warehouses:
   ```bash
   databricks warehouses list --profile my-workspace
   ```
3. Target a specific warehouse:
   ```bash
   DATABRICKS_WAREHOUSE_ID=<warehouse-id> databricks experimental aitools tools query "SELECT 1" --profile my-workspace
   ```
4. Start a stopped warehouse:
   ```bash
   databricks warehouses start --id <warehouse-id> --profile my-workspace
   ```

### Permission Denied

**Symptom**: `Error: PERMISSION_DENIED`

**Solution**:
1. Review Unity Catalog grants for the table:
   ```bash
   databricks grants get --full-name catalog.schema.table --principal <user-email> --profile my-workspace
   ```
2. Request SELECT permission from your workspace administrator
3. Confirm you hold warehouse access (USAGE permission)

### SQL Syntax Error

**Symptom**: `Error: PARSE_SYNTAX_ERROR`

**Solution**:
1. Review SQL syntax — use standard SQL
2. **Backtick-quote identifiers that contain special characters** (`` `hello-world`.demo ``).
   See [Identifier Names & Quoting](#identifier-names--quoting--read-before-writing-any-query).
3. Confirm column names match the schema (run discover-schema first)
4. Ensure string literals are quoted correctly
5. Test the query incrementally (start simple, then add complexity)

## Best Practices

1. **Always discover schema first** - Run `discover-schema` before authoring complex queries to understand:
   - Available columns and their types
   - Data distributions and null patterns
   - Sample data for context

2. **Use LIMIT for exploration** - When browsing large tables, always include LIMIT to prevent long-running queries:
   ```bash
   databricks experimental aitools tools query "SELECT * FROM large_table LIMIT 100" --profile my-workspace
   ```

3. **JSON output for parsing** - Use `--output json` whenever results need to be processed programmatically:
   ```bash
   databricks experimental aitools tools query "SELECT * FROM table" --output json --profile my-workspace | jq '.results'
   ```

4. **Check table existence** - Before querying, confirm the table exists:
   ```bash
   databricks tables get --full-name catalog.schema.table --profile my-workspace
   ```

5. **Profile usage** - Always pass `--profile` when commands run in separate shells to prevent authentication issues

## Related Commands

- `/databricks-dabs` - Deploy SQL, pipeline, and app resources as code
