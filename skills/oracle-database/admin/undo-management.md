# Oracle Undo Management

## Overview

Undo (also referred to as rollback) is Oracle's mechanism for preserving the "before image" of data modified by an uncommitted transaction. Undo fulfills three essential purposes:

1. **Transaction rollback** — when a transaction is rolled back, Oracle applies undo to restore rows to their prior state.
2. **Read consistency** — queries observe a snapshot of data as it existed at the start of the query or transaction, independent of concurrent modifications. Oracle rebuilds this snapshot from undo.
3. **Flashback features** — Flashback Query, Flashback Table, and Flashback Database all depend on undo data.

Oracle relies on **Automatic Undo Management (AUM)**, which administers a dedicated undo tablespace without manual intervention. Manual rollback segment management is deprecated and must not be used in modern Oracle databases.

---

## Automatic Undo Management

### Key Parameters

**`UNDO_MANAGEMENT`**
Must be set to `AUTO` to enable Automatic Undo Management. This has been the default since Oracle 10g. With `AUTO`, Oracle administers a dedicated undo tablespace. Setting this to `MANUAL` activates legacy manual rollback segments (avoid this in all production systems).

```sql
-- Check current setting
SHOW PARAMETER undo_management;
-- Should return: AUTO
```

**`UNDO_TABLESPACE`**
Identifies which undo tablespace is currently active. Only one undo tablespace is active per instance (or per thread in RAC).

```sql
SHOW PARAMETER undo_tablespace;

-- Switch the active undo tablespace
ALTER SYSTEM SET UNDO_TABLESPACE = undotbs2 SCOPE=BOTH;
```

**`UNDO_RETENTION`**
Defines the minimum retention period (in seconds) for undo data after a transaction commits. In current 19c releases Oracle auto-tunes retention, but unexpired undo may still be reclaimed when active transactions require space and the undo tablespace cannot meet the demand.

```sql
SHOW PARAMETER undo_retention;
-- Default: 900 seconds (15 minutes)

-- Increase to 1 hour
ALTER SYSTEM SET UNDO_RETENTION = 3600 SCOPE=BOTH;
```

**`RETENTION GUARANTEE`**
When activated on the undo tablespace, Oracle will not overwrite unexpired undo regardless of space pressure. This ensures read consistency for queries up to `UNDO_RETENTION` seconds old, but active transactions may encounter ORA-30036 ("unable to extend undo segment") if the tablespace fills up.

```sql
-- Enable retention guarantee
ALTER TABLESPACE undotbs1 RETENTION GUARANTEE;

-- Disable retention guarantee
ALTER TABLESPACE undotbs1 RETENTION NOGUARANTEE;

-- Check current setting
SELECT tablespace_name, retention FROM dba_tablespaces
WHERE contents = 'UNDO';
```

---

## Undo Tablespace Sizing

### How Undo Space is Consumed

Undo space usage is driven by:
- **Number of concurrent transactions** — every active transaction consumes undo space
- **Transaction rate (rows changed per second)** — a higher rate of change produces more undo
- **Transaction duration** — long-running transactions retain undo for their full lifetime
- **Undo retention target** — committed undo is preserved for `UNDO_RETENTION` seconds when space allows
- **Undo block size** — inherited from the database block size

### Sizing Formula

A useful sizing formula for the undo tablespace:

```
Required undo (bytes) = UndoRetention (seconds)
                      × DB_BLOCK_SIZE
                      × Active undo block generation rate (blocks/sec)
                      + overhead for active transactions
```

Use the Undo Advisor (described below) to obtain Oracle's recommendation, but for a rough manual estimate:

```sql
-- Check average undo block generation rate
SELECT undoblks / ((end_time - begin_time) * 86400) AS undo_blocks_per_sec
FROM v$undostat
ORDER BY begin_time DESC
FETCH FIRST 1 ROW ONLY;

-- Check max undo blocks generated in any 10-minute window
SELECT MAX(undoblks) max_undo_blocks,
       MAX(maxquerylen) max_query_sec,
       AVG(undoblks) avg_undo_blocks
FROM v$undostat;
```

### Creating and Sizing the Undo Tablespace

```sql
-- Create a new undo tablespace with autoextend
CREATE UNDO TABLESPACE undotbs2
  DATAFILE '/oradata/undotbs2_01.dbf' SIZE 2G
  AUTOEXTEND ON NEXT 512M MAXSIZE 20G;

-- Add a datafile to an existing undo tablespace
ALTER TABLESPACE undotbs1
  ADD DATAFILE '/oradata/undotbs1_02.dbf' SIZE 2G AUTOEXTEND ON;

-- Switch to the new undo tablespace
ALTER SYSTEM SET UNDO_TABLESPACE = undotbs2 SCOPE=BOTH;

-- Drop the old undo tablespace once all transactions have migrated
-- (wait until no transactions reference it)
DROP TABLESPACE undotbs1 INCLUDING CONTENTS AND DATAFILES;
```

---

## Monitoring Undo Usage

### V$UNDOSTAT

`V$UNDOSTAT` captures 10-minute snapshots of undo activity and is the primary source of data for undo sizing decisions.

```sql
-- Key undo statistics over recent history
SELECT begin_time,
       undoblks,           -- undo blocks consumed
       txncount,           -- number of transactions
       maxquerylen,        -- longest running query (seconds)
       maxconcurrency,     -- peak concurrent transactions
       ssolderrcnt,        -- ORA-01555 errors in this window
       nospaceerrcnt,      -- ORA-30036 errors (undo space exhausted)
       activeblks,         -- undo blocks currently active
       unexpiredblks,      -- unexpired (retained) undo blocks
       expiredblks         -- expired (reclaimable) undo blocks
FROM v$undostat
ORDER BY begin_time DESC
FETCH FIRST 24 ROWS ONLY;
```

### V$TRANSACTION

Displays undo consumption for all currently active transactions:

```sql
-- Active transactions and their undo usage
SELECT t.xidusn, t.xidslot, t.xidsqn,
       t.ubafil, t.ubablk,
       t.used_ublk * (SELECT block_size FROM dba_tablespaces WHERE contents='UNDO' AND rownum=1) / 1048576 AS undo_mb,
       t.start_time,
       s.username, s.sid, s.serial#,
       s.sql_id
FROM v$transaction t
JOIN v$session s ON t.ses_addr = s.saddr
ORDER BY t.used_ublk DESC;
```

### DBA_UNDO_EXTENTS

Reports the current state of each undo extent:

```sql
-- Summary of undo extent status
SELECT status, COUNT(*) cnt, SUM(blocks) total_blocks,
       SUM(bytes)/1048576 total_mb
FROM dba_undo_extents
GROUP BY status;

-- Active = currently in use by a transaction
-- UNEXPIRED = committed but within UNDO_RETENTION window
-- EXPIRED = available for reuse
```

### Checking for ORA-01555 Errors

```sql
-- Count of ORA-01555 errors from UNDOSTAT history
SELECT SUM(ssolderrcnt) total_01555_errors,
       MIN(begin_time) from_time,
       MAX(end_time) to_time
FROM v$undostat;

-- Alert log also records ORA-01555 errors; check there too
```

---

## ORA-01555: Snapshot Too Old

### Cause

ORA-01555 ("snapshot too old: rollback segment number N with name "..." too small") occurs when a query cannot reconstruct the read-consistent snapshot it requires because the necessary undo data has already been overwritten.

This situation arises when:
- A long-running query began at SCN X, and while executing, committed changes to blocks it needs to read were overwritten in the undo tablespace
- The query attempts to retrieve the "before image" of those blocks, but the undo data is no longer available

### Typical Scenarios

1. **Long-running batch queries** reading a table that undergoes heavy modification during the query
2. **Slow or delayed row fetching** with a cursor — when a cursor is opened but rows are retrieved slowly over an extended period (common in JDBC applications fetching one row at a time with large result sets)
3. **Undersized undo tablespace** with `RETENTION GUARANTEE` disabled — expired undo is reclaimed rapidly
4. **Very low `UNDO_RETENTION`** — undo data is discarded too soon after commit

### Fixes and Mitigations

**1. Increase UNDO_RETENTION:**
```sql
-- Increase to 2 hours
ALTER SYSTEM SET UNDO_RETENTION = 7200 SCOPE=BOTH;
```

**2. Increase undo tablespace size:**
Additional space allows Oracle to hold undo data longer before it is overwritten.
```sql
ALTER TABLESPACE undotbs1
  ADD DATAFILE '/oradata/undotbs1_02.dbf' SIZE 4G AUTOEXTEND ON;
```

**3. Enable RETENTION GUARANTEE:**
Prevents undo from being overwritten. Use this only when ORA-30036 is a more acceptable failure mode than ORA-01555.
```sql
ALTER TABLESPACE undotbs1 RETENTION GUARANTEE;
```

**4. Reduce fetch delays in applications:**
For JDBC applications, use `setFetchSize()` to retrieve rows in larger batches. Close cursors promptly when they are no longer needed.

**5. Separate conflicting operations by schedule:**
When a long-running report contends with heavy DML activity, schedule them at non-overlapping times.

**6. Use `AS OF` queries for auditing instead of holding cursors open:**
```sql
-- Flashback Query to read consistent historical data
SELECT * FROM employees AS OF TIMESTAMP (SYSTIMESTAMP - INTERVAL '2' HOUR)
WHERE department_id = 10;
```

**7. Apply parallel query for large scans:**
Parallel query completes scans more quickly, narrowing the window during which undo must be retained.

---

## Undo Advisor

Oracle's Undo Advisor (a component of the Automatic Database Diagnostic Monitor, ADDM) analyzes `V$UNDOSTAT` to suggest the optimal `UNDO_RETENTION` value and tablespace size.

### Using DBMS_UNDO_ADV

```sql
-- Calculate the minimum undo tablespace size required for a given retention
-- REQUIRED_RETENTION returns the undo_retention value needed for the period
SELECT DBMS_UNDO_ADV.REQUIRED_RETENTION(
         start_time => SYSDATE - 7,    -- analyze last 7 days
         end_time   => SYSDATE
       ) AS recommended_retention_seconds
FROM DUAL;

-- Calculate minimum tablespace size for a target retention
SELECT DBMS_UNDO_ADV.REQUIRED_UNDO_SIZE(
         retention  => 3600,         -- 1 hour target
         start_time => SYSDATE - 7,
         end_time   => SYSDATE
       ) AS required_mb
FROM DUAL;
```

### Using OEM / Enterprise Manager

In OEM, navigate to: **Database -> Advisor Central -> Undo Advisor**

The Undo Advisor delivers a graphical analysis that includes:
- Current undo usage patterns
- Recommended `UNDO_RETENTION` value based on observed workload
- Recommended tablespace size for a user-defined analysis period
- ORA-01555 risk assessment

---

## Common Undo-Related Queries

```sql
-- Overall undo tablespace usage
SELECT a.tablespace_name,
       a.total_mb,
       b.free_mb,
       a.total_mb - b.free_mb used_mb,
       ROUND((a.total_mb - b.free_mb) / a.total_mb * 100, 1) pct_used
FROM (
  SELECT tablespace_name, SUM(bytes)/1048576 total_mb
  FROM dba_data_files
  WHERE tablespace_name IN (
    SELECT tablespace_name FROM dba_tablespaces WHERE contents = 'UNDO')
  GROUP BY tablespace_name
) a
JOIN (
  SELECT tablespace_name, SUM(bytes)/1048576 free_mb
  FROM dba_free_space
  GROUP BY tablespace_name
) b ON a.tablespace_name = b.tablespace_name;

-- Sessions with oldest active undo (likely candidates for ORA-01555 causing queries)
SELECT s.sid, s.serial#, s.username, s.status,
       s.sql_id, t.start_time,
       ROUND((SYSDATE - TO_DATE(t.start_time,'MM/DD/YY HH24:MI:SS')) * 86400) sec_active
FROM v$session s
JOIN v$transaction t ON s.taddr = t.addr
ORDER BY sec_active DESC;

-- Check if undo autoextend is enabled
SELECT file_name, bytes/1048576 size_mb,
       autoextensible, maxbytes/1048576 max_mb
FROM dba_data_files
WHERE tablespace_name IN (
  SELECT tablespace_name FROM dba_tablespaces WHERE contents = 'UNDO');
```

---

## Best Practices

- **Always use Automatic Undo Management** (`UNDO_MANAGEMENT = AUTO`). Manual rollback segments are deprecated and unreliable in modern Oracle environments.

- **Enable AUTOEXTEND on undo datafiles** but set a `MAXSIZE` cap to prevent runaway transactions from exhausting all available disk space.

- **Set `UNDO_RETENTION` based on your longest expected query duration**, not a static value. Analyze `V$UNDOSTAT` during peak workload periods to determine an appropriate setting.

- **Consult the Undo Advisor** before resizing or tuning undo. It produces data-driven recommendations based on actual workload history.

- **Track `SSOLDERRCNT` in `V$UNDOSTAT`** as part of daily health checks. Any non-zero value indicates that users are encountering ORA-01555 errors.

- **Do not enable RETENTION GUARANTEE** unless the undo tablespace is sufficiently large to handle peak workloads. It changes the failure mode from ORA-01555 to ORA-30036.

- **Size for peak demand, not the average.** Undo consumption during month-end batch runs can be 10–100x the typical rate.

---

## Common Mistakes and How to Avoid Them

**Setting UNDO_RETENTION to a low value and then encountering ORA-01555**
The default of 900 seconds (15 minutes) is inadequate for any environment where batch reports or ETL queries run longer than 15 minutes. Set the value high enough to cover your longest expected query runtime.

**Using AUTOEXTEND without a MAXSIZE limit**
A runaway transaction (for example, an accidental `UPDATE` across millions of rows) will consume all available disk space. Always specify a `MAXSIZE` constraint.

**Switching undo tablespaces while transactions are active**
`UNDO_TABLESPACE` can be switched at any time, but the old tablespace cannot be dropped until all active and unexpired undo within it has expired. Use `DBA_UNDO_EXTENTS` to verify.

```sql
-- Check if old undo tablespace still has active extents
SELECT COUNT(*) FROM dba_undo_extents
WHERE tablespace_name = 'UNDOTBS_OLD'
  AND status IN ('ACTIVE', 'UNEXPIRED');
```

**Ignoring `NOSPACEERRCNT` in V$UNDOSTAT**
A non-zero `NOSPACEERRCNT` signals that transactions are failing with ORA-30036. This typically means the undo tablespace is undersized or RETENTION GUARANTEE is enabled without enough space to support it.

**Manually dropping or altering undo extents or segments**
Never manually manipulate undo segments in an AUM environment. Oracle manages them automatically, and manual interference will cause corruption.

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database Administrator's Guide 19c — Managing Undo](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-undo.html)
- [Oracle Database 19c Reference — V$UNDOSTAT](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-UNDOSTAT.html)
- [Oracle Database 19c Reference — DBA_UNDO_EXTENTS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_UNDO_EXTENTS.html)
