# Version Control for Oracle SQL and Schema Objects

## Overview

Placing an Oracle schema under version control is about more than backing up DDL — it is about establishing a single source of truth for the database structure that supports code review, rollback, environment comparison, automated deployment, and historical auditing. When done correctly, every object in the schema has a matching definition file in git, and the database can be fully reconstructed from the repository.

The challenges are Oracle-specific: DDL produced by Oracle tooling is verbose and inconsistent, objects carry interdependencies that dictate a deployment order, grants and synonyms are frequently overlooked, and PL/SQL bodies can diverge from the stored definition as a result of manual hotfixes. This guide covers accurate DDL extraction, organizing schema objects in git, scripting grants and synonyms, and integrating with SQL Developer's version control capabilities.

---

## Extracting DDL with DBMS_METADATA

`DBMS_METADATA` is Oracle's built-in package for generating DDL from the data dictionary. It is significantly more reliable than reverse-engineering through third-party tools because it reads directly from the same internal representation that Oracle itself uses.

### Basic Usage

```sql
-- Extract DDL for a single table
SELECT DBMS_METADATA.GET_DDL('TABLE', 'ORDERS', 'APP_OWNER') FROM DUAL;

-- Extract DDL for a single index
SELECT DBMS_METADATA.GET_DDL('INDEX', 'IDX_ORDERS_CUSTOMER', 'APP_OWNER') FROM DUAL;

-- Extract DDL for a package spec and body
SELECT DBMS_METADATA.GET_DDL('PACKAGE',      'PKG_ORDERS', 'APP_OWNER') FROM DUAL;
SELECT DBMS_METADATA.GET_DDL('PACKAGE_BODY', 'PKG_ORDERS', 'APP_OWNER') FROM DUAL;

-- Supported object types
-- TABLE, INDEX, VIEW, SEQUENCE, PROCEDURE, FUNCTION,
-- PACKAGE, PACKAGE_BODY, TRIGGER, TYPE, TYPE_BODY,
-- SYNONYM, DB_LINK, CONSTRAINT, REF_CONSTRAINT, GRANT
```

### Configuring Output Format

The default DDL output contains storage clauses, tablespace names, and physical attributes that introduce noise in version control. Apply transform parameters to strip these environment-specific details:

```sql
BEGIN
  -- Remove storage clauses (STORAGE (...))
  DBMS_METADATA.SET_TRANSFORM_PARAM(
    transform_handle => DBMS_METADATA.SESSION_TRANSFORM,
    name             => 'STORAGE',
    value            => FALSE
  );

  -- Remove tablespace specifications
  DBMS_METADATA.SET_TRANSFORM_PARAM(
    transform_handle => DBMS_METADATA.SESSION_TRANSFORM,
    name             => 'TABLESPACE',
    value            => FALSE
  );

  -- Remove segment attributes (PCTFREE, INITRANS, etc.)
  DBMS_METADATA.SET_TRANSFORM_PARAM(
    transform_handle => DBMS_METADATA.SESSION_TRANSFORM,
    name             => 'SEGMENT_ATTRIBUTES',
    value            => FALSE
  );

  -- Add a terminating semicolon to each statement
  DBMS_METADATA.SET_TRANSFORM_PARAM(
    transform_handle => DBMS_METADATA.SESSION_TRANSFORM,
    name             => 'SQLTERMINATOR',
    value            => TRUE
  );

  -- Retain pretty-printing
  DBMS_METADATA.SET_TRANSFORM_PARAM(
    transform_handle => DBMS_METADATA.SESSION_TRANSFORM,
    name             => 'PRETTY',
    value            => TRUE
  );
END;
/

-- Now extract clean DDL
SELECT DBMS_METADATA.GET_DDL('TABLE', 'ORDERS', 'APP_OWNER') FROM DUAL;
```

### Bulk DDL Extraction Script

```sql
-- Extract all tables, then all indexes, then all views
-- Run as the schema owner or a DBA

SET LONG     999999
SET PAGESIZE 0
SET LINESIZE 200
SET FEEDBACK OFF
SET HEADING  OFF
SET TRIMSPOOL ON

SPOOL /tmp/extract_tables.sql

BEGIN
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'STORAGE',          FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'TABLESPACE',        FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SEGMENT_ATTRIBUTES',FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR',     TRUE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'PRETTY',            TRUE);
END;
/

SELECT DBMS_METADATA.GET_DDL(OBJECT_TYPE, OBJECT_NAME, OWNER)
FROM (
  SELECT 'TABLE'    AS OBJECT_TYPE, TABLE_NAME  AS OBJECT_NAME, OWNER
  FROM   DBA_TABLES
  WHERE  OWNER = 'APP_OWNER'
    AND  TABLE_NAME NOT LIKE 'BIN$%'       -- Exclude recycle bin objects
    AND  TABLE_NAME NOT LIKE 'MLOG$_%'     -- Exclude MV logs
    AND  NESTED = 'NO'                     -- Exclude nested tables
  ORDER  BY TABLE_NAME
);

SPOOL OFF
```

### Extracting Grants and Synonyms

```sql
-- Extract all object grants made by the schema owner
SELECT DBMS_METADATA.GET_DDL('OBJECT_GRANT', OBJECT_NAME, GRANTOR)
FROM (
  SELECT DISTINCT OBJECT_NAME, GRANTOR
  FROM   DBA_TAB_PRIVS
  WHERE  GRANTOR = 'APP_OWNER'
  ORDER  BY OBJECT_NAME
);

-- Extract all public synonyms pointing to APP_OWNER objects
SELECT DBMS_METADATA.GET_DDL('SYNONYM', SYNONYM_NAME, 'PUBLIC')
FROM   DBA_SYNONYMS
WHERE  TABLE_OWNER = 'APP_OWNER'
  AND  OWNER       = 'PUBLIC';

-- Extract private synonyms in the schema
SELECT DBMS_METADATA.GET_DDL('SYNONYM', SYNONYM_NAME, OWNER)
FROM   DBA_SYNONYMS
WHERE  OWNER = 'APP_OWNER';
```

---

## Comprehensive DDL Export Script

The following shell script pulls all schema objects into organized files. It is intended to run both in CI/CD pipelines and on developer workstations.

```shell
#!/usr/bin/env bash
# extract_schema.sh — Extract all APP_OWNER objects into organized files

set -euo pipefail

DB_URL="${DB_URL:-//localhost:1521/FREEPDB1}"
DB_USER="${DB_USER:-app_owner}"
DB_PASS="${DB_PASS:-password}"
OUTPUT_DIR="${OUTPUT_DIR:-./schema}"

mkdir -p "${OUTPUT_DIR}"/{tables,indexes,views,sequences,packages,procedures,\
functions,triggers,types,synonyms,grants}

# Function to extract objects of a given type
extract_objects() {
  local obj_type="$1"
  local out_dir="$2"
  local extension="${3:-.sql}"

  sqlplus -S "${DB_USER}/${DB_PASS}@${DB_URL}" <<SQL
SET LONG     999999
SET PAGESIZE 0
SET LINESIZE 300
SET FEEDBACK OFF
SET HEADING  OFF
SET TRIMSPOOL ON
SET VERIFY   OFF

BEGIN
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'STORAGE',          FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'TABLESPACE',        FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'SEGMENT_ATTRIBUTES',FALSE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'SQLTERMINATOR',     TRUE);
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'PRETTY',            TRUE);
END;
/

-- Write each object to its own file using UTL_FILE would be cleaner,
-- but this script concatenates to a single file per type for simplicity.
SPOOL ${out_dir}/all_${obj_type,,}s${extension}

SELECT DBMS_METADATA.GET_DDL(UPPER('${obj_type}'), OBJECT_NAME, OWNER)
       || CHR(10) || '/' || CHR(10)
FROM   USER_OBJECTS
WHERE  OBJECT_TYPE  = UPPER('${obj_type}')
  AND  OBJECT_NAME NOT LIKE 'SYS\_%' ESCAPE '\'
  AND  OBJECT_NAME NOT LIKE 'BIN\$%' ESCAPE '\'
  AND  STATUS       = 'VALID'
ORDER  BY OBJECT_NAME;

SPOOL OFF
EXIT
SQL
}

echo "Extracting tables..."
extract_objects "TABLE" "${OUTPUT_DIR}/tables"

echo "Extracting indexes..."
extract_objects "INDEX" "${OUTPUT_DIR}/indexes"

echo "Extracting views..."
extract_objects "VIEW" "${OUTPUT_DIR}/views"

echo "Extracting sequences..."
extract_objects "SEQUENCE" "${OUTPUT_DIR}/sequences"

echo "Extracting packages (specs)..."
extract_objects "PACKAGE" "${OUTPUT_DIR}/packages"

echo "Extracting package bodies..."
extract_objects "PACKAGE_BODY" "${OUTPUT_DIR}/packages"

echo "Extracting procedures..."
extract_objects "PROCEDURE" "${OUTPUT_DIR}/procedures"

echo "Extracting functions..."
extract_objects "FUNCTION" "${OUTPUT_DIR}/functions"

echo "Extracting triggers..."
extract_objects "TRIGGER" "${OUTPUT_DIR}/triggers"

echo "Extracting types..."
extract_objects "TYPE" "${OUTPUT_DIR}/types"

echo "Done. Files written to ${OUTPUT_DIR}/"
```

---

## Organizing Schema Objects in Git

### Recommended Repository Structure

```
schema/
  README.md
  install.sql               -- Master install script (ordered)
  tables/
    customers.sql
    orders.sql
    order_lines.sql
    products.sql
  indexes/
    idx_orders_customer.sql
    idx_orders_status.sql
    idx_customers_email.sql
  sequences/
    seq_customer_id.sql
    seq_order_id.sql
  views/
    vw_active_customers.sql
    vw_order_summary.sql
  packages/
    pkg_orders.pks            -- Package spec (.pks convention)
    pkg_orders.pkb            -- Package body (.pkb convention)
    pkg_customers.pks
    pkg_customers.pkb
  procedures/
    prc_archive_old_orders.sql
  functions/
    fnc_calculate_tax.sql
  triggers/
    trg_orders_bi.sql
    trg_customers_audit.sql
  types/
    typ_order_line.sql
    typ_order_line_tbl.sql
  grants/
    grants_to_app_user.sql
    grants_to_report_user.sql
  synonyms/
    public_synonyms.sql
  migrations/
    V001__initial_schema.sql
    V002__add_customer_status.sql
```

### File Naming Conventions

Define and document naming conventions in the repository. Consistency makes automated tooling possible:

| Object Type | Convention | Example |
|---|---|---|
| Table | `{table_name}.sql` (lowercase) | `orders.sql` |
| Package spec | `{pkg_name}.pks` | `pkg_orders.pks` |
| Package body | `{pkg_name}.pkb` | `pkg_orders.pkb` |
| Index | `{index_name}.sql` | `idx_orders_customer.sql` |
| Trigger | `{trigger_name}.sql` | `trg_orders_bi.sql` |
| Type | `{type_name}.sql` | `typ_order_line.sql` |

### Master Install Script

The `install.sql` script builds the entire schema from scratch in the correct dependency order. It is used for provisioning new environments and setting up CI database containers.

```sql
-- schema/install.sql
-- Creates all schema objects in dependency order.
-- Run as DBA or schema owner with CREATE privileges.
-- Usage: sqlplus user/pass@//host:1521/service @install.sql

WHENEVER SQLERROR EXIT FAILURE ROLLBACK

-- Types (no dependencies)
@@types/typ_order_line.sql
@@types/typ_order_line_tbl.sql

-- Sequences (no dependencies)
@@sequences/seq_customer_id.sql
@@sequences/seq_order_id.sql
@@sequences/seq_invoice_id.sql

-- Tables (in FK dependency order)
@@tables/customers.sql
@@tables/customer_status_codes.sql
@@tables/products.sql
@@tables/product_categories.sql
@@tables/orders.sql
@@tables/order_lines.sql
@@tables/invoices.sql

-- Indexes
@@indexes/idx_orders_customer.sql
@@indexes/idx_orders_status.sql
@@indexes/idx_customers_email.sql
@@indexes/idx_order_lines_order.sql

-- Views (depend on tables)
@@views/vw_active_customers.sql
@@views/vw_order_summary.sql
@@views/vw_invoice_detail.sql

-- Package specs (can depend on types, sequences)
@@packages/pkg_customers.pks
@@packages/pkg_orders.pks
@@packages/pkg_invoicing.pks

-- Package bodies (depend on specs)
@@packages/pkg_customers.pkb
@@packages/pkg_orders.pkb
@@packages/pkg_invoicing.pkb

-- Standalone procedures and functions
@@procedures/prc_archive_old_orders.sql
@@functions/fnc_calculate_tax.sql

-- Triggers (depend on tables and sometimes packages)
@@triggers/trg_customers_bi.sql
@@triggers/trg_orders_bi.sql
@@triggers/trg_orders_audit.sql

-- Grants (depend on all objects existing)
@@grants/grants_to_app_user.sql
@@grants/grants_to_report_user.sql

-- Synonyms (depend on grants)
@@synonyms/public_synonyms.sql

PROMPT Schema installation complete.
```

---

## SQL Developer Source Control Integration

Oracle SQL Developer includes built-in integration with Git (and SVN). The integration provides:

- Browsing the repository history for any schema object
- Comparing the current database state against the repository state
- Checking out repository versions directly into the database
- Committing DDL extracts directly to git

### Connecting a Repository

1. In SQL Developer: **Team** > **Git** > **Clone**
2. Enter repository URL, credentials, and local path
3. SQL Developer maintains a local working copy

### Configuring Object Export for Version Control

**Tools** > **Preferences** > **Database** > **Object Viewer** > **DDL**:

- Uncheck "Include Schema": prevents `APP_OWNER.ORDERS` becoming `ORDERS` (schema-portable DDL is cleaner)
- Check "Include Terminator": ensures each file ends with `;` or `/`
- Check "Pretty Print"

### SQL Developer Migration Repository

For team environments, SQL Developer's migration repository captures a point-in-time database state and can diff it against a target. Configure this under **Tools** > **Migration** > **Create Repository**.

### Using the DB Differ

SQL Developer's **Database Diff** tool (under **Tools** > **Diff**) compares two schemas and produces a synchronization script. Common uses include:

- Comparing the DEV schema against PROD to detect unauthorized manual changes
- Producing the change script for a release
- Confirming that a migration was applied as expected

```shell
# Command-line equivalent using SQLcl (Oracle's modern SQL*Plus)
sql -S app_owner/password@//host:1521/service <<'EOF'
  -- SQLcl DDL export for a table (clean, formatted)
  DDL ORDERS

  -- Export entire schema
  DDL APP_OWNER.*
EOF
```

---

## Handling Grants in Version Control

### Grant File Structure

Grant files should be idempotent — safe to re-run without errors even when the grant already exists. `GRANT` statements are idempotent in Oracle; re-granting a privilege that is already held is a no-op rather than an error.

```sql
-- schema/grants/grants_to_app_user.sql
-- Grants to APP_USER (runtime application user)
-- Run as APP_OWNER

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ORDERS           TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ORDER_LINES      TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON CUSTOMERS_T      TO APP_USER;
GRANT SELECT                         ON CUSTOMER_STATUS_CODES TO APP_USER;
GRANT SELECT                         ON PRODUCTS         TO APP_USER;

-- Sequence grants
GRANT SELECT ON SEQ_ORDER_ID    TO APP_USER;
GRANT SELECT ON SEQ_CUSTOMER_ID TO APP_USER;

-- View grants
GRANT SELECT ON VW_ACTIVE_CUSTOMERS TO APP_USER;
GRANT SELECT ON VW_ORDER_SUMMARY    TO APP_USER;

-- Package execute grants
GRANT EXECUTE ON PKG_ORDERS     TO APP_USER;
GRANT EXECUTE ON PKG_CUSTOMERS  TO APP_USER;
GRANT EXECUTE ON PKG_INVOICING  TO APP_USER;
```

```sql
-- schema/grants/grants_to_report_user.sql
-- Read-only grants for reporting user REPORT_USER

GRANT SELECT ON ORDERS      TO REPORT_USER;
GRANT SELECT ON ORDER_LINES TO REPORT_USER;
GRANT SELECT ON CUSTOMERS_T TO REPORT_USER;
GRANT SELECT ON PRODUCTS    TO REPORT_USER;
GRANT SELECT ON VW_ORDER_SUMMARY TO REPORT_USER;
```

### Discovering Undocumented Grants

Periodically compare the grants in the database against those in the repository to detect drift:

```sql
-- Find grants in the database not represented in version control
-- (Run this query and compare output to your grants file)
SELECT
    GRANTEE,
    PRIVILEGE,
    OWNER       AS OBJECT_OWNER,
    TABLE_NAME  AS OBJECT_NAME,
    GRANTABLE,
    HIERARCHY
FROM
    DBA_TAB_PRIVS
WHERE
    GRANTOR = 'APP_OWNER'
ORDER BY
    GRANTEE, OBJECT_NAME, PRIVILEGE;
```

---

## Handling Synonyms in Version Control

### Public Synonyms

```sql
-- schema/synonyms/public_synonyms.sql
-- Run as SYS or a DBA with CREATE PUBLIC SYNONYM privilege

-- Create or replace public synonyms pointing to APP_OWNER
CREATE OR REPLACE PUBLIC SYNONYM ORDERS           FOR APP_OWNER.ORDERS;
CREATE OR REPLACE PUBLIC SYNONYM ORDER_LINES      FOR APP_OWNER.ORDER_LINES;
CREATE OR REPLACE PUBLIC SYNONYM CUSTOMERS        FOR APP_OWNER.CUSTOMERS;
CREATE OR REPLACE PUBLIC SYNONYM VW_ORDER_SUMMARY FOR APP_OWNER.VW_ORDER_SUMMARY;
CREATE OR REPLACE PUBLIC SYNONYM PKG_ORDERS       FOR APP_OWNER.PKG_ORDERS;
CREATE OR REPLACE PUBLIC SYNONYM PKG_CUSTOMERS    FOR APP_OWNER.PKG_CUSTOMERS;
```

### Detecting Synonym Drift

```sql
-- Find public synonyms pointing to APP_OWNER objects
-- that are not in the synonyms file
SELECT
    SYNONYM_NAME,
    TABLE_OWNER,
    TABLE_NAME,
    DB_LINK
FROM
    DBA_SYNONYMS
WHERE
    OWNER       = 'PUBLIC'
    AND TABLE_OWNER = 'APP_OWNER'
ORDER BY
    SYNONYM_NAME;
```

---

## Detecting and Resolving Schema Drift

Schema drift occurs when the database is modified in place without updating the repository. Regular drift detection keeps environments from diverging without notice.

```sql
-- Compare object checksums/timestamps between two environments
-- Run in a pipeline comparing DEV to the last known-good state

-- Objects modified more recently than last deployment
SELECT
    OBJECT_NAME,
    OBJECT_TYPE,
    STATUS,
    LAST_DDL_TIME,
    CREATED
FROM
    DBA_OBJECTS
WHERE
    OWNER         = 'APP_OWNER'
    AND OBJECT_TYPE IN ('TABLE','VIEW','PACKAGE','PACKAGE BODY',
                        'PROCEDURE','FUNCTION','TRIGGER','INDEX')
    AND LAST_DDL_TIME > TO_DATE('2025-01-01','YYYY-MM-DD')  -- Replace with last deployment time
ORDER BY
    LAST_DDL_TIME DESC;
```

```shell
# Pipeline drift detection: extract current DDL and diff against git
./extract_schema.sh  # Writes to ./schema/

git diff --stat schema/
# If output is non-empty, the database has drifted from the repository
```

---

## Best Practices

- **One object per file.** Placing `CREATE TABLE ORDERS` and `CREATE INDEX IDX_ORDERS_CUSTOMER` in the same file makes it impossible to diff or review a change to just the index. One file per object is the only approach that scales.
- **Store PL/SQL package specs and bodies in separate files.** Specs change far less often than bodies. Separating them reduces diff noise and enables partial deployments (body-only redeployment without recompiling dependents).
- **Never commit `DBMS_METADATA.GET_DDL` output without transforming it first.** Raw output includes storage clauses, segment attributes, and physical parameters that are environment-specific. Always apply the transform parameters that remove physical attributes before committing.
- **Validate DDL files on every pull request.** Use SQLcl or SQL*Plus in `WHENEVER SQLERROR EXIT` mode to syntax-check DDL files in CI, even against an empty schema. This catches repository syntax errors before they reach any live environment.
- **Track `DATABASECHANGELOG` separately.** When using Liquibase or Flyway, the migration history table is not a schema object to be reverse-engineered — the migration tool manages it exclusively.
- **Automate drift detection.** Schedule a weekly job that extracts production schema DDL, commits it to a `schema-snapshot` branch, and raises an alert whenever it diverges from the main `schema` branch. Any diff exposes unauthorized manual changes.
- **Document deployment order in `install.sql`.** The install script is executable documentation of object dependencies. Keep it up to date.

---

## Common Mistakes

**Mistake: Committing DDL with storage clauses.**
Storage clause differences across environments (varying tablespace names, extent sizes) cause every file to appear changed on every extraction. Always strip physical attributes using `DBMS_METADATA.SET_TRANSFORM_PARAM`.

**Mistake: Storing view and package source only in migration scripts.**
When the only copy of a view's definition lives in `V15__update_order_view.sql`, reconstructing the current state requires running all 15 migrations in sequence. Keep the canonical, current definition as a standalone file in `views/` and retain the migration only as a historical change record.

**Mistake: Omitting grants and synonyms entirely.**
Grants and synonyms are often left out of DDL repositories. When a new environment is provisioned from `install.sql` without them, the application fails at runtime with privilege errors. Add grants and synonyms as explicit files in the repository.

**Mistake: Using schema-qualified object names in DDL files.**
DDL files containing `CREATE TABLE APP_OWNER.ORDERS` are bound to a specific schema name. This breaks when deploying to a differently named schema — common in multi-tenant setups or personal developer schemas. Use unqualified names and rely on the schema context of the deployment connection.

**Mistake: Treating the repository as append-only for PL/SQL.**
Some teams continuously add new migration files without ever updating the standalone package and procedure files, allowing them to fall out of sync with the database. Establish a clear process: whenever a package is modified through a migration, update the corresponding `.pks` / `.pkb` file in the same commit so the repository always reflects the current state.

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [DBMS_METADATA (19c)](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_METADATA.html) — GET_DDL, SET_TRANSFORM_PARAM, SESSION_TRANSFORM, supported object types
- [Oracle Database Reference 19c — DBA_OBJECTS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_OBJECTS.html) — LAST_DDL_TIME for drift detection
- [Oracle Database Reference 19c — DBA_TAB_PRIVS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_TAB_PRIVS.html) — grant tracking
