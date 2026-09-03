# Schema Migrations for Oracle DB

## Overview

Schema migrations are how database structure keeps pace with evolving application code. In a CI/CD pipeline, every DDL change — table creation, column additions, index definitions, constraint changes — must be tracked, versioned, and applied in a repeatable, auditable manner. Executing ad hoc DDL directly against production databases is one of the primary drivers of environment drift, failed deployments, and outages.

Oracle's character set, type richness, and procedural extensions (PL/SQL, sequences, triggers, packages) introduce migration challenges that tools oriented toward MySQL tend to gloss over. This guide covers Liquibase and Flyway configured specifically for Oracle, migration strategies, and the DDL lifecycle within modern CI/CD pipelines.

---

## Liquibase with Oracle

### Core Concepts

Liquibase manages migrations through a **changelog** — a master file that references individual **changesets**. Each changeset is uniquely identified by an `id` + `author` + `file` combination, recorded in the `DATABASECHANGELOG` table that Liquibase creates during its first run. A `DATABASECHANGELOGLOCK` table guards against concurrent executions.

```
DATABASECHANGELOG
  ID           VARCHAR2(255)
  AUTHOR       VARCHAR2(255)
  FILENAME     VARCHAR2(255)
  DATEEXECUTED TIMESTAMP
  ORDEREXECUTED NUMBER
  EXECTYPE     VARCHAR2(10)   -- EXECUTED, FAILED, SKIPPED, RERAN, MARK_RAN
  MD5SUM       VARCHAR2(35)
  DESCRIPTION  VARCHAR2(255)
  COMMENTS     VARCHAR2(255)
  TAG          VARCHAR2(255)
  LIQUIBASE    VARCHAR2(20)
  CONTEXTS     VARCHAR2(255)
  LABELS       VARCHAR2(255)
  DEPLOYMENT_ID VARCHAR2(10)
```

### Project Structure

A well-structured Liquibase project organizes content by object type:

```
db/
  liquibase.properties
  changelog-root.xml
  changes/
    001-initial-schema.xml
    002-add-customer-status.xml
    003-orders-partitioning.xml
  procedures/
    pkg_orders_body.sql
    pkg_orders_spec.sql
  seeds/
    001-reference-data.xml
```

### liquibase.properties (Oracle)

```properties
# liquibase.properties
url=jdbc:oracle:thin:@//dbhost:1521/ORCLPDB1
username=APP_OWNER
password=${DB_PASSWORD}
driver=oracle.jdbc.OracleDriver
changeLogFile=db/changelog-root.xml
logLevel=INFO
defaultSchemaName=APP_OWNER
liquibaseCatalogName=APP_OWNER
```

For Oracle Wallets (the preferred approach for CI/CD):

```properties
url=jdbc:oracle:thin:@mydb_high?TNS_ADMIN=/opt/wallet
username=${DB_USER}
password=${DB_PASSWORD}
```

### Changeset Anatomy

```xml
<!-- db/changelog-root.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

  <include file="changes/001-initial-schema.xml" relativeToChangelogFile="true"/>
  <include file="changes/002-add-customer-status.xml" relativeToChangelogFile="true"/>
  <include file="changes/003-orders-partitioning.xml" relativeToChangelogFile="true"/>

</databaseChangeLog>
```

```xml
<!-- db/changes/002-add-customer-status.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

  <changeSet id="002" author="jane.smith" labels="customer,status" context="!test">
    <comment>Add STATUS column to CUSTOMERS with lookup table</comment>

    <!-- Cross-version Oracle compatibility: use NUMBER(1) instead of SQL BOOLEAN -->
    <addColumn tableName="CUSTOMERS">
      <column name="STATUS_CODE" type="VARCHAR2(10)" defaultValue="ACTIVE">
        <constraints nullable="false"/>
      </column>
    </addColumn>

    <addColumn tableName="CUSTOMERS">
      <column name="CREATED_AT" type="TIMESTAMP" defaultValueComputed="SYSTIMESTAMP">
        <constraints nullable="false"/>
      </column>
    </addColumn>

    <createTable tableName="CUSTOMER_STATUS_CODES">
      <column name="CODE"        type="VARCHAR2(10)"><constraints primaryKey="true" nullable="false"/></column>
      <column name="DESCRIPTION" type="VARCHAR2(100)"><constraints nullable="false"/></column>
      <column name="IS_ACTIVE"   type="NUMBER(1,0)" defaultValueNumeric="1"><constraints nullable="false"/></column>
    </createTable>

    <insert tableName="CUSTOMER_STATUS_CODES">
      <column name="CODE"        value="ACTIVE"/>
      <column name="DESCRIPTION" value="Active customer"/>
      <column name="IS_ACTIVE"   valueNumeric="1"/>
    </insert>

    <insert tableName="CUSTOMER_STATUS_CODES">
      <column name="CODE"        value="SUSPENDED"/>
      <column name="DESCRIPTION" value="Account suspended"/>
      <column name="IS_ACTIVE"   valueNumeric="1"/>
    </insert>

    <addForeignKeyConstraint
        baseTableName="CUSTOMERS"
        baseColumnNames="STATUS_CODE"
        referencedTableName="CUSTOMER_STATUS_CODES"
        referencedColumnNames="CODE"
        constraintName="FK_CUST_STATUS"/>

    <rollback>
      <dropForeignKeyConstraint baseTableName="CUSTOMERS" constraintName="FK_CUST_STATUS"/>
      <dropColumn tableName="CUSTOMERS" columnName="STATUS_CODE"/>
      <dropColumn tableName="CUSTOMERS" columnName="CREATED_AT"/>
      <dropTable tableName="CUSTOMER_STATUS_CODES"/>
    </rollback>
  </changeSet>

</databaseChangeLog>
```

### Oracle-Specific Data Types in Liquibase

Liquibase generic types do not always translate cleanly to Oracle equivalents. On mixed-version estates, favor explicit Oracle-native types:

| Generic Liquibase | Oracle Reality | Use Instead |
|---|---|---|
| `BOOLEAN` | SQL BOOLEAN exists in 23ai/26ai, but older estates and some toolchains still expect numeric compatibility | `NUMBER(1,0)` with CHECK (col IN (0,1)) for cross-version compatibility |
| `BIGINT` | Maps to `NUMBER(19,0)` | `NUMBER(18,0)` or `NUMBER(19,0)` explicitly |
| `DATETIME` | Maps to `DATE` (loses sub-second) | `TIMESTAMP` or `TIMESTAMP WITH TIME ZONE` |
| `TEXT` | Maps to `CLOB` | `VARCHAR2(4000)` or `CLOB` depending on need |
| `INT` | Maps to `NUMBER(10,0)` | `NUMBER(10,0)` explicitly |

```xml
<!-- Prefer explicit Oracle types -->
<column name="PRICE"      type="NUMBER(12,4)"/>
<column name="CREATED_AT" type="TIMESTAMP WITH LOCAL TIME ZONE"/>
<column name="NOTES"      type="CLOB"/>
<column name="IS_ENABLED" type="NUMBER(1,0)"/>
```

### Sequences and Triggers with Liquibase

Before Oracle 12c, identity columns were not available. Even after 12c, many codebases continue to use the sequence+trigger pattern.

```xml
<!-- Oracle 12c+ identity column -->
<changeSet id="010" author="dev">
  <createTable tableName="ORDERS">
    <column name="ORDER_ID" type="NUMBER(18,0)" autoIncrement="true"
            generationType="ALWAYS">
      <constraints primaryKey="true" nullable="false"/>
    </column>
    <column name="ORDER_DATE" type="DATE"/>
  </createTable>
</changeSet>

<!-- Pre-12c: explicit sequence + trigger -->
<changeSet id="010b" author="dev" dbms="oracle">
  <createSequence sequenceName="SEQ_ORDERS"
                  startValue="1"
                  incrementBy="1"
                  minValue="1"
                  maxValue="9999999999999999999"
                  cycle="false"
                  ordered="false"
                  cacheSize="20"/>

  <!-- Use sqlFile for complex PL/SQL -->
  <sqlFile path="triggers/trg_orders_bi.sql"
           relativeToChangelogFile="false"
           splitStatements="false"
           endDelimiter="/"
           stripComments="false"/>

  <rollback>
    <sql>DROP TRIGGER TRG_ORDERS_BI</sql>
    <dropSequence sequenceName="SEQ_ORDERS"/>
  </rollback>
</changeSet>
```

```sql
-- triggers/trg_orders_bi.sql
CREATE OR REPLACE TRIGGER TRG_ORDERS_BI
BEFORE INSERT ON ORDERS
FOR EACH ROW
WHEN (NEW.ORDER_ID IS NULL)
BEGIN
  :NEW.ORDER_ID := SEQ_ORDERS.NEXTVAL;
END;
/
```

### Running Liquibase

```shell
# Preview changes without executing (generates SQL to stdout)
liquibase updateSQL

# Apply pending changesets
liquibase update

# Apply only changesets tagged up to a specific point
liquibase updateToTag v2.3.0

# Tag the current state
liquibase tag v2.3.0

# Roll back to a tag
liquibase rollback v2.3.0

# Roll back a specific count of changesets
liquibase rollbackCount 3

# Check current status
liquibase status --verbose

# Validate changelog syntax
liquibase validate
```

---

## Flyway with Oracle

### Key Differences from Liquibase

Flyway relies on a simpler, filename-driven versioning scheme. Migration files follow the naming pattern `V{version}__{description}.sql` for versioned migrations and `R__{description}.sql` for repeatable ones. There is no XML DSL — all content is raw SQL or Java callbacks.

```
db/migration/
  V1__initial_schema.sql
  V2__add_customer_status.sql
  V2.1__customer_status_fk.sql
  V3__orders_table.sql
  R__vw_active_customers.sql        -- repeatable
  R__pkg_order_processing.sql       -- repeatable (PL/SQL package)
```

### flyway.toml (Oracle)

```toml
[environments.default]
url = "jdbc:oracle:thin:@//dbhost:1521/ORCLPDB1"
user = "${DB_USER}"
password = "${DB_PASSWORD}"
schemas = ["APP_OWNER"]

[flyway]
locations = ["filesystem:db/migration"]
defaultSchema = "APP_OWNER"
validateOnMigrate = true
outOfOrder = false
# Required for PL/SQL blocks that end with /
sqlMigrationSuffixes = [".sql"]
placeholderReplacement = false
```

### Oracle PL/SQL in Flyway

Flyway defaults to `;` as the statement delimiter. PL/SQL blocks require `/` as the terminator instead. Set this per migration using the special comment annotation:

```sql
-- V4__create_order_package.sql
-- flyway:delimiter=/

CREATE OR REPLACE PACKAGE PKG_ORDERS AS
  PROCEDURE process_order(p_order_id IN NUMBER);
  FUNCTION  get_order_total(p_order_id IN NUMBER) RETURN NUMBER;
END PKG_ORDERS;
/

CREATE OR REPLACE PACKAGE BODY PKG_ORDERS AS

  PROCEDURE process_order(p_order_id IN NUMBER) IS
    v_status VARCHAR2(10);
  BEGIN
    SELECT STATUS_CODE INTO v_status
    FROM   ORDERS
    WHERE  ORDER_ID = p_order_id;

    IF v_status = 'PENDING' THEN
      UPDATE ORDERS
      SET    STATUS_CODE  = 'PROCESSING',
             PROCESSED_AT = SYSTIMESTAMP
      WHERE  ORDER_ID = p_order_id;
    END IF;

    COMMIT;
  END process_order;

  FUNCTION get_order_total(p_order_id IN NUMBER) RETURN NUMBER IS
    v_total NUMBER;
  BEGIN
    SELECT SUM(LINE_TOTAL)
    INTO   v_total
    FROM   ORDER_LINES
    WHERE  ORDER_ID = p_order_id;
    RETURN NVL(v_total, 0);
  END get_order_total;

END PKG_ORDERS;
/
```

### Repeatable Migrations

Repeatable migrations execute again whenever their checksum changes. They are well-suited to views, packages, synonyms, and grants — objects that should be fully replaced rather than altered incrementally.

```sql
-- R__vw_active_customers.sql
-- This re-runs any time the file content changes

CREATE OR REPLACE VIEW VW_ACTIVE_CUSTOMERS AS
SELECT
    c.CUSTOMER_ID,
    c.FIRST_NAME,
    c.LAST_NAME,
    c.EMAIL,
    c.STATUS_CODE,
    cs.DESCRIPTION  AS STATUS_DESC,
    c.CREATED_AT
FROM
    CUSTOMERS       c
JOIN
    CUSTOMER_STATUS_CODES cs ON cs.CODE = c.STATUS_CODE
WHERE
    c.STATUS_CODE != 'CLOSED';
```

```sql
-- R__pkg_order_processing.sql
-- flyway:delimiter=/

CREATE OR REPLACE PACKAGE BODY PKG_ORDER_PROCESSING AS
  -- Full package body here; re-deployed on any change
END PKG_ORDER_PROCESSING;
/
```

### Running Flyway

```shell
# Check migration status
flyway info

# Apply pending migrations
flyway migrate

# Validate checksums (detects manual edits to applied migrations)
flyway validate

# Repair checksum mismatches (use carefully — only for broken environments)
flyway repair

# Undo last versioned migration (requires Flyway Teams)
flyway undo

# Clean schema (NEVER in production — drops all objects)
flyway clean
```

---

## Versioned vs Repeatable Migrations

| Aspect | Versioned (V prefix) | Repeatable (R prefix) |
|---|---|---|
| Execution | Once, in version order | On every checksum change |
| Rollback | Requires explicit undo migration | Simply revert file content |
| Use cases | Table/column DDL, data backfills | Views, packages, synonyms, grants |
| Ordering | Sequential, enforced | Runs after all versioned migrations |
| Collision | Two same-version files = error | Re-runs are idempotent |

### Guidelines

- DDL that alters existing tables (ALTER TABLE) must be versioned — it cannot be applied idempotently on repeat.
- Views, materialized view definitions, packages, procedures, and functions should be repeatable. This avoids the common anti-pattern of a `V12__fix_view.sql` that largely duplicates `V8__create_view.sql`.
- Reference data inserts should be versioned or should use `MERGE` inside repeatable migrations to ensure idempotency.

---

## Managing DDL in CI/CD Pipelines

### Pipeline Design

```yaml
# .github/workflows/db-deploy.yml
name: Database Deploy

on:
  push:
    branches: [main]
    paths:
      - 'db/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate Liquibase Changelog
        run: |
          liquibase \
            --url="${{ secrets.DB_DEV_URL }}" \
            --username="${{ secrets.DB_USER }}" \
            --password="${{ secrets.DB_PASSWORD }}" \
            validate

  deploy-dev:
    needs: validate
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4

      - name: Generate migration SQL (artifact for review)
        run: |
          liquibase \
            --url="${{ secrets.DB_DEV_URL }}" \
            --username="${{ secrets.DB_USER }}" \
            --password="${{ secrets.DB_PASSWORD }}" \
            updateSQL > migration-dev.sql

      - uses: actions/upload-artifact@v4
        with:
          name: migration-sql-dev
          path: migration-dev.sql

      - name: Apply migrations to DEV
        run: |
          liquibase \
            --url="${{ secrets.DB_DEV_URL }}" \
            --username="${{ secrets.DB_USER }}" \
            --password="${{ secrets.DB_PASSWORD }}" \
            update

  deploy-prod:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Apply migrations to PROD
        run: |
          liquibase \
            --url="${{ secrets.DB_PROD_URL }}" \
            --username="${{ secrets.DB_USER }}" \
            --password="${{ secrets.DB_PASSWORD }}" \
            update
```

### Locking and Concurrency

Both Liquibase and Flyway use a lock table to block concurrent migration runs. In CI/CD environments with multiple parallel jobs or failed deployments, stale locks frequently occur:

```sql
-- Liquibase: check and release a stale lock
SELECT * FROM DATABASECHANGELOGLOCK;

UPDATE DATABASECHANGELOGLOCK
SET    LOCKED      = 0,
       LOCKGRANTED = NULL,
       LOCKEDBY    = NULL
WHERE  ID = 1;

COMMIT;
```

```shell
# Flyway: release stale lock
flyway repair
```

### Environment-Specific Configuration

Never embed credentials directly in changelogs. Use environment variables or vault references instead:

```shell
# Shell pattern using environment variables
export LIQUIBASE_COMMAND_URL="jdbc:oracle:thin:@//${DB_HOST}:${DB_PORT}/${DB_SERVICE}"
export LIQUIBASE_COMMAND_USERNAME="${DB_USER}"
export LIQUIBASE_COMMAND_PASSWORD="${DB_PASSWORD}"
liquibase update
```

---

## Handling Sequences in Migrations

Sequences demand extra care because their current value is stateful — unlike structural DDL, a sequence's `LAST_NUMBER` cannot simply be rolled back.

```sql
-- Creating a sequence with Oracle best practices
CREATE SEQUENCE SEQ_INVOICE_ID
    START WITH     1
    INCREMENT BY   1
    MINVALUE       1
    MAXVALUE       9999999999999999999
    NOCYCLE
    CACHE          100    -- Cache 100 values in memory; balance performance vs gap size
    NOORDER;              -- ORDER only needed for RAC when strict ordering is required
```

```xml
<!-- Liquibase: sequence creation with rollback -->
<changeSet id="020" author="dev" dbms="oracle">
  <createSequence
      sequenceName="SEQ_INVOICE_ID"
      startValue="1"
      incrementBy="1"
      cacheSize="100"
      cycle="false"
      ordered="false"/>
  <rollback>
    <dropSequence sequenceName="SEQ_INVOICE_ID"/>
  </rollback>
</changeSet>
```

### Resetting Sequences in Non-Production

A frequent requirement is resetting sequences after data refreshes in non-production environments:

```sql
-- Reset sequence to 1 (Oracle 18c+)
ALTER SEQUENCE SEQ_INVOICE_ID RESTART START WITH 1;

-- Pre-18c workaround: drop and recreate
DECLARE
  v_current NUMBER;
  v_stmt    VARCHAR2(200);
BEGIN
  SELECT LAST_NUMBER INTO v_current
  FROM   USER_SEQUENCES
  WHERE  SEQUENCE_NAME = 'SEQ_INVOICE_ID';

  -- Step down by current value to effectively reset
  v_stmt := 'ALTER SEQUENCE SEQ_INVOICE_ID INCREMENT BY -' || v_current || ' MINVALUE 0';
  EXECUTE IMMEDIATE v_stmt;
  EXECUTE IMMEDIATE 'SELECT SEQ_INVOICE_ID.NEXTVAL FROM DUAL';
  EXECUTE IMMEDIATE 'ALTER SEQUENCE SEQ_INVOICE_ID INCREMENT BY 1 MINVALUE 1';
END;
/
```

---

## Best Practices

- **Never modify an already-applied versioned migration.** Both tools detect checksum changes. When a deployed migration contains a bug, author a new corrective migration. Reserve `flyway repair` or `liquibase changelogSync` exclusively for environments where the change was already applied manually and the tooling state is broken.
- **Keep the DDL owner separate from the application user.** Execute migrations under a schema owner (or DBA-equivalent) account. The runtime application user should hold only DML privileges, preventing accidental DDL from application-layer bugs.
- **Keep changesets small and purposeful.** One logical change per changeset. Large changesets are difficult to roll back, harder to diagnose, and can hold DDL locks that block other schema operations for extended periods.
- **Always author rollback blocks.** Liquibase does not auto-generate rollback SQL for many Oracle DDL operations. Write explicit `<rollback>` blocks even when you do not expect to use them — they also function as documentation.
- **Use contexts and labels** to govern which changesets execute in each environment. Seed data, test fixtures, and resource-intensive backfills should be excluded from production runs.
- **Run `updateSQL` before `update` in production.** The resulting SQL file serves as an artifact for DBA review, audit logs, and post-incident analysis.
- **Avoid `flyway clean` on shared environments.** It drops all objects. Limit its use to fully isolated development environments or ephemeral CI containers.

---

## Common Mistakes

**Mistake: Using `BOOLEAN` as a column type.**
Oracle 23ai/26ai support SQL `BOOLEAN`, but many Oracle estates still target 19c compatibility and some migration toolchains normalize booleans to numeric columns. For cross-version portability, explicitly use `NUMBER(1,0)` with a CHECK constraint unless you are deliberately targeting 23ai/26ai-only schemas.

```sql
-- Wrong (ambiguous mapping)
<column name="IS_ACTIVE" type="BOOLEAN"/>

-- Right
<column name="IS_ACTIVE" type="NUMBER(1,0)" defaultValueNumeric="1">
  <constraints nullable="false" checkConstraint="IS_ACTIVE IN (0, 1)"/>
</column>
```

**Mistake: Committing `splitStatements=true` with PL/SQL.**
Liquibase splits on `;` by default. Because PL/SQL blocks contain numerous semicolons, always set `splitStatements="false"` and use `endDelimiter="/"` for PL/SQL files.

**Mistake: Including `GRANT` statements in versioned migrations.**
Grants applied through versioned migrations are executed once and then no longer tracked. If a user is dropped and recreated, the grant disappears. Use repeatable migrations or a dedicated idempotent grants script instead.

**Mistake: Not testing rollbacks.**
A rollback is only valuable if it actually works. Include rollback testing in CI by applying a set of migrations, rolling back, then confirming the schema matches the pre-migration baseline.

**Mistake: Running migrations synchronously with application deployment.**
In high-availability deployments, the application and database versions may be briefly out of sync. Design migrations to be backward-compatible: add columns as nullable before backfilling, and do not drop columns until the older application version has been fully decommissioned.

---


## Security Considerations

### Privilege Management for Migration Accounts
Migration processes frequently require elevated privileges, which introduces security risk if those privileges are not carefully scoped:

- **Use least privilege principle for migration accounts:**
  ```sql
  -- Instead of granting DBA role (excessive privileges):
  -- GRANT DBA TO migration_user; -- AVOID

  -- Grant only specific privileges needed for schema changes:
  CREATE USER migration_user IDENTIFIED BY "strong_password";
  GRANT CREATE SESSION TO migration_user;
  GRANT CREATE TABLE, ALTER TABLE, DROP TABLE TO migration_user;
  GRANT CREATE VIEW, ALTER VIEW, DROP VIEW TO migration_user;
  GRANT CREATE PROCEDURE, ALTER PROCEDURE, DROP PROCEDURE TO migration_user;
  GRANT CREATE TRIGGER, ALTER TRIGGER, DROP TRIGGER TO migration_user;
  GRANT CREATE SEQUENCE, ALTER SEQUENCE, DROP SEQUENCE TO migration_user;
  GRANT CREATE INDEX, ALTER INDEX, DROP INDEX TO migration_user;
  -- Add privileges for specific schemas if needed
  GRANT CREATE ANY TABLE TO migration_user;  -- Only if absolutely necessary
  GRANT CREATE ANY INDEX TO migration_user;  -- Only if absolutely necessary
  ```

- **Keep the migration user distinct from the application user:**
  - Migration user: Holds DDL privileges to modify the schema
  - Application user: Holds only DML privileges (SELECT, INSERT, UPDATE, DELETE) on application objects
  - Never share the same credentials between both roles

- **Consider using role-based access control:**
  ```sql
  CREATE ROLE schema_migration_role;
  GRANT CREATE TABLE, ALTER TABLE, DROP TABLE TO schema_migration_role;
  GRANT CREATE VIEW, ALTER VIEW, DROP VIEW TO schema_migration_role;
  GRANT CREATE PROCEDURE, ALTER PROCEDURE, DROP PROCEDURE TO schema_migration_role;
  GRANT CREATE TRIGGER, ALTER TRIGGER, DROP TRIGGER TO schema_migration_role;
  GRANT CREATE SEQUENCE, ALTER SEQUENCE, DROP SEQUENCE TO schema_migration_role;
  GRANT CREATE INDEX, ALTER INDEX, DROP INDEX TO schema_migration_role;
  GRANT schema_migration_role TO migration_user;
  ```

### Secure Credential Handling in CI/CD
Migration tools require database credentials, which must be safeguarded throughout CI/CD pipelines:

- **Never hardcode credentials in migration files or configuration:**
  ```xml
  <!-- AVOID: Hardcoded credentials in changelog -->
  <databaseChangeLog
      xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
      username="<REQUIRED_USERNAME>"
      password="<REQUIRED_SECRET>">
  ```

- **Use environment variables or secret management systems:**
  ```bash
  # Liquibase with environment variables (CI/CD safe)
  liquibase \
    --url="${{ secrets.DB_PROD_URL }}" \
    --username="${{ secrets.DB_USER }}" \
    --password="${{ secrets.DB_PASSWORD }}" \
    update
  ```

  ```toml
  # Flyway TOML with environment variables
  [environments.default]
  url = "${DB_PROD_URL}"
  user = "${DB_USER}"
  password = "${DB_PASSWORD}"
  ```

- **Integrate with enterprise secret stores:**
  - HashiCorp Vault, AWS Secrets Manager, Azure Key Vault
  - Retrieve secrets at runtime using CI/CD plugin integrations
  - Never commit secrets to repository history

### Protecting Sensitive Data During Migrations
Schema migrations can expose or mishandle sensitive data when not properly controlled:

- **Be cautious with data migrations involving sensitive information:**
  ```sql
  -- Example: Migrating to encrypted columns
  BEGIN
    -- Add encrypted column
    ALTER TABLE customers ADD (ssn_encrypted VARCHAR2(255));

    -- Encrypt existing data (in batches to avoid locks)
    UPDATE customers
    SET ssn_encrypted = ENCRYPT_USING(ssn, 'AES256', :encryption_key)
    WHERE ssn IS NOT NULL;

    -- Verify encryption worked
    -- Drop original column only after verification
    ALTER TABLE customers DROP COLUMN ssn;
  END;
  ```

- **Apply secure techniques when handling sensitive data:**
  - Process sensitive data in small batches to reduce exposure windows
  - Source encryption keys from secure wallets or HSMs rather than hardcoded values
  - Consider enabling Oracle Data Redaction during migration windows
  - Log access to sensitive data throughout migration processes

- **Never log or expose sensitive data in migration scripts:**
  ```sql
  -- AVOID: Logging sensitive values
  INSERT INTO migration_log (step, details)
  VALUES ('ENCRYPT_SSN', 'Encrypting SSN: ' || ssn_value);  -- EXPOSES SENSITIVE DATA

  -- INSTEAD: Log only non-sensitive metadata
  INSERT INTO migration_log (step, details, record_count)
  VALUES ('ENCRYPT_SSN', 'SSN encryption completed', SQL%ROWCOUNT);
  ```

### Audit and Compliance for Schema Changes
Schema changes should themselves be audited for compliance and security monitoring purposes:

- **Enable DDL auditing to track schema modifications:**
  ```sql
  -- Audit all DDL changes in critical schemas
  CREATE AUDIT POLICY schema_changes_audit
    ACTIONS CREATE TABLE, ALTER TABLE, DROP TABLE,
              CREATE VIEW, ALTER VIEW, DROP VIEW,
              CREATE PROCEDURE, ALTER PROCEDURE, DROP PROCEDURE,
              CREATE TRIGGER, ALTER TRIGGER, DROP TRIGGER,
              CREATE SEQUENCE, DROP SEQUENCE,
              CREATE INDEX, DROP INDEX;
  AUDIT POLICY schema_changes_audit BY USERS WITH GRANTED ROLES;
  ```

- **Monitor for unauthorized schema changes:**
  ```sql
  -- Alert on DDL outside of approved maintenance windows
  CREATE AUDIT POLICY unauthorized_ddl_alert
    ACTIONS CREATE TABLE, ALTER TABLE, DROP TABLE
    WHEN 'NOT (TO_NUMBER(TO_CHAR(SYSDATE,''HH24MISS'')) BETWEEN 20000 AND 40000)'
    EVALUATE PER SESSION;
  AUDIT POLICY unauthorized_ddl_alert;
  ```

- **Maintain an immutable audit trail for compliance:**
  - Ensure migration users cannot alter or delete audit records
  - Use unified auditing with the dedicated AUDSYS schema
  - Archive audit logs regularly to secure, write-once storage

### Securing Migration Artifacts
SQL files generated during migrations can contain sensitive information:

- **Treat generated SQL as potentially sensitive:**
  - May expose table structures, index definitions, and data values
  - Restrict access to migration artifacts (updateSQL output)
  - Delete temporary SQL files after use in CI/CD pipelines

- **Secure handling of migration SQL artifacts:**
  ```yaml
  # In CI/CD pipeline - secure handling of generated SQL
  - name: Generate migration SQL (artifact for review)
    run: |
      liquibase \
        --url="${{ secrets.DB_PROD_URL }}" \
        --username="${{ secrets.DB_USER }}" \
        --password="${{ secrets.DB_PASSWORD }}" \
        updateSQL > migration-prod.sql
  - name: Upload encrypted artifact
    run: |
      # Encrypt before uploading if containing sensitive data
      gpg --symmetric --cipher-algo AES256 migration-prod.sql
      rm migration-prod.sql  # Delete plaintext version
  - uses: actions/upload-artifact@v4
    with:
      name: encrypted-migration-sql
      path: migration-prod.sql.gpg
  ```

### Database Link Security in Migrations

- **Secure database link usage in migration scripts:**
  ```sql
  -- AVOID: Hardcoded credentials in database links
  CREATE DATABASE LINK remote_db
  CONNECT TO remote_user IDENTIFIED BY "hardcoded_password"
  USING 'remote_database';

  -- INSTEAD: Use external password store or OS authentication
  CREATE DATABASE LINK secure_remote_db
  CONNECT TO CURRENT_USER USING 'remote_database';
  -- Or use wallet-based authentication
  ```

- **Monitor and audit database link usage:**
  ```sql
  CREATE AUDIT POLICY db_link_usage
    ACTIONS EXECUTE ON SYS.DBMS_SQL;
  AUDIT POLICY db_link_usage;
  ```

### Migration Rollback Security Considerations

- **Validate rollback procedures in non-production first:**
  - Confirm rollback scripts do not leave data in an inconsistent state
  - Verify that sensitive data is handled correctly during rollback

- **Exercise caution around data loss during rollback:**
  ```sql
  -- Example: Adding then dropping a column
  -- Migration: ADD COLUMN ssn VARCHAR2(11)
  -- Rollback: DROP COLUMN ssn
  --
  -- If rollback is executed after data has been added:
  -- THE SSN DATA IS PERMANENTLY LOST
  --
  -- Better approach for sensitive data:
  -- Migration: ADD COLUMN ssn_encrypted VARCHAR2(255) (encrypted)
  -- Migration: COPY AND ENCRYPT DATA FROM ssn TO ssn_encrypted
  -- Migration: DROP COLUMN ssn (after verification)
  -- Rollback: RECOVERY PROCEDURE NEEDED (not simple DROP)
  ```

### Compliance-Specific Migration Requirements

- **PCI-DSS Requirement 6.4**:
  - Limit access to cardholder data environments
  - Put change detection mechanisms in place for schema modifications
  - Maintain separate development/test and production environments

- **SOX Section 404**:
  - Apply change management controls to financial systems
  - Document and obtain approval for all schema changes
  - Preserve an audit trail of every DDL change

- **GDPR Article 25 (Data Protection by Design)**:
  - Apply data minimization principles when adding new columns
  - Introduce pseudonymization techniques wherever applicable
  - Ensure the right to erasure can be satisfied through schema design

### Secure Migration Lifecycle

- **Development**: Use encrypted credentials; test against anonymized data
- **CI/CD**: Handle credentials securely, protect artifacts, enforce approval gates
- **Staging**: Validate against production-like data with masking applied
- **Production**: Operate within change windows, monitor actively, ensure rollback procedures are tested

## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Liquibase Documentation](https://docs.liquibase.com/) — changelog structure, changeset anatomy, Oracle data type mappings, rollback
- [Flyway Documentation](https://documentation.red-gate.com/flyway) — versioned vs. repeatable migrations, flyway.toml, PL/SQL delimiter configuration
- [Oracle Database SQL Language Reference 19c — CREATE SEQUENCE](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-SEQUENCE.html) — CACHE, NOORDER, RESTART (18c+)
- [Oracle Database Development Guide 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/adfns/) — Oracle-specific migration considerations
