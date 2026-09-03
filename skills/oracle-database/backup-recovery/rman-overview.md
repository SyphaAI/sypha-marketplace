# Oracle RMAN Backup and Recovery

## Overview

Recovery Manager (RMAN) is Oracle's principal tool for database backup, restore, and recovery. It delivers block-level backup integrity checking, compression, encryption, incremental backups, and deep integration with the Oracle database engine. RMAN removes the need for manual backup scripting and guarantees consistent backups even when the database is open.

For any Oracle DBA, backup and recovery is the single most critical competency. A database that cannot be recovered is a database that cannot be relied upon.

---

## RMAN Architecture

### Core Components

**RMAN Executable**
The `rman` binary that connects to the target database and optionally to a recovery catalog. It interprets RMAN commands, communicates with the target database server processes, and manages backup metadata.

**Target Database**
The database being backed up or recovered. RMAN connects through a dedicated server process and reads backup metadata from the control file or recovery catalog.

**Recovery Catalog**
An optional but recommended separate Oracle schema that stores RMAN metadata including backup history, datafile information, and archived log history. Without a catalog, metadata resides only in the target's control file. A catalog enables cross-database reporting, stored scripts, and longer retention of backup history than the control file can provide.

**Media Management Layer (MML)**
An optional third-party interface (e.g., Oracle Secure Backup, Veritas NetBackup, Commvault) that allows RMAN to write backups directly to tape libraries. RMAN communicates with the MML using the SBT (System Backup to Tape) channel type.

**Channels**
Channels are server processes that carry out the actual I/O. Each channel maps to one backup stream. RMAN supports automatic channels configured via `CONFIGURE`, or manually allocated channels within a `RUN` block.

```
RMAN Architecture:
┌─────────────┐       ┌──────────────────────┐
│  RMAN Client│──────▶│  Target Database      │
│  (rman exe) │       │  (server process)     │
└─────────────┘       │  reads: control file  │
        │             └──────────────────────┘
        │                        │
        ▼                        ▼
┌──────────────────┐    ┌─────────────────────┐
│ Recovery Catalog │    │   Backup Pieces /    │
│ (separate DB)    │    │   Image Copies on    │
│ RMAN schema      │    │   Disk or Tape       │
└──────────────────┘    └─────────────────────┘
```

---

## Backup Sets vs Image Copies

### Backup Sets

A backup set is RMAN's proprietary backup format, consisting of one or more **backup pieces** (physical files). RMAN reads used blocks from datafiles and packs them into backup pieces, skipping unused blocks by default. This results in backup sets being smaller than image copies.

- Supports compression (BASIC, LOW, MEDIUM, HIGH via `AS COMPRESSED BACKUPSET`)
- Supports encryption
- Natively supports incremental backups
- Required for tape (SBT) backups
- Cannot be used directly by Oracle without first restoring through RMAN

```sql
-- Create a full backup set of the database
BACKUP DATABASE;

-- Create a compressed backup set
BACKUP AS COMPRESSED BACKUPSET DATABASE;

-- Backup a specific tablespace as a backup set
BACKUP TABLESPACE users;
```

### Image Copies

An image copy is a bit-for-bit copy of a datafile, archived log, or control file — identical in format to the original. Oracle can use it directly (for example, by placing it in the correct location and recovering without a separate restore step).

- Faster recovery: no restore step needed, simply switch and recover
- Larger on disk: copies all blocks including unused ones
- Can be incrementally updated using `RECOVER COPY` (rolling an image copy forward with incremental backups)
- Cannot be written to tape via SBT without conversion

```sql
-- Create image copies of all datafiles
BACKUP AS COPY DATABASE;

-- Create an image copy of a specific datafile
BACKUP AS COPY DATAFILE '/oradata/users01.dbf';
```

### Backup Sets vs Image Copies: When to Use Each

| Factor | Backup Set | Image Copy |
|---|---|---|
| Disk space | Smaller (skips empty blocks) | Larger (full copy) |
| Backup time | Slower (compression overhead possible) | Faster |
| Recovery time | Slower (restore + recover) | Faster (switch + recover) |
| Tape support | Yes | No (directly) |
| Incrementally updatable | Yes (incremental backups) | Yes (RECOVER COPY) |
| Direct use without RMAN | No | Yes |

---

## Incremental Backups (Level 0 and Level 1)

Incremental backups copy only the blocks that have changed since a prior backup. RMAN tracks changed blocks through the **Block Change Tracking (BCT)** file, which greatly accelerates incremental backups by eliminating full datafile scans.

### Level 0

A level 0 incremental backup serves as the baseline — it copies all used blocks, just like a full backup, but is tagged as an incremental baseline. Subsequent level 1 backups are taken against it.

```sql
-- Full incremental baseline (Level 0)
BACKUP INCREMENTAL LEVEL 0 DATABASE;
```

### Level 1

A level 1 incremental backup copies only the blocks that changed since the most recent level 0 or level 1 backup. Two variants exist:

- **Differential** (default): copies blocks changed since the last level 0 or level 1
- **Cumulative**: copies blocks changed since the last level 0 only

```sql
-- Differential incremental (default) — backs up changes since last level 0 or 1
BACKUP INCREMENTAL LEVEL 1 DATABASE;

-- Cumulative incremental — backs up all changes since last level 0
BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE;
```

### Typical Weekly Incremental Strategy

```
Sunday:    BACKUP INCREMENTAL LEVEL 0 DATABASE;   -- full baseline
Monday:    BACKUP INCREMENTAL LEVEL 1 DATABASE;   -- Mon changes
Tuesday:   BACKUP INCREMENTAL LEVEL 1 DATABASE;   -- Tue changes
Wednesday: BACKUP INCREMENTAL LEVEL 1 DATABASE;   -- Wed changes
...
Saturday:  BACKUP INCREMENTAL LEVEL 1 DATABASE;   -- Sat changes
```

### Block Change Tracking

Enable BCT to avoid full datafile scan during incremental backups:

```sql
-- Enable block change tracking (requires Enterprise Edition)
ALTER DATABASE ENABLE BLOCK CHANGE TRACKING
  USING FILE '/oradata/bct/change_tracking.bct';

-- Verify
SELECT status, filename FROM v$block_change_tracking;
```

### Incrementally Updated Image Copies (Merge Strategy)

A powerful technique that pairs image copies with incremental backups to keep a "rolling" image copy current to the previous day, enabling very fast recovery.

```sql
-- Day 1: Create level 0 image copy baseline
BACKUP INCREMENTAL LEVEL 0 AS COPY DATABASE;

-- Daily: Roll forward the image copy with yesterday's changes
RECOVER COPY OF DATABASE WITH TAG 'daily_copy'
  UNTIL TIME 'SYSDATE - 1';
BACKUP INCREMENTAL LEVEL 1 FOR RECOVER OF COPY
  WITH TAG 'daily_copy' DATABASE;
```

---

## Backup Retention Policies

RMAN retention policies determine how long backups are retained before being considered obsolete.

### Retention by Recovery Window

Retains enough backups to support recovery to any point within the specified window:

```sql
-- Keep backups needed to recover to any point in the last 7 days
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 7 DAYS;
```

### Retention by Redundancy

Maintains a fixed number of backup copies:

```sql
-- Keep 2 full copies of each datafile
CONFIGURE RETENTION POLICY TO REDUNDANCY 2;
```

### Clearing the Retention Policy

```sql
-- No retention policy (keep everything — not recommended without external management)
CONFIGURE RETENTION POLICY TO NONE;
```

### Deleting Obsolete Backups

After a retention policy is set, obsolete backups can be removed:

```sql
-- List what would be deleted
REPORT OBSOLETE;

-- Delete obsolete backup pieces
DELETE OBSOLETE;

-- Delete all expired backup records (pieces not found in expected location)
CROSSCHECK BACKUP;
DELETE EXPIRED BACKUP;
```

---

## RMAN Catalog Setup

### Why Use a Recovery Catalog

- Retains backup history beyond the limit of the control file's `CONTROL_FILE_RECORD_KEEP_TIME`
- Allows stored RMAN scripts to be shared across databases
- Supports backup reporting across multiple target databases
- Required for RMAN virtual private catalog (VPC) to enable delegated access

### Creating the Catalog

```sql
-- 1. Create a dedicated tablespace in the catalog database
CREATE TABLESPACE rman_cat
  DATAFILE '/oradata/rmancat/rman_cat01.dbf' SIZE 500M AUTOEXTEND ON;

-- 2. Create the catalog owner
CREATE USER rman_owner
  IDENTIFIED BY <password>
  DEFAULT TABLESPACE rman_cat
  QUOTA UNLIMITED ON rman_cat;

GRANT RECOVERY_CATALOG_OWNER TO rman_owner;
```

```bash
# 3. Connect to RMAN and create the catalog schema
rman catalog rman_owner/<password>@catdb
RMAN> CREATE CATALOG;
```

### Registering a Target Database

```bash
rman target sys/<password>@proddb catalog rman_owner/<password>@catdb
RMAN> REGISTER DATABASE;
```

### Resync the Catalog

```sql
-- Synchronize catalog with the target's control file
RESYNC CATALOG;

-- Full resync (more thorough)
RESYNC CATALOG FROM CONTROLFILECOPY '/path/to/ctl_copy';
```

---

## Recovery Scenarios

### Connecting to RMAN

```bash
# Connect to target only (uses control file for metadata)
rman target sys/<password>@proddb

# Connect with recovery catalog
rman target sys/<password>@proddb catalog rman_owner/<password>@catdb

# Connect as SYSDBA with OS authentication (local)
rman target /
```

### Complete Recovery

Complete recovery restores the database to the current point in time with no data loss. It requires all archived logs from after the backup through the current SCN.

```sql
-- Database is mounted (not open), restore and recover
STARTUP MOUNT;
RESTORE DATABASE;
RECOVER DATABASE;
ALTER DATABASE OPEN;
```

### Incomplete Recovery (Point-in-Time Recovery)

Used when recovery to a point earlier than the current time is needed — for example, to reverse an accidental table drop or data corruption event.

**By SCN:**
```sql
STARTUP MOUNT;
RUN {
  SET UNTIL SCN 5432100;
  RESTORE DATABASE;
  RECOVER DATABASE;
}
ALTER DATABASE OPEN RESETLOGS;
```

**By Time:**
```sql
STARTUP MOUNT;
RUN {
  SET UNTIL TIME "TO_DATE('2025-12-01 14:30:00','YYYY-MM-DD HH24:MI:SS')";
  RESTORE DATABASE;
  RECOVER DATABASE;
}
ALTER DATABASE OPEN RESETLOGS;
```

**By Sequence:**
```sql
STARTUP MOUNT;
RUN {
  SET UNTIL SEQUENCE 1450 THREAD 1;
  RESTORE DATABASE;
  RECOVER DATABASE;
}
ALTER DATABASE OPEN RESETLOGS;
```

Note: `RESETLOGS` is mandatory after incomplete recovery. It resets the log sequence and establishes a new incarnation.

### Tablespace Point-in-Time Recovery (TSPITR)

Recovers a single tablespace to a prior point in time while the remainder of the database remains online. RMAN automatically uses an auxiliary instance for this operation.

```sql
-- Recover the USERS tablespace to 2 hours ago
RECOVER TABLESPACE users
  UNTIL TIME 'SYSDATE - 2/24'
  AUXILIARY DESTINATION '/tmp/tspitr_aux';
```

### Datafile Recovery

When a single datafile is lost or becomes corrupted:

```sql
-- Take the datafile offline
ALTER DATABASE DATAFILE '/oradata/users01.dbf' OFFLINE;

-- Restore just the missing datafile
RESTORE DATAFILE '/oradata/users01.dbf';

-- Apply archived logs to bring it current
RECOVER DATAFILE '/oradata/users01.dbf';

-- Bring the datafile back online
ALTER DATABASE DATAFILE '/oradata/users01.dbf' ONLINE;
```

### Control File Recovery

```sql
-- Restore control file from autobackup
STARTUP NOMOUNT;
RESTORE CONTROLFILE FROM AUTOBACKUP;
ALTER DATABASE MOUNT;
RECOVER DATABASE;
ALTER DATABASE OPEN RESETLOGS;
```

---

## Best Practices

- **Enable control file autobackup** — this ensures RMAN can recover the control file even without a catalog. Note: autobackup is `ON` by default for databases with `COMPATIBLE` set to 12.2 or higher; confirm the setting on older-compatibility databases.
  ```sql
  CONFIGURE CONTROLFILE AUTOBACKUP ON;
  CONFIGURE CONTROLFILE AUTOBACKUP FORMAT FOR DEVICE TYPE DISK TO '/backup/ctl_%F';
  ```

- **Always back up archived logs** — a database backup taken without archived logs cannot be recovered to a consistent state.
  ```sql
  BACKUP DATABASE PLUS ARCHIVELOG DELETE INPUT;
  ```

- **Test your backups regularly** — confirm that backup pieces are intact and restorable.
  ```sql
  RESTORE DATABASE VALIDATE;
  RESTORE TABLESPACE users VALIDATE;
  ```

- **Use a recovery catalog** for any production database — the control file alone is inadequate for long-term backup history.

- **Enable Block Change Tracking** on Enterprise Edition to accelerate incremental backups.

- **Store backups off-host** — on-host disk backups are worthless if the server is lost. Use NFS, ASM, Object Storage, or tape.

- **Document and test your recovery runbooks** at least annually. A backup strategy that has never been validated is not truly a strategy.

- **Back up before and after significant changes** such as schema migrations, major patches, and upgrades.

---

## Common Mistakes and How to Avoid Them

**Backing up to the same disk as the database**
If that disk fails, both the database and its backups are lost. Always write backups to a separate storage tier.

**Never testing restores**
Untested backups are assumptions, not guarantees. Schedule quarterly restore tests against a separate server.

**Ignoring RMAN alerts in the alert log**
Failed backup jobs frequently write errors to the alert log and RMAN log without triggering any notification. Configure monitoring for RMAN job status via `V$RMAN_STATUS`.

```sql
-- Check recent RMAN job status
SELECT start_time, end_time, status, input_bytes_display, output_bytes_display
FROM v$rman_backup_job_details
ORDER BY start_time DESC
FETCH FIRST 10 ROWS ONLY;
```

**Omitting separate control file and SPFILE backups**
```sql
-- Explicit control file and SPFILE backup
BACKUP CURRENT CONTROLFILE;
BACKUP SPFILE;
```

**Allowing archived logs to fill the FRA**
```sql
-- Check FRA usage
SELECT name, space_limit/1048576 limit_mb,
       space_used/1048576 used_mb,
       space_reclaimable/1048576 reclaimable_mb
FROM v$recovery_file_dest;

-- Delete archived logs already backed up at least once
DELETE ARCHIVELOG ALL BACKED UP 1 TIMES TO DEVICE TYPE DISK;
```

**Using NOARCHIVELOG mode for anything other than dev/test**
NOARCHIVELOG mode limits recovery to the last full backup — all transactions after that backup are permanently lost in a media failure. Always use ARCHIVELOG mode for production databases.

```sql
-- Check archivelog mode
SELECT log_mode FROM v$database;

-- Enable archivelog mode
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
```

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## See Also

- [RMAN Basics: Commands, Configuration, and Operations](rman-basics.md) — Day-to-day RMAN command reference

## Sources

- [Oracle Database 19c Backup and Recovery User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/)
- [Oracle Database 19c RMAN Reference — BACKUP command](https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/BACKUP.html)
- [Oracle Database 19c RMAN Reference — CONFIGURE command](https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/CONFIGURE.html)
- [Oracle Database 19c Reference — CONTROL_FILE_RECORD_KEEP_TIME](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/CONTROL_FILE_RECORD_KEEP_TIME.html)
