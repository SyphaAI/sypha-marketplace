# Online Operations in Oracle DB

## Overview

In production Oracle environments, DDL changes have traditionally required downtime: tables are locked, DML is blocked, and reads are prevented during structural modifications. Oracle provides a set of online operation features that keep the database available to application traffic while structural changes execute in the background. Understanding these features — and their constraints — is essential for zero-downtime deployments.

The key mechanisms are:

- **DBMS_REDEFINITION** — online restructuring of tables for complex changes (column reordering, type conversions, partitioning)
- **Online index operations** — building or rebuilding indexes without blocking DML
- **ALTER TABLE ... ONLINE** — adding columns and modifying constraints with reduced locking
- **Online segment shrink** — recovering space without taking tables offline

None of these apply universally — each carries prerequisites, limitations, and edge cases. This guide explains when and how to apply each, with concrete examples.

---

## DBMS_REDEFINITION

### What It Does

`DBMS_REDEFINITION` lets you restructure a table while it stays fully available for DML. The process works as follows:

1. An interim table is created with the new structure.
2. Synchronization begins — Oracle tracks DML on the original table via a materialized view log.
3. Existing rows are copied to the interim table in the background.
4. Incremental changes are periodically synchronized.
5. The redefinition is completed — Oracle atomically swaps the table names and drops the original.

Applications experience no interruption. The final swap acquires a brief exclusive lock (typically milliseconds) but causes no extended downtime.

### When to Use DBMS_REDEFINITION

Use it when you need to:

- Alter column data types (e.g., `VARCHAR2(100)` to `VARCHAR2(500)`, or `DATE` to `TIMESTAMP`)
- Reorder columns (to improve compression efficiency or application compatibility)
- Convert a heap-organized table to a partitioned table
- Apply or remove compression
- Relocate a table to a different tablespace without downtime
- Make structural changes to the logical layout that `ALTER TABLE` cannot accommodate

### Prerequisites

```sql
-- The table must have a primary key (or a unique key you specify as the key_column_list)
-- The schema owner needs EXECUTE on DBMS_REDEFINITION
-- The process requires roughly 1x the table size in additional storage during the operation

-- Verify the table can be redefined
BEGIN
  DBMS_REDEFINITION.CAN_REDEF_TABLE(
    uname        => 'APP_OWNER',
    tname        => 'ORDERS',
    options_flag => DBMS_REDEFINITION.CONS_USE_PK  -- or CONS_USE_ROWID
  );
END;
/
-- If no exception is raised, the table is eligible
```

### Full Example: Converting Heap Table to Range-Partitioned

```sql
-- Step 1: Create the interim table with the new structure
-- The column names and types must be compatible with the original
-- Additional columns in the interim table will start as NULL

CREATE TABLE ORDERS_NEW (
    ORDER_ID     NUMBER(18,0)  NOT NULL,
    CUSTOMER_ID  NUMBER(18,0)  NOT NULL,
    ORDER_DATE   DATE          NOT NULL,
    STATUS_CODE  VARCHAR2(10)  NOT NULL,
    TOTAL_AMOUNT NUMBER(12,4),
    CREATED_AT   TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ORDERS_NEW PRIMARY KEY (ORDER_ID, ORDER_DATE)
)
PARTITION BY RANGE (ORDER_DATE)
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(
  PARTITION P_BEFORE_2024 VALUES LESS THAN (DATE '2024-01-01')
    TABLESPACE DATA_TS
);
```

```sql
-- Step 2: Start the redefinition
-- This creates the materialized view log on ORDERS and begins the copy
BEGIN
  DBMS_REDEFINITION.START_REDEF_TABLE(
    uname        => 'APP_OWNER',
    orig_table   => 'ORDERS',
    int_table    => 'ORDERS_NEW',
    col_mapping  => 'ORDER_ID ORDER_ID, CUSTOMER_ID CUSTOMER_ID, ' ||
                    'ORDER_DATE ORDER_DATE, STATUS_CODE STATUS_CODE, ' ||
                    'TOTAL_AMOUNT TOTAL_AMOUNT, SYSTIMESTAMP CREATED_AT',
    options_flag => DBMS_REDEFINITION.CONS_USE_PK
  );
END;
/
```

```sql
-- Step 3: Synchronize incrementally (run one or more times during the copy)
-- This applies DML that occurred since the last sync, reducing final cutover time
BEGIN
  DBMS_REDEFINITION.SYNC_INTERIM_TABLE(
    uname      => 'APP_OWNER',
    orig_table => 'ORDERS',
    int_table  => 'ORDERS_NEW'
  );
END;
/
```

```sql
-- Step 4: Copy dependent objects to the interim table
-- Constraints, indexes, triggers, grants on the interim table become
-- the constraints/indexes/triggers/grants of the final table after swap
DECLARE
  v_num_errors PLS_INTEGER;
BEGIN
  DBMS_REDEFINITION.COPY_TABLE_DEPENDENTS(
    uname            => 'APP_OWNER',
    orig_table       => 'ORDERS',
    int_table        => 'ORDERS_NEW',
    copy_indexes     => DBMS_REDEFINITION.CONS_ORIG_PARAMS,
    copy_triggers    => TRUE,
    copy_constraints => TRUE,
    copy_privileges  => TRUE,
    ignore_errors    => FALSE,
    num_errors       => v_num_errors
  );
  IF v_num_errors > 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'COPY_TABLE_DEPENDENTS had errors: ' || v_num_errors);
  END IF;
END;
/
```

```sql
-- Step 5: Final synchronization and atomic swap
-- The original ORDERS table is renamed to ORDERS_OLD (or dropped)
-- ORDERS_NEW becomes ORDERS
BEGIN
  DBMS_REDEFINITION.FINISH_REDEF_TABLE(
    uname        => 'APP_OWNER',
    orig_table   => 'ORDERS',
    int_table    => 'ORDERS_NEW'
  );
END;
/
```

```sql
-- Step 6: Cleanup
-- After verifying the new table is correct, drop the old interim
-- (Oracle renamed ORDERS_NEW to ORDERS and ORDERS to ORDERS_NEW)
DROP TABLE ORDERS_NEW PURGE;
```

### Error Recovery

If the redefinition needs to be aborted at any point:

```sql
BEGIN
  DBMS_REDEFINITION.ABORT_REDEF_TABLE(
    uname      => 'APP_OWNER',
    orig_table => 'ORDERS',
    int_table  => 'ORDERS_NEW'
  );
END;
/

-- Then drop the interim table
DROP TABLE ORDERS_NEW PURGE;
```

### Monitoring Progress

```sql
-- Monitor the background copy via MV log and long operations
SELECT
    SID,
    SERIAL#,
    OPNAME,
    SOFAR,
    TOTALWORK,
    ROUND(SOFAR / NULLIF(TOTALWORK, 0) * 100, 1) AS PCT_COMPLETE,
    TIME_REMAINING                                AS SECS_REMAINING
FROM
    V$SESSION_LONGOPS
WHERE
    OPNAME LIKE '%redefinition%'
    OR OPNAME LIKE '%Table Redefinition%';
```

---

## Online Index Rebuild

### Why Rebuild Indexes?

Indexes develop structural inefficiencies over time: deleted entries leave empty leaf blocks, heavy DML on monotonically increasing keys produces right-side imbalance (index blowout), and data movement during updates degrades the clustering factor. Rebuilding corrects these problems without taking the table offline.

### REBUILD ONLINE vs REBUILD

```sql
-- Offline rebuild: table DML is blocked during rebuild
ALTER INDEX IDX_ORDERS_CUSTOMER REBUILD;

-- Online rebuild: DML continues, uses a journal table to track changes
-- Takes longer, more I/O, but does not block application
ALTER INDEX IDX_ORDERS_CUSTOMER REBUILD ONLINE;
```

```sql
-- Rebuild with specific storage options
ALTER INDEX IDX_ORDERS_CUSTOMER
REBUILD ONLINE
TABLESPACE IDX_TS
PARALLEL 4
COMPUTE STATISTICS;
```

```sql
-- Rebuild a partition of a partitioned index
ALTER INDEX IDX_ORDERS_DATE
REBUILD PARTITION P_2024_Q1 ONLINE;
```

### Monitoring Index Health Before Deciding to Rebuild

```sql
-- Analyze index structure
ANALYZE INDEX IDX_ORDERS_CUSTOMER VALIDATE STRUCTURE;

SELECT
    NAME,
    HEIGHT,
    BLOCKS,
    LF_ROWS,
    LF_BLKS,
    LF_ROWS_LEN,
    DEL_LF_ROWS,
    DEL_LF_ROWS_LEN,
    ROUND(DEL_LF_ROWS / NULLIF(LF_ROWS, 0) * 100, 2) AS PCT_DELETED
FROM
    INDEX_STATS;
-- If PCT_DELETED > 20% or HEIGHT > 4 for a B-tree, consider rebuilding
```

```sql
-- Coalesce (cheaper than rebuild — merges leaf blocks without sorting)
-- Does not reduce height, does not move to new tablespace
ALTER INDEX IDX_ORDERS_CUSTOMER COALESCE;
```

---

## Online Index Creation

Online index creation lets DML continue on the table throughout the build process. This is the standard method for adding new indexes to large production tables.

```sql
-- Standard online index creation
CREATE INDEX IDX_ORDERS_STATUS
    ON ORDERS (STATUS_CODE, ORDER_DATE)
    ONLINE
    TABLESPACE IDX_TS
    PARALLEL 4
    COMPUTE STATISTICS
    NOLOGGING;   -- Reduces redo generation; requires full backup after creation

-- After creation, reset to logging for ongoing maintenance
ALTER INDEX IDX_ORDERS_STATUS LOGGING;
```

```sql
-- Unique index online creation
CREATE UNIQUE INDEX IDX_ORDERS_REF_NUM
    ON ORDERS (REFERENCE_NUMBER)
    ONLINE
    TABLESPACE IDX_TS;
```

```sql
-- Function-based index online
CREATE INDEX IDX_CUST_EMAIL_UPPER
    ON CUSTOMERS (UPPER(EMAIL))
    ONLINE
    TABLESPACE IDX_TS;
```

### Online Index Limitations

- **Bitmap indexes cannot be created or rebuilt online.** They are unsuitable for OLTP tables with concurrent DML regardless, since they lock at the bitmap segment level.
- **Secondary indexes on IOT (Index-Organized Table)** cannot always be rebuilt online.
- **Unusable partitioned index partitions** require an offline rebuild when the partition is `UNUSABLE`.
- Online operations consume more undo and temporary space than their offline counterparts.

---

## ALTER TABLE ... ONLINE

Oracle 12c added `ONLINE` clause support for several `ALTER TABLE` operations, reducing lock contention.

### Adding Columns

```sql
-- Pre-12c: Adding a NOT NULL column with DEFAULT required a full table scan
-- and a row-by-row update, causing extended locks

-- 12c+: Adding NOT NULL with DEFAULT is metadata-only — instantaneous
ALTER TABLE ORDERS
ADD (LAST_MODIFIED TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL);
-- Oracle stores the default in the data dictionary; existing rows get the
-- default value at read time without a physical update

-- Explicitly mark the operation as online (no-op in 12c+ for this case, but explicit)
ALTER TABLE ORDERS ADD (AUDIT_USER VARCHAR2(100)) ONLINE;
```

### Modifying Column Definitions

```sql
-- Increase VARCHAR2 column width (always safe, no data conversion)
ALTER TABLE CUSTOMERS MODIFY (EMAIL VARCHAR2(320)) ONLINE;

-- Add a DEFAULT to an existing nullable column
ALTER TABLE ORDERS MODIFY (NOTES VARCHAR2(4000) DEFAULT 'N/A') ONLINE;
```

### Setting Columns Unused

Instead of dropping a column immediately (which rewrites every row), mark it unused first. The column instantly becomes invisible to the application, and the physical space is reclaimed at a later time.

```sql
-- Step 1: Make the column invisible to the application (instant)
ALTER TABLE ORDERS SET UNUSED COLUMN LEGACY_REF_NUM;

-- Step 2: Reclaim space during a maintenance window or low-traffic period
ALTER TABLE ORDERS DROP UNUSED COLUMNS;

-- Check for unused columns
SELECT TABLE_NAME, COUNT(*) AS UNUSED_COLS
FROM   USER_UNUSED_COL_TABS
GROUP BY TABLE_NAME;
```

### Online Constraint Operations

```sql
-- Enable a disabled constraint without validating existing rows (fast, no lock)
ALTER TABLE ORDERS
ENABLE NOVALIDATE CONSTRAINT FK_ORDERS_CUSTOMER;

-- After verifying data quality, enable with full validation
-- (Does not prevent DML during the validation scan)
ALTER TABLE ORDERS
ENABLE VALIDATE CONSTRAINT FK_ORDERS_CUSTOMER;

-- Add a check constraint that is not validated (future rows only)
ALTER TABLE ORDERS
ADD CONSTRAINT CHK_STATUS CHECK (STATUS_CODE IN ('PENDING','PROCESSING','SHIPPED','CLOSED'))
ENABLE NOVALIDATE;
```

---

## Online Segment Shrink

Shrink recovers space within a table segment that was freed by row deletions, without relocating the table or incurring downtime.

```sql
-- Step 1: Enable row movement (rows may change ROWID during shrink)
ALTER TABLE ORDERS ENABLE ROW MOVEMENT;

-- Step 2: Compact rows (moves rows, frees space inside blocks; no HWM change yet)
ALTER TABLE ORDERS SHRINK SPACE COMPACT;
-- At this point DML is not blocked; rows are shifted within the segment

-- Step 3: Adjust High Water Mark (brief exclusive lock, very fast)
ALTER TABLE ORDERS SHRINK SPACE;

-- Alternative: do both steps at once (compact + HWM adjustment)
ALTER TABLE ORDERS SHRINK SPACE CASCADE;
-- CASCADE also shrinks all dependent indexes

-- After shrinking, disable row movement to re-lock ROWIDs
ALTER TABLE ORDERS DISABLE ROW MOVEMENT;
```

```sql
-- Monitor fragmentation before deciding to shrink
SELECT
    SEGMENT_NAME,
    BLOCKS,
    EMPTY_BLOCKS,
    NUM_ROWS,
    AVG_ROW_LEN,
    ROUND((BLOCKS * 8192) / 1024 / 1024, 2)          AS TOTAL_MB,
    ROUND((NUM_ROWS * AVG_ROW_LEN) / 1024 / 1024, 2)  AS DATA_MB
FROM
    USER_TABLES
WHERE
    SEGMENT_NAME = 'ORDERS';
```

---

## Minimizing Downtime: Strategy Summary

### Additive Changes (Zero Downtime)

These changes can always be applied while the application is running:

- Adding nullable columns (`ALTER TABLE ADD`)
- Adding NOT NULL columns that carry a DEFAULT value (12c+)
- Creating new indexes (`CREATE INDEX ... ONLINE`)
- Creating new tables, sequences, or synonyms
- Adding constraints with `ENABLE NOVALIDATE`
- Creating or replacing views, packages, and procedures (when semantically compatible)

### Destructive or Risky Changes (Require Planning)

These changes require careful ordering or phased deployment:

| Change | Risk | Mitigation |
|---|---|---|
| Dropping a column | Application may still reference it | Set UNUSED first; drop in next release |
| Renaming a column | Immediate application breakage | Add new column, migrate data, switch app, drop old |
| Changing column type | May block or fail on large tables | Use DBMS_REDEFINITION |
| Dropping/truncating a table | Immediate loss | Rename first; drop after application is updated |
| Converting heap to partitioned | Cannot do with ALTER TABLE | Use DBMS_REDEFINITION |

### The Expand/Contract Pattern

The safest strategy for any non-additive change in a zero-downtime system is the expand/contract (or parallel change) pattern:

1. **Expand** — Introduce the new structure (column, table, index) alongside the existing one and write to both.
2. **Migrate** — Backfill existing data into the new structure and verify consistency.
3. **Contract** — Remove the old structure once all application versions that reference it have been retired.

---

## Best Practices

- **Always call `DBMS_REDEFINITION.CAN_REDEF_TABLE` before starting a redefinition.** A failure partway through on a large table is harder to recover from than not starting at all.
- **Track `V$SESSION_LONGOPS`** throughout online operations. These can run for hours on large tables; visibility into progress is essential.
- **Budget for temporary space.** Online index builds and DBMS_REDEFINITION need extra storage: roughly 1x the original index size for an online rebuild, and roughly 1x the table size for a full redefinition.
- **Run rebuilds with `PARALLEL` during low-traffic periods.** Even though online operations don't block DML, high-parallelism rebuilds place substantial demand on I/O bandwidth. Reset to `NOPARALLEL` after the operation completes.
- **Use `NOLOGGING` for initial index builds, then switch to `LOGGING` for ongoing maintenance.** `NOLOGGING` greatly reduces redo generation but requires a backup immediately afterward.
- **Test online operations in a non-production environment first.** Edge cases such as LOB columns, domain indexes, and spatial indexes can block online operations from completing.

---

## Common Mistakes

**Mistake: Treating online as synonymous with instantaneous.**
Online operations do not block application DML, but they still require significant time, I/O, and temp space. Redefining a 500 GB table may take hours. Plan for this and monitor progress throughout.

**Mistake: Skipping synchronization before FINISH_REDEF_TABLE.**
The final swap includes a synchronization step, but running `SYNC_INTERIM_TABLE` several times beforehand shortens the exclusive lock window during cutover. Perform multiple manual syncs in the hours leading up to the planned cutover.

**Mistake: Attempting REBUILD ONLINE on bitmap indexes.**
Oracle raises `ORA-08106`. Bitmap indexes cannot be created or rebuilt online and must be rebuilt offline during a maintenance window.

**Mistake: Leaving ROW MOVEMENT enabled after a shrink.**
Keeping `ROW MOVEMENT ENABLED` permanently means ROWIDs are unstable. Any application or tool that caches ROWIDs for fast lookups will retrieve incorrect rows following a shrink.

**Mistake: Depending on SET UNUSED for data security.**
`SET UNUSED COLUMN` hides the column from regular SQL but leaves its data intact on disk. For sensitive information (PII, credentials), issue a DELETE or UPDATE to nullify the column values before marking it unused.

---


## Oracle Version Notes (19c vs 26ai)

- The baseline guidance in this file applies to Oracle Database 19c unless a newer minimum version is explicitly stated.
- Features noted as 21c, 23c, or 23ai are compatible with Oracle Database 26ai; keep 19c-compatible alternatives available for mixed-version environments.
- In dual-support environments, verify syntax and package behavior in both 19c and 26ai, as defaults and deprecations can vary between release updates.

## Sources

- [DBMS_REDEFINITION (19c)](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_REDEFINITION.html) — START_REDEF_TABLE, FINISH_REDEF_TABLE, ABORT_REDEF_TABLE, SYNC_INTERIM_TABLE, COPY_TABLE_DEPENDENTS, CAN_REDEF_TABLE parameters and constants
- [Oracle Database Administrator's Guide 19c — Online Operations](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-tables.html) — ALTER TABLE ONLINE, shrink, unused columns
- [Oracle Database SQL Language Reference 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/) — CREATE INDEX ONLINE, REBUILD ONLINE, ALTER TABLE SET UNUSED
