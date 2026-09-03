# Switching Targets to the Destination Platform

## PROBLEM

After generating unit tests on the source platform, the dbt project must be redirected to the destination platform. This involves adding a new target output in `profiles.yml`, updating source definitions, and removing any platform-specific configuration keys.

## SOLUTION

### Step 1: Add a new target output in profiles.yml

Add a new output entry for the destination platform **within the existing profile** in `~/.dbt/profiles.yml`, then update `target:` to reference it. Do **not** change the `profile` key in `dbt_project.yml`.

Example — migrating from Snowflake to Databricks:

```yaml
my_project:
  target: databricks_dev  # Switch active target to the new output
  outputs:
    snowflake_dev:         # Original source target (keep for reference)
      type: snowflake
      account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"
      user: "{{ env_var('SNOWFLAKE_USER') }}"
      password: "{{ env_var('SNOWFLAKE_PASSWORD') }}"
      role: TRANSFORMER
      database: ANALYTICS
      warehouse: COMPUTE_WH
      schema: DEV
      threads: 4
    databricks_dev:        # New destination target
      type: databricks
      catalog: main
      schema: dev
      host: "{{ env_var('DATABRICKS_HOST') }}"
      http_path: "{{ env_var('DATABRICKS_HTTP_PATH') }}"
      token: "{{ env_var('DATABRICKS_TOKEN') }}"
      threads: 4
```

To revert to the source, change `target:` back to `snowflake_dev`. Alternatively, use the `--target` flag to execute against a specific target without modifying the default: `dbtf compile --target databricks_dev`.

### Step 2: Update source definitions

Source definitions in `_sources.yml` or `tpch_sources.yml` may reference platform-specific database and schema names. Update these to match the destination platform:

```yaml
# Snowflake source
sources:
  - name: tpch
    database: snowflake_sample_data
    schema: tpch_sf1
    tables:
      - name: orders
      - name: lineitem

# Databricks equivalent (using catalog)
sources:
  - name: tpch
    database: samples    # catalog name in Databricks
    schema: tpch
    tables:
      - name: orders
      - name: lineitem
```

**Notable differences by platform**:
- **Snowflake**: Uses `database.schema` hierarchy
- **Databricks**: Uses `catalog.schema` hierarchy (Unity Catalog) — the `database` key in dbt maps to the catalog
- **BigQuery**: Uses `project.dataset` hierarchy — the `database` key maps to the GCP project

### Step 3: Remove platform-specific configurations

Locate and update platform-specific config keys in `dbt_project.yml` and model files:

**Snowflake-specific configs to remove/update**:
- `+snowflake_warehouse` — Remove or replace with target equivalent
- `+query_tag` — Snowflake-specific, remove
- `+copy_grants` — Snowflake-specific, remove
- `cluster_by` — Snowflake cluster keys need conversion to destination platform equivalent

**Databricks-specific configs to remove/update**:
- `+file_format: delta` — Remove (delta is default on Databricks, not applicable elsewhere)
- `+location_root` — Databricks-specific, remove
- `tblproperties` — Databricks-specific, remove or convert

**General config considerations**:
- `+materialized` values are broadly consistent across platforms
- `+tags` are platform-agnostic and can be left unchanged
- `+persist_docs` behavior may differ — verify support on the destination platform

### Step 4: Verify connectivity

Run `dbtf debug` to confirm the destination platform connection is working:

```bash
dbtf debug
```

## CHALLENGES

### Source data doesn't exist on destination platform

If the source data (e.g., `snowflake_sample_data.tpch_sf1`) is not present on the destination platform:
- Determine whether equivalent sample data is available (e.g., Databricks has `samples.tpch` in Unity Catalog)
- If not, consider using dbt seeds to load a subset of the data
- Update source definitions to reference wherever the data resides on the target

### Accessing sample TPCH data across platforms

TPCH sample data is widely available:
- **Snowflake**: `snowflake_sample_data.tpch_sf1`
- **Databricks**: `samples.tpch` (Unity Catalog)
- **BigQuery**: Available as public dataset `bigquery-public-data.tpch_sf1`

Column names and types are generally consistent across platforms for TPCH data, but confirm this with a quick query.

### Multiple environments

When the project uses multiple targets (dev, staging, prod), only one target needs to be configured for migration testing. Use `dev` or a dedicated `migration` target. Production configuration can be completed after the migration has been validated.
