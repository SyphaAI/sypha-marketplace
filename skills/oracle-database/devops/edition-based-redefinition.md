# Edition-Based Redefinition (EBR) in Oracle DB

## Overview

Edition-Based Redefinition (EBR) is Oracle's mechanism for rolling out application changes to a live database with zero downtime — including changes to PL/SQL code, views, and synonyms. It lets multiple versions of these objects coexist in the database simultaneously, each contained within its own named **edition**. Database sessions are bound to a specific edition, so old and new application instances can run in parallel against the same database while each sees its own version of the code.

EBR arrived in Oracle 11g Release 2 and represents Oracle's canonical approach to hot-rollover (blue/green or rolling) deployments at the database tier. It goes well beyond simple package replacement — it manages the entire application schema version lifecycle, including backward-compatible view evolution and cross-edition data synchronization.

---

## Core Concepts

### Editions

An edition is a named, schema-independent container for editionable objects. Editions are organized as a tree with the default edition (`ORA$BASE`) at its root. Child editions inherit all objects from their parent; any change made in a child edition overrides the parent version for sessions running in that edition.

```
ORA$BASE (root edition)
  └── V1 (initial production)
        └── V2 (in-flight deployment)
              └── V3 (next deployment)
```

```sql
-- List all editions in the database
SELECT EDITION_NAME, PARENT_EDITION_NAME, USABLE
FROM   DBA_EDITIONS
ORDER BY EDITION_NAME;

-- Current edition of the session
SELECT SYS_CONTEXT('USERENV', 'CURRENT_EDITION_NAME') FROM DUAL;

-- Default edition for the database
SELECT PROPERTY_VALUE FROM DATABASE_PROPERTIES
WHERE  PROPERTY_NAME = 'DEFAULT_EDITION';
```

### Editionable Object Types

Not every database object type supports editionability. Only the following types can hold edition-specific versions:

| Editionable | Not Editionable |
|---|---|
| PROCEDURE | TABLE |
| FUNCTION | INDEX |
| PACKAGE (spec + body) | SEQUENCE |
| TRIGGER | MATERIALIZED VIEW |
| TYPE (spec + body) | GRANT |
| VIEW | DATABASE LINK |
| SYNONYM | |
| LIBRARY | |
| SQL Translation Profile | |

Tables, indexes, and sequences are shared by all editions. This is central to the design: EBR handles code versioning, not data versioning.

### Enabling Editions on a Schema

```sql
-- Editions must be enabled for each schema that will use EBR
-- Requires ALTER USER privilege
ALTER USER app_owner ENABLE EDITIONS;

-- Verify
SELECT USERNAME, EDITIONS_ENABLED
FROM   DBA_USERS
WHERE  USERNAME = 'APP_OWNER';
```

### Creating and Using Editions

```sql
-- Create a new edition (requires CREATE EDITION system privilege)
CREATE EDITION v2 AS CHILD OF v1;

-- Set the database default edition (new sessions use this edition)
ALTER DATABASE DEFAULT EDITION = v2;

-- Set the edition for a specific session
ALTER SESSION SET EDITION = v2;

-- Grant USE on an edition to a user
GRANT USE ON EDITION v2 TO app_user;
```

---

## Editioning Views

Since tables are not editionable, EBR introduces the **editioning view** as the boundary between editionable code and non-editionable data. Application code never accesses a base table directly; it queries an editioning view. During a deployment, the editioning view can be redefined within the new edition to present a different column layout while the base table holds data for both the old and new schema.

### Creating an Editioning View

```sql
-- The base table contains all columns for current and transitional state
CREATE TABLE CUSTOMERS_T (
    CUSTOMER_ID    NUMBER(18,0)     NOT NULL,
    -- Old columns (present in V1)
    FULL_NAME      VARCHAR2(200),
    -- New columns (added for V2 deployment)
    FIRST_NAME     VARCHAR2(100),
    LAST_NAME      VARCHAR2(100),
    EMAIL          VARCHAR2(320)    NOT NULL,
    STATUS_CODE    VARCHAR2(10)     DEFAULT 'ACTIVE' NOT NULL,
    CREATED_AT     TIMESTAMP        DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_CUSTOMERS_T PRIMARY KEY (CUSTOMER_ID)
);

-- V1 editioning view: exposes the old column layout
-- (Run while connected to V1 edition)
CREATE OR REPLACE EDITIONING VIEW CUSTOMERS AS
SELECT
    CUSTOMER_ID,
    FULL_NAME,
    EMAIL,
    STATUS_CODE,
    CREATED_AT
FROM CUSTOMERS_T;
```

```sql
-- V2 editioning view: exposes the new column layout
-- (Run while connected to V2 edition)
ALTER SESSION SET EDITION = v2;

CREATE OR REPLACE EDITIONING VIEW CUSTOMERS AS
SELECT
    CUSTOMER_ID,
    FIRST_NAME,
    LAST_NAME,
    EMAIL,
    STATUS_CODE,
    CREATED_AT
FROM CUSTOMERS_T;
```

Sessions in edition `v1` observe the `FULL_NAME` layout. Sessions in edition `v2` observe the `FIRST_NAME`, `LAST_NAME` layout. Both read from the same physical `CUSTOMERS_T` table.

---

## Crossedition Triggers

Because both editions write to the same base table, a mechanism is required to keep data consistent across column layouts. **Crossedition triggers** forward writes from one edition's column layout to the other.

### Forward Crossedition Trigger

A forward crossedition trigger fires in the old edition and propagates changes to the new columns, ensuring that data written by old-edition sessions remains visible to new-edition sessions.

```sql
-- Connect as V1 edition, create the forward trigger
ALTER SESSION SET EDITION = v1;

CREATE OR REPLACE TRIGGER TRG_CUST_FORWARD
BEFORE INSERT OR UPDATE ON CUSTOMERS_T
FOR EACH ROW
FORWARD CROSSEDITION
DISABLE
BEGIN
  -- When old code writes FULL_NAME, split it into FIRST_NAME / LAST_NAME
  IF :NEW.FULL_NAME IS NOT NULL THEN
    :NEW.FIRST_NAME := REGEXP_SUBSTR(:NEW.FULL_NAME, '^\S+');
    :NEW.LAST_NAME  := REGEXP_SUBSTR(:NEW.FULL_NAME, '\S+$');
  END IF;
END;
/

-- Enable the trigger once the V2 deployment is ready to start accepting traffic
ALTER TRIGGER TRG_CUST_FORWARD ENABLE;
```

### Reverse Crossedition Trigger

A reverse crossedition trigger fires in the new edition and propagates changes back to the old columns, keeping old-edition sessions consistent for as long as they remain active.

```sql
-- Connect as V2 edition, create the reverse trigger
ALTER SESSION SET EDITION = v2;

CREATE OR REPLACE TRIGGER TRG_CUST_REVERSE
BEFORE INSERT OR UPDATE ON CUSTOMERS_T
FOR EACH ROW
REVERSE CROSSEDITION
DISABLE
BEGIN
  -- When new code writes FIRST_NAME and LAST_NAME, reconstruct FULL_NAME
  IF :NEW.FIRST_NAME IS NOT NULL OR :NEW.LAST_NAME IS NOT NULL THEN
    :NEW.FULL_NAME := TRIM(:NEW.FIRST_NAME || ' ' || :NEW.LAST_NAME);
  END IF;
END;
/

ALTER TRIGGER TRG_CUST_REVERSE ENABLE;
```

---

## Hot-Rollover Deployment Workflow

A hot-rollover deployment using EBR follows a clearly defined sequence:

### Phase 1: Prepare the New Edition

```sql
-- 1. Create the new edition
CREATE EDITION v2 AS CHILD OF v1;

-- 2. Add new columns to the base table (additive, non-breaking)
ALTER TABLE CUSTOMERS_T ADD (
    FIRST_NAME VARCHAR2(100),
    LAST_NAME  VARCHAR2(100)
);

-- 3. Switch to new edition and deploy new code
ALTER SESSION SET EDITION = v2;

-- 4. Create the new editioning view (V2 layout)
CREATE OR REPLACE EDITIONING VIEW CUSTOMERS AS
SELECT CUSTOMER_ID, FIRST_NAME, LAST_NAME, EMAIL, STATUS_CODE, CREATED_AT
FROM   CUSTOMERS_T;

-- 5. Deploy updated PL/SQL packages in V2 edition
CREATE OR REPLACE PACKAGE PKG_CUSTOMERS AS
  PROCEDURE create_customer(
    p_first_name IN VARCHAR2,
    p_last_name  IN VARCHAR2,
    p_email      IN VARCHAR2
  );
END PKG_CUSTOMERS;
/

CREATE OR REPLACE PACKAGE BODY PKG_CUSTOMERS AS
  PROCEDURE create_customer(
    p_first_name IN VARCHAR2,
    p_last_name  IN VARCHAR2,
    p_email      IN VARCHAR2
  ) IS
  BEGIN
    INSERT INTO CUSTOMERS (CUSTOMER_ID, FIRST_NAME, LAST_NAME, EMAIL)
    VALUES (SEQ_CUSTOMER_ID.NEXTVAL, p_first_name, p_last_name, p_email);
    COMMIT;
  END create_customer;
END PKG_CUSTOMERS;
/
```

### Phase 2: Enable Crossedition Triggers

```sql
-- Enable forward crossedition trigger (in V1) to propagate old writes to new columns
ALTER SESSION SET EDITION = v1;
ALTER TRIGGER TRG_CUST_FORWARD ENABLE;

-- Enable reverse crossedition trigger (in V2) to propagate new writes to old columns
ALTER SESSION SET EDITION = v2;
ALTER TRIGGER TRG_CUST_REVERSE ENABLE;
```

### Phase 3: Backfill Existing Data

```sql
-- Populate new columns for rows that were inserted before the triggers were enabled
ALTER SESSION SET EDITION = v2;

UPDATE CUSTOMERS_T
SET
    FIRST_NAME = REGEXP_SUBSTR(FULL_NAME, '^\S+'),
    LAST_NAME  = REGEXP_SUBSTR(FULL_NAME, '\S+$')
WHERE
    FULL_NAME IS NOT NULL
    AND (FIRST_NAME IS NULL OR LAST_NAME IS NULL);

COMMIT;
```

### Phase 4: Switch Traffic to New Edition

```sql
-- Set V2 as the default edition for new sessions
-- (Existing sessions in V1 continue uninterrupted)
ALTER DATABASE DEFAULT EDITION = v2;
```

From this point, new application instances connect under V2. Old application instances running in V1 continue to function. Both instance sets share the same data, with crossedition triggers maintaining synchronization between both column layouts.

### Phase 5: Retire the Old Edition

Once all application instances using V1 have been shut down:

```sql
-- Disable crossedition triggers (no longer needed)
ALTER TRIGGER TRG_CUST_FORWARD DISABLE;
ALTER TRIGGER TRG_CUST_REVERSE DISABLE;

-- Optionally drop them
DROP TRIGGER TRG_CUST_FORWARD;
DROP TRIGGER TRG_CUST_REVERSE;

-- Drop the old columns (now that V1 is retired)
ALTER TABLE CUSTOMERS_T DROP COLUMN FULL_NAME;

-- Drop the old edition (cannot drop an edition that has sessions or is the default)
DROP EDITION v1 CASCADE;
-- CASCADE drops all editioned objects that existed only in v1
```

---

## Managing Editions in Practice

### Listing Objects Per Edition

```sql
-- Which edition does each object belong to?
SELECT OBJECT_NAME, OBJECT_TYPE, EDITION_NAME, STATUS
FROM   USER_OBJECTS_AE  -- AE = All Editions
WHERE  OBJECT_TYPE IN ('PACKAGE', 'PACKAGE BODY', 'VIEW', 'PROCEDURE', 'FUNCTION')
ORDER BY OBJECT_NAME, EDITION_NAME;
```

### Comparing Object State Across Editions

```sql
-- Find objects that differ between editions
SELECT a.OBJECT_NAME, a.OBJECT_TYPE,
       a.EDITION_NAME AS EDITION_A,
       b.EDITION_NAME AS EDITION_B,
       a.LAST_DDL_TIME AS MODIFIED_IN_A,
       b.LAST_DDL_TIME AS MODIFIED_IN_B
FROM   USER_OBJECTS_AE a
JOIN   USER_OBJECTS_AE b
  ON   a.OBJECT_NAME = b.OBJECT_NAME
  AND  a.OBJECT_TYPE = b.OBJECT_TYPE
  AND  a.EDITION_NAME != b.EDITION_NAME
WHERE  a.EDITION_NAME = 'V1'
  AND  b.EDITION_NAME = 'V2'
  AND  a.LAST_DDL_TIME != b.LAST_DDL_TIME;
```

### Setting Edition in Connection Strings

```shell
# JDBC connection string with edition
jdbc:oracle:thin:@//host:1521/service?oracle.jdbc.editionName=V2

# SQL*Plus
sqlplus app_user/password@//host:1521/service
ALTER SESSION SET EDITION = v2;

# OCI (Python cx_Oracle / oracledb)
import oracledb
conn = oracledb.connect(
    user="app_user",
    password=password,
    dsn="host:1521/service",
    edition="V2"
)
```

---

## Use Cases and Limitations

### Ideal Use Cases

- **Rolling deployments** — Push the new application version to a subset of app servers while the old version remains on the rest, with both sets connecting to the same database.
- **PL/SQL-heavy applications** — EBR excels when the database contains substantial business logic in packages; independent package versioning is its primary strength.
- **Complex column renames or type changes** — The editioning view plus crossedition trigger pattern handles renames cleanly without application downtime.
- **Automated testing** — Deploy test versions of packages to a dedicated test edition without disturbing production sessions.

### Limitations

- **Tables, indexes, and sequences are not editionable.** Structural changes still demand careful forward-compatible design using the expand/contract pattern.
- **EBR cannot be applied to partitioning or storage changes.** Those require DBMS_REDEFINITION or offline DDL.
- **DDL complexity rises substantially.** Every object must be created under the correct edition. Missing edition context during deployment will place objects in the wrong edition, which is difficult to diagnose.
- **Connection pool management becomes critical.** Pools must be configured to specify the correct edition. Pools without an edition setting default to the database default edition, which may not be the intended one during a partial rollover.
- **An edition cannot be dropped while it has active sessions or contains objects exclusive to it.** Plan cleanup steps carefully.
- **Not all Oracle features accept editioned objects as dependencies.** Materialized views, for example, cannot reference editioned views.

---

## Best Practices

- **Treat editions as a linear chain, not a tree.** While Oracle supports branching edition trees, linear chains (v1 → v2 → v3) are far simpler to reason about and operate.
- **Always set edition context explicitly in deployment scripts.** Never depend on the session default. Start every deployment script with `ALTER SESSION SET EDITION = target_edition;` and confirm with `SELECT SYS_CONTEXT('USERENV', 'CURRENT_EDITION_NAME') FROM DUAL;`.
- **Limit the number of active editions (2–3 maximum).** Retaining more than one previous edition multiplies the complexity of crossedition triggers and deployment verification.
- **Automate edition creation and cleanup as pipeline stages.** Avoid manual DBA steps. Create, deploy, switch, and schedule retirement as coded pipeline stages.
- **Validate edition switching in staging using realistic connection pool behavior.** Bugs from connection pools using the wrong edition are subtle and typically surface only under load.
- **Record the current edition state in a deployment runbook.** Operators must know which edition is current, which is being retired, and which is in staging at all times.

---

## Common Mistakes

**Mistake: Creating objects without setting the edition context first.**
When a DBA runs `CREATE OR REPLACE VIEW CUSTOMERS AS ...` without first issuing `ALTER SESSION SET EDITION = v2`, the view is created in the current session edition, which may not be the intended one. Always confirm edition context before any DDL in an EBR deployment.

**Mistake: Forgetting that base-table triggers fire in ALL editions.**
Standard (non-crossedition) triggers on the base table are not edition-scoped — they fire regardless of which edition the session is using. Only crossedition triggers carry edition-specific semantics. Audit, logging, and constraint-enforcement triggers on base tables will observe DML from every edition.

**Mistake: Dropping columns before all old-edition sessions are retired.**
Removing the `FULL_NAME` column while V1 sessions remain active will immediately break those sessions. Always confirm that no active sessions are running in the old edition before dropping columns.

**Mistake: Applying editioning views to non-relational data access.**
EBR is built for relational, SQL-based object models. XML DB, Spatial, and other non-relational feature areas have limited or no EBR support.

**Mistake: Treating EBR as a general-purpose schema versioning tool.**
EBR handles concurrent code versions; it is not a replacement for schema migration tools like Liquibase or Flyway. The standard production approach uses both: Flyway/Liquibase for additive, forward-compatible base-table DDL changes, and EBR for PL/SQL and view versioning during hot rollovers.

---


## Oracle Version Notes (19c vs 26ai)

- The baseline guidance in this file applies to Oracle Database 19c unless a newer minimum version is explicitly noted.
- Features labeled as 21c, 23c, or 23ai are compatible with Oracle Database 26ai; retain 19c alternatives for mixed-version environments.
- In dual-support environments, validate syntax and package behavior across both 19c and 26ai, as defaults and deprecations may differ between release updates.

## Sources

- [Oracle Database Development Guide 19c — Using Edition-Based Redefinition](https://docs.oracle.com/en/database/oracle/oracle-database/19/adfns/editions.html) — EBR introduced in 11gR2; editionable types (SYNONYM, VIEW, PROCEDURE, FUNCTION, PACKAGE, TRIGGER, TYPE, LIBRARY, SQL Translation Profile); crossedition triggers; editioning views
- [Oracle Database SQL Language Reference 19c — CREATE EDITION](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-EDITION.html) — edition creation and hierarchy
- [Oracle Database Reference 19c — DBA_EDITIONS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_EDITIONS.html) — edition catalog view
