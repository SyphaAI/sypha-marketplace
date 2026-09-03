# Oracle Tablespace Design

## Overview

A **tablespace** is Oracle's logical storage unit — a named collection of one or more data files that serves as the fundamental element of allocation, administration, and backup. Every Oracle object (table, index, cluster, LOB) belongs to a tablespace. Careful tablespace design:

- Distributes I/O across storage devices according to workload type
- Streamlines backup and recovery through tablespace-level RMAN backups
- Governs space growth and allocation behavior
- Allows object groups to be transported or taken offline independently
- Ensures data files do not compete with each other during expansion

This guide addresses tablespace types, sizing approaches, the ASSM vs MSSM decision, and a recommended multi-tablespace layout for production Oracle databases.

---

## 1. Tablespace Types

### Permanent Tablespaces

Hold persistent database objects: tables, indexes, views (their segments), clusters, LOBs. Most tablespace design work centers on permanent tablespaces.

### Temporary Tablespaces

Hold session-level temporary segments: sort runs, hash join work areas, global temporary table data, and temporary LOBs. Temporary tablespaces require no backup — they are always reconstructed when the database is created or recreated.

```sql
-- Create a dedicated temporary tablespace
CREATE TEMPORARY TABLESPACE temp_01
    TEMPFILE '/u02/oradata/ORCL/temp01.dbf' SIZE 2G AUTOEXTEND ON NEXT 512M MAXSIZE 20G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 1M;

-- Assign as default temporary tablespace
ALTER DATABASE DEFAULT TEMPORARY TABLESPACE temp_01;

-- Temporary tablespace groups (multiple temp tablespaces per group for parallel query)
CREATE TABLESPACE GROUP temp_group;
ALTER TABLESPACE temp_01 TABLESPACE GROUP temp_group;
ALTER TABLESPACE temp_02 TABLESPACE GROUP temp_group;
ALTER DATABASE DEFAULT TEMPORARY TABLESPACE temp_group;
```

### Undo Tablespace

Contains undo segments that support transaction rollback, read consistency, and Oracle Flashback features. Oracle manages this automatically (AUM — Automatic Undo Management) when `UNDO_MANAGEMENT = AUTO`.

```sql
CREATE UNDO TABLESPACE undo_01
    DATAFILE '/u02/oradata/ORCL/undo01.dbf' SIZE 4G AUTOEXTEND ON NEXT 1G MAXSIZE 50G;

ALTER SYSTEM SET UNDO_TABLESPACE = undo_01;
ALTER SYSTEM SET UNDO_RETENTION = 900;  -- 15 minutes (in seconds)
```

Undo sizing rule of thumb:

```
Undo Size (bytes) = UNDO_RETENTION (seconds) x (DB block size x blocks changed per second)
                  = UNDO_RETENTION x (SELECT value FROM v$parameter WHERE name='db_block_size')
                    x (SELECT undoblks/((last_analyzed - first_analyzed)*86400) FROM v$undostat)
```

---

## 2. Bigfile vs Smallfile Tablespaces

### Smallfile Tablespaces (Classic, Default)

- Support up to **1022 data files** per tablespace
- Each data file can reach **4 million blocks** (32 GB with 8K blocks, 128 GB with 32K blocks)
- Maximum tablespace size: **~32 PB** (1022 files x 32 TB each with 32K blocks)
- File numbers are a shared, limited database-wide resource (max 65534 files per database)
- Granular backup: individual files can be backed up separately

```sql
CREATE TABLESPACE users_data
    DATAFILE '/u01/oradata/ORCL/users_data01.dbf' SIZE 2G
             AUTOEXTEND ON NEXT 256M MAXSIZE 32G,
            '/u01/oradata/ORCL/users_data02.dbf' SIZE 2G
             AUTOEXTEND ON NEXT 256M MAXSIZE 32G
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE
    SEGMENT SPACE MANAGEMENT AUTO;
```

### Bigfile Tablespaces (10g+)

- Contain exactly **1 data file** per tablespace
- Data file can reach **4 billion blocks** (32 TB with 8K blocks, up to 128 TB with 32K blocks)
- Consume only 1 file number per tablespace
- Offer simpler management for very large tablespaces
- RMAN backup of a bigfile tablespace may need default setting adjustments to guarantee I/O parallelism
- Mandatory for Oracle Managed Files (OMF) in certain storage configurations

```sql
CREATE BIGFILE TABLESPACE dw_facts_data
    DATAFILE '/u03/oradata/ORCL/dw_facts_data01.dbf' SIZE 100G
    AUTOEXTEND ON NEXT 10G MAXSIZE 10T
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE
    SEGMENT SPACE MANAGEMENT AUTO;

-- Resize a bigfile tablespace (can resize the single file directly through tablespace)
ALTER TABLESPACE dw_facts_data RESIZE 200G;  -- only valid for bigfile tablespaces
```

### Bigfile vs Smallfile Decision Guide

| Factor | Smallfile | Bigfile |
|---|---|---|
| Number of files | Up to 1022 per TS | Exactly 1 per TS |
| Individual file size | Up to ~128 TB | Up to ~128 TB |
| File number consumption | Multiple files per TS | 1 file per TS |
| Management simplicity | More files to track | Simpler (1 file) |
| Best for | OLTP, medium-size tables, flexibility | Huge DW fact tables, ASM environments |
| ASM compatibility | Both work | Preferred on ASM (ASM handles striping) |

---

## 3. Extent Management

Extents are contiguous sequences of Oracle blocks assigned to a segment. Extent management governs how Oracle tracks and distributes extents within a tablespace.

### Locally Managed Tablespaces (LMT) — Always Use This

Oracle tracks extent allocation using a bitmap embedded in the tablespace's own data files rather than in the SYSTEM tablespace's data dictionary. This eliminates data dictionary contention and has been the default for all tablespaces since Oracle 9i.

```sql
-- Uniform extent size: all extents the same size
CREATE TABLESPACE dw_idx
    DATAFILE '/u02/oradata/ORCL/dw_idx01.dbf' SIZE 10G AUTOEXTEND ON NEXT 1G MAXSIZE 100G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 8M;  -- every extent is exactly 8M

-- Autoallocate: Oracle chooses extent sizes (64K -> 1M -> 8M -> 64M...)
CREATE TABLESPACE users_data
    DATAFILE '/u01/oradata/ORCL/users_data01.dbf' SIZE 4G AUTOEXTEND ON NEXT 512M MAXSIZE 50G
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE;
```

Autoallocate is generally adequate for all workloads unless there are specific niche requirements for a fixed uniform extent size.

**Uniform size guidelines:**

| Object Type | Recommended Uniform Size |
|---|---|
| OLTP data | 1M or autoallocate |
| OLTP indexes | 1M or autoallocate |
| DW fact tables | 8M–32M |
| DW dimension tables | 1M–4M |
| LOB segments | 8M–64M |
| Undo | 1M or autoallocate |
| Temporary | 1M |

### Dictionary Managed Tablespaces (DMT) — Legacy, Avoid

Oracle tracks extent allocation in SYSTEM tablespace data dictionary tables, causing severe contention on `UET$` and `FET$` tables. All new tablespaces must be locally managed instead.

---

## 4. Segment Space Management: ASSM vs MSSM

Segment space management determines how Oracle monitors free space **within** the individual database blocks of a segment, specifically which blocks have capacity for new row inserts.

### Automatic Segment Space Management (ASSM)

Employs a multi-level bitmap embedded within the segment to track block free space. ASSM has been the default since Oracle 9i and is the right choice in nearly all situations.

```sql
CREATE TABLESPACE users_data
    DATAFILE '/u01/oradata/ORCL/users_data01.dbf' SIZE 4G
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE
    SEGMENT SPACE MANAGEMENT AUTO;  -- ASSM (default, recommended)
```

**ASSM advantages:**
- Removes "freelist" contention on tables with high-concurrency inserts
- `PCTUSED` parameter is disregarded (Oracle handles it automatically)
- Enables `SHRINK SPACE` and online segment reorganization
- Mandatory for Oracle In-Memory, Advanced Compression, and several other features

### Manual Segment Space Management (MSSM)

Relies on **freelists** — linked lists of blocks that have available space — to identify insertable blocks. Each segment supports a configurable number of freelists (`FREELIST GROUPS`).

```sql
CREATE TABLESPACE legacy_data
    DATAFILE '/u01/oradata/ORCL/legacy01.dbf' SIZE 1G
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE
    SEGMENT SPACE MANAGEMENT MANUAL;  -- MSSM (legacy)

-- With MSSM, PCTUSED and FREELISTS matter:
CREATE TABLE LEGACY_TABLE (
    id   NUMBER,
    data VARCHAR2(100)
)
TABLESPACE legacy_data
PCTFREE   10  -- 10% reserved for updates
PCTUSED   60  -- block re-added to freelist when used% drops below 60%
STORAGE (FREELISTS 4 FREELIST GROUPS 2);  -- 4 freelists, 2 freelist groups (RAC)
```

**Situations where MSSM may still appear:**
- Legacy databases migrated from Oracle 8i/9i
- Particular third-party applications with a dependency on MSSM behavior
- Temporary tablespaces (which always use MSSM internally for sort segments)

### ASSM vs MSSM Comparison

| Feature | ASSM | MSSM |
|---|---|---|
| Concurrency | Excellent (bitmap, no contention) | Can contend on freelists |
| PCTUSED | Ignored | Active parameter |
| PCTFREE | Honored | Honored |
| SHRINK SPACE | Supported | Not supported |
| Advanced Compression | Supported | Not supported |
| In-Memory | Supported | Not supported |
| Block utilization visibility | `DBMS_SPACE.SPACE_USAGE` | `DBMS_SPACE.FREE_BLOCKS` |
| Recommended | Yes (all new work) | No (legacy only) |

---

## 5. Recommended Multi-Tablespace Production Layout

A production Oracle database that is well structured separates objects according to their I/O profile, growth rate, and recoverability requirements. The layout below addresses both OLTP and data warehouse workloads.

### OLTP Production Layout

```sql
-- ============================================================
-- SYSTEM and SYSAUX: managed by Oracle — never put user objects here
-- ============================================================

-- ============================================================
-- UNDO: one per database instance (two for RAC: undo_01, undo_02)
-- ============================================================
CREATE UNDO TABLESPACE undo_01
    DATAFILE '/u02/oradata/ORCL/undo_01_01.dbf' SIZE 8G
             AUTOEXTEND ON NEXT 1G MAXSIZE 100G
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE;

-- ============================================================
-- TEMP: one per database (or temp group for RAC/parallel query)
-- ============================================================
CREATE TEMPORARY TABLESPACE temp_01
    TEMPFILE '/u02/oradata/ORCL/temp_01_01.dbf' SIZE 4G
             AUTOEXTEND ON NEXT 512M MAXSIZE 50G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 1M;

ALTER DATABASE DEFAULT TEMPORARY TABLESPACE temp_01;

-- ============================================================
-- APPLICATION DATA: one tablespace per schema or application module
-- Split high-churn tables into separate tablespaces for targeted backup
-- ============================================================
CREATE TABLESPACE app_data
    DATAFILE '/u03/oradata/ORCL/app_data_01.dbf' SIZE 10G
             AUTOEXTEND ON NEXT 1G MAXSIZE 500G,
            '/u03/oradata/ORCL/app_data_02.dbf' SIZE 10G
             AUTOEXTEND ON NEXT 1G MAXSIZE 500G
    EXTENT MANAGEMENT LOCAL AUTOALLOCATE
    SEGMENT SPACE MANAGEMENT AUTO;

--
-- If you expect the need to do significant maintenance on LOBs, then
-- optionally dedicate a separate tablespace for them. Usually not required.
--
-- Large object (LOB) tablespace — separate from row data
CREATE TABLESPACE app_lob
    DATAFILE '/u04/oradata/ORCL/app_lob_01.dbf' SIZE 20G
             AUTOEXTEND ON NEXT 2G MAXSIZE 1T
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 8M  -- uniform for LOB efficiency
    SEGMENT SPACE MANAGEMENT AUTO;

-- ============================================================
-- READ-ONLY: historical/archive data that never changes
-- ============================================================
CREATE TABLESPACE app_archive
    DATAFILE '/u06/oradata/ORCL/app_archive_01.dbf' SIZE 50G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 8M
    SEGMENT SPACE MANAGEMENT AUTO;
-- After loading archive data:
ALTER TABLESPACE app_archive READ ONLY;  -- prevents accidental modification + skips recovery
```

### Data Warehouse Layout

```sql
-- ============================================================
-- DW DATA: separate tablespaces for facts vs dimensions
-- ============================================================
CREATE BIGFILE TABLESPACE dw_fact_data
    DATAFILE '/u07/oradata/ORCL/dw_fact_data_01.dbf' SIZE 200G
             AUTOEXTEND ON NEXT 20G MAXSIZE 10T
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 32M  -- large uniform for large fact segments
    SEGMENT SPACE MANAGEMENT AUTO;

CREATE TABLESPACE dw_dim_data
    DATAFILE '/u07/oradata/ORCL/dw_dim_data_01.dbf' SIZE 10G
             AUTOEXTEND ON NEXT 1G MAXSIZE 100G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 4M
    SEGMENT SPACE MANAGEMENT AUTO;

-- ============================================================
-- DW INDEXES: bitmap and B-tree indexes on DW tables
-- ============================================================
CREATE TABLESPACE dw_idx
    DATAFILE '/u08/oradata/ORCL/dw_idx_01.dbf' SIZE 20G
             AUTOEXTEND ON NEXT 2G MAXSIZE 500G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 8M
    SEGMENT SPACE MANAGEMENT AUTO;

-- ============================================================
-- STAGING: ETL staging area — NOT backed up (can be recreated)
-- ============================================================
CREATE TABLESPACE etl_stage
    DATAFILE '/u09/oradata/ORCL/etl_stage_01.dbf' SIZE 50G
             AUTOEXTEND ON NEXT 5G MAXSIZE 1T
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 16M
    SEGMENT SPACE MANAGEMENT AUTO;

-- ============================================================
-- DW TEMP: separate large temp tablespace for analytic queries
-- ============================================================
CREATE TEMPORARY TABLESPACE dw_temp
    TEMPFILE '/u09/oradata/ORCL/dw_temp_01.dbf' SIZE 50G
             AUTOEXTEND ON NEXT 5G MAXSIZE 500G
    EXTENT MANAGEMENT LOCAL UNIFORM SIZE 1M;

-- Assign to DW schema users
ALTER USER dw_analyst_user  TEMPORARY TABLESPACE dw_temp;
ALTER USER etl_process_user TEMPORARY TABLESPACE dw_temp;
```

---

## 6. Tablespace Sizing

### Initial Sizing Strategy

Do not allocate a tablespace at its full expected maximum size from the start. Use `AUTOEXTEND` with a well-chosen `MAXSIZE` cap:

```sql
-- Good pattern: small initial, controlled autoextend, firm maximum
DATAFILE '/u01/oradata/ORCL/app_data_01.dbf'
    SIZE 1G                    -- initial size: allocate and format immediately
    AUTOEXTEND ON              -- allow growth
    NEXT 512M                  -- grow by 512M at a time
    MAXSIZE 100G               -- never exceed 100G per file
```

### Sizing Formulas

**Table segment size estimate:**

```sql
-- Estimate segment size before creation
-- DBMS_SPACE.CREATE_TABLE_COST is a PROCEDURE with OUT parameters, not a function.
-- It cannot be called in a SELECT statement; use a PL/SQL block or bind variables.
DECLARE
    v_used_bytes  NUMBER;
    v_alloc_bytes NUMBER;
BEGIN
    DBMS_SPACE.CREATE_TABLE_COST(
        tablespace_name => 'USERS_DATA',
        avg_row_size    => 250,      -- average bytes per row
        row_count       => 10000000, -- expected row count
        pct_free        => 10,
        used_bytes      => v_used_bytes,
        alloc_bytes     => v_alloc_bytes
    );
    DBMS_OUTPUT.PUT_LINE('Used bytes:  ' || v_used_bytes);
    DBMS_OUTPUT.PUT_LINE('Alloc bytes: ' || v_alloc_bytes);
END;
/
```

**Monitor existing tablespace usage:**

```sql
SELECT
    ts.tablespace_name,
    ts.block_size,
    ROUND(SUM(df.bytes)          / 1073741824, 2) AS total_gb,
    ROUND(SUM(fs.free_space)     / 1073741824, 2) AS free_gb,
    ROUND((1 - SUM(fs.free_space) / SUM(df.bytes)) * 100, 1) AS used_pct,
    ts.status,
    ts.contents,
    ts.extent_management,
    ts.segment_space_management
FROM
    dba_tablespaces ts
    JOIN dba_data_files df ON ts.tablespace_name = df.tablespace_name
    LEFT JOIN (
        SELECT tablespace_name, SUM(bytes) AS free_space
        FROM   dba_free_space
        GROUP  BY tablespace_name
    ) fs ON ts.tablespace_name = fs.tablespace_name
GROUP BY
    ts.tablespace_name, ts.block_size, ts.status, ts.contents,
    ts.extent_management, ts.segment_space_management
ORDER BY
    used_pct DESC NULLS LAST;
```

**Find top space consumers:**

```sql
SELECT
    owner,
    segment_name,
    segment_type,
    tablespace_name,
    ROUND(bytes / 1073741824, 3) AS size_gb
FROM
    dba_segments
WHERE
    tablespace_name NOT IN ('SYSTEM', 'SYSAUX')
ORDER BY
    bytes DESC
FETCH FIRST 20 ROWS ONLY;
```

---

## 7. Tablespace Maintenance

### Adding Data Files

```sql
-- Add a new data file to an existing tablespace
ALTER TABLESPACE app_data ADD DATAFILE
    '/u03/oradata/ORCL/app_data_03.dbf' SIZE 10G
    AUTOEXTEND ON NEXT 1G MAXSIZE 500G;
```

### Resizing Data Files

```sql
-- Resize a specific data file
ALTER DATABASE DATAFILE '/u03/oradata/ORCL/app_data_01.dbf' RESIZE 20G;

-- Resize with autoextend adjustment
ALTER DATABASE DATAFILE '/u03/oradata/ORCL/app_data_01.dbf'
    AUTOEXTEND ON NEXT 2G MAXSIZE 200G;
```

### Reclaiming Space — Segment Shrink

```sql
-- Enable row movement first (required for SHRINK)
ALTER TABLE APP_SCHEMA.LARGE_TABLE ENABLE ROW MOVEMENT;

-- Compact the segment and reset HWM (two-phase)
ALTER TABLE APP_SCHEMA.LARGE_TABLE SHRINK SPACE COMPACT;  -- phase 1: move rows online
ALTER TABLE APP_SCHEMA.LARGE_TABLE SHRINK SPACE;           -- phase 2: reset HWM

-- Or do both in one command (causes brief lock on HWM reset)
ALTER TABLE APP_SCHEMA.LARGE_TABLE SHRINK SPACE CASCADE;  -- shrink table + all indexes

-- After shrink, check for freed space
SELECT segment_name, segment_type, ROUND(bytes/1048576, 2) AS size_mb
FROM   dba_segments
WHERE  segment_name = 'LARGE_TABLE';
```

### Moving a Table to a Different Tablespace

```sql
-- Online table move (12c+, requires ENABLE ROW MOVEMENT)
ALTER TABLE APP_SCHEMA.ORDERS
    MOVE TABLESPACE new_tablespace
    ONLINE;

-- Offline move (classic — invalidates indexes, faster)
ALTER TABLE APP_SCHEMA.ORDERS MOVE TABLESPACE new_tablespace;

-- Rebuild invalidated indexes after offline move
SELECT 'ALTER INDEX ' || owner || '.' || index_name || ' REBUILD TABLESPACE app_idx;'
FROM   dba_indexes
WHERE  table_name = 'ORDERS'
AND    status = 'UNUSABLE';
```

---

## 8. Default Tablespace Assignment

```sql
-- Set schema-level defaults for new objects
ALTER USER app_owner
    DEFAULT   TABLESPACE app_data
    TEMPORARY TABLESPACE temp_01
    QUOTA UNLIMITED ON app_data
    QUOTA UNLIMITED ON app_idx
    QUOTA UNLIMITED ON app_lob;

-- Quota management
ALTER USER app_owner QUOTA 50G ON app_data;  -- restrict user to 50G
ALTER USER app_owner QUOTA 0   ON users;      -- prevent use of USERS tablespace

-- View user tablespace quotas
SELECT tablespace_name, bytes_used, max_bytes
FROM   dba_ts_quotas
WHERE  username = 'APP_OWNER';
```

---

## 9. Best Practices

- **Keep OLTP data separate from DW data.** Differing compression settings, extent sizes, and backup schedules make this separation essential.
- **Never place application objects in SYSTEM or SYSAUX.** Corruption or space exhaustion in SYSTEM will bring the entire database down.
- **Enforce a realistic MAXSIZE on AUTOEXTEND.** Unrestricted autoextend on a filesystem will exhaust the disk and crash the database. Set `MAXSIZE` to leave at least 20% filesystem headroom.
- **Assign LOB segments to a dedicated tablespace.** LOB segments expand independently of their row tables; isolating them avoids space contention and simplifies monitoring.
- **Use read-only tablespaces for historical archive data.** Read-only tablespaces require no backup after the final datafile checkpoint, significantly shrinking backup windows.
- **Proactively monitor tablespace usage.** Configure Oracle thresholds or custom alerts at 75% and 85% utilization — never wait for `ORA-01653: unable to extend table`.

```sql
-- Oracle Server-generated space alerts (built-in threshold management)
EXEC DBMS_SERVER_ALERT.SET_THRESHOLD(
    metrics_id        => DBMS_SERVER_ALERT.TABLESPACE_PCT_FULL,
    warning_operator  => DBMS_SERVER_ALERT.OPERATOR_GE,
    warning_value     => '75',
    critical_operator => DBMS_SERVER_ALERT.OPERATOR_GE,
    critical_value    => '90',
    observation_period => 1,
    consecutive_occurrences => 1,
    instance_name     => NULL,
    object_type       => DBMS_SERVER_ALERT.OBJECT_TYPE_TABLESPACE,
    object_name       => 'APP_DATA'
);
```

---

## 10. Common Mistakes and How to Avoid Them

### Mistake 1: Storing User Objects in SYSTEM or USERS

The default tablespace for new schemas is `USERS` unless overridden at creation time. Neither the `USERS` tablespace nor `SYSTEM` should ever hold application data.

```sql
-- Prevent this at user creation
CREATE USER app_owner IDENTIFIED BY "SecurePassword1!"
    DEFAULT TABLESPACE app_data
    TEMPORARY TABLESPACE temp_01;
-- Do NOT grant quota on SYSTEM or USERS
```

### Mistake 2: Unlimited AUTOEXTEND with No MAXSIZE

A single runaway query that generates excessive temp segment usage, or a bug that triggers an infinite insert loop, can exhaust the filesystem and bring down the entire database instance.

```sql
-- BAD
DATAFILE '/u01/oradata/ORCL/app_data_01.dbf' SIZE 1G AUTOEXTEND ON;

-- GOOD
DATAFILE '/u01/oradata/ORCL/app_data_01.dbf' SIZE 1G AUTOEXTEND ON NEXT 1G MAXSIZE 200G;
```

### Mistake 3: Using Dictionary Managed Tablespaces

DMT introduces serialization on `UET$` and `FET$` system tables. Every new tablespace must be locally managed. Existing DMT tablespaces should be migrated:

```sql
-- Migrate dictionary-managed tablespace to locally managed
EXEC DBMS_SPACE_ADMIN.TABLESPACE_MIGRATE_TO_LOCAL('OLD_DMT_TABLESPACE');
```

### Mistake 4: Using MSSM for New Tables on High-Concurrency Systems

MSSM freelist contention is a well-documented scalability bottleneck. New tablespaces must always use ASSM (`SEGMENT SPACE MANAGEMENT AUTO`).

### Mistake 5: Undersizing the Undo Tablespace

An undersized undo tablespace triggers `ORA-01555: snapshot too old` errors for long-running queries and prevents Flashback Query from covering the intended retention window. Base undo sizing on the longest anticipated transaction and the `UNDO_RETENTION` value.

---

## 11. Oracle Version Notes (19c vs 26ai)

- The baseline guidance in this file applies to Oracle Database 19c unless a newer minimum version is explicitly specified.
- Features from 21c/23c generations are compatible with Oracle Database 26ai; retain 19c alternatives for mixed-version environments.
- Verify defaults and behavior at your specific RU level when operating both 19c and 26ai.

| Feature | Version |
|---|---|
| Locally Managed Tablespaces default | 9i |
| ASSM default | 9i |
| Bigfile Tablespaces | 10g |
| Online Segment Shrink | 10g |
| Undo Advisor (DBMS_UNDO_ADV) | 10g |
| Tablespace Encryption (TDE) | 10g R2 |
| Online Table Move | 12c R2 (12.2) |
| Online Tablespace Migration to LMT | 10g |
| Automatic Bigfile Tablespace default (Autonomous DB) | 19c (ADB) |
| In-Memory tablespace (IM_IMCU_POOL) | 12c |

---

## Sources

- [Oracle Database 23ai Administrator's Guide — Managing Tablespaces](https://docs.oracle.com/en/database/oracle/oracle-database/23/admin/managing-tablespaces.html)
- [Oracle Database 23ai Concepts — Logical Storage Structures](https://docs.oracle.com/en/database/oracle/oracle-database/23/cncpt/logical-storage-structures.html)
- [Oracle Database 19c Administrator's Guide — Managing Tablespaces](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-tablespaces.html)
- [Oracle Database 23ai PL/SQL Packages and Types Reference — DBMS_SPACE](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_SPACE.html)
- [Oracle Database 19c PL/SQL Packages and Types Reference — DBMS_SERVER_ALERT](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SERVER_ALERT.html)
- [Oracle Bigfile Tablespace (oracle-faq.com)](https://www.orafaq.com/wiki/Bigfile_tablespace)
- [Oracle Database 12c R2 — Online Table Move (oracle-base.com)](https://oracle-base.com/articles/12c/online-move-table-12cr2)
- [Oracle ALTER TABLE SHRINK SPACE — Online Segment Shrink (oracle-base.com)](https://oracle-base.com/articles/misc/alter-table-shrink-space-online)
