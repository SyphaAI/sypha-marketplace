# Oracle Redo Log Management

## Overview

The redo log is Oracle's write-ahead log. Every modification to the database — INSERT, UPDATE, DELETE, DDL, and even internal operations — is first captured as a redo entry in the online redo log buffer, then written to disk into the **online redo log files** by the Log Writer (LGWR) process. This guarantees durability: if the database crashes, redo can replay all committed changes from the last checkpoint forward.

Correctly understanding and sizing the redo log infrastructure is essential to database performance and availability. Undersized redo logs produce excessive log switches, create checkpoint pressure, and can substantially reduce throughput.

---

## Online Redo Log Groups and Members

### Groups

Oracle's online redo log is organized into **groups**, each containing one or more **members** (physical files). At any given moment, LGWR writes exclusively to one group — the **current** group. When a log switch occurs, LGWR advances to the next group.

- A database requires at least 2 groups to function
- Production databases should have a minimum of 3 groups to allow LGWR to cycle while archiving keeps pace
- Groups are identified by a group number (1, 2, 3, ...)

### Members (Multiplexing)

Each group may hold multiple member files — physical copies of the same redo data residing on different disks. Every member within a group contains identical redo data. When one member is lost due to a disk failure, the group continues to operate using the remaining members.

- A minimum of 1 member per group is required; 2–3 members are recommended for production
- Members should be placed on separate physical disks or storage controllers to ensure redundancy
- All members within a group must be the same size

```
Online Redo Log Structure:
┌─────────────────────────────────────────┐
│ Group 1: /disk1/redo01a.log             │  ← CURRENT (LGWR writing here)
│          /disk2/redo01b.log  (mirror)   │
├─────────────────────────────────────────┤
│ Group 2: /disk1/redo02a.log             │  ← ACTIVE (needed for crash recovery)
│          /disk2/redo02b.log  (mirror)   │
├─────────────────────────────────────────┤
│ Group 3: /disk1/redo03a.log             │  ← INACTIVE (available for LGWR)
│          /disk2/redo03b.log  (mirror)   │
└─────────────────────────────────────────┘
```

### Viewing Current Redo Log Configuration

```sql
-- View all groups and their status
SELECT group#, members, bytes/1048576 size_mb, status, archived
FROM v$log
ORDER BY group#;

-- View all members and their paths
SELECT l.group#, l.sequence#, l.status,
       lf.member, lf.status member_status
FROM v$log l
JOIN v$logfile lf ON l.group# = lf.group#
ORDER BY l.group#, lf.member;

-- Group status values:
-- CURRENT   = LGWR is currently writing to this group
-- ACTIVE    = needed for instance recovery (not yet checkpointed away from)
-- INACTIVE  = not needed for recovery; available for reuse
-- UNUSED    = never been written to
-- CLEARING  = being re-created (ALTER DATABASE CLEAR LOGFILE in progress)
```

---

## Adding, Dropping, and Resizing Redo Logs

### Adding New Groups and Members

```sql
-- Add a new group with two members (multiplexed)
ALTER DATABASE ADD LOGFILE GROUP 4
  ('/disk1/redo04a.log', '/disk2/redo04b.log') SIZE 500M;

-- Add a member to an existing group (multiplexing an existing group)
ALTER DATABASE ADD LOGFILE MEMBER
  '/disk2/redo01b.log' TO GROUP 1;

-- Add a member to all groups at once (loop in a script)
ALTER DATABASE ADD LOGFILE MEMBER '/disk2/redo01b.log' TO GROUP 1;
ALTER DATABASE ADD LOGFILE MEMBER '/disk2/redo02b.log' TO GROUP 2;
ALTER DATABASE ADD LOGFILE MEMBER '/disk2/redo03b.log' TO GROUP 3;
```

### Dropping Groups and Members

A group can only be dropped when its status is INACTIVE (not CURRENT or ACTIVE). Dropping a group is not permitted if it would reduce the total to fewer than 2 groups.

```sql
-- Drop a redo log group
ALTER DATABASE DROP LOGFILE GROUP 4;

-- Drop a specific member (file is not deleted from OS automatically in older versions)
ALTER DATABASE DROP LOGFILE MEMBER '/disk2/redo01b.log';

-- After dropping, remove the OS file manually if needed
-- (host OS command, not SQL)
```

### Resizing Redo Logs

Oracle does not provide an `ALTER DATABASE RESIZE LOGFILE` command. To resize, add new groups at the desired size, allow the old groups to cycle to INACTIVE status, then drop them.

```sql
-- Step 1: Add new groups at desired size
ALTER DATABASE ADD LOGFILE GROUP 4 ('/oradata/redo04a.log') SIZE 1G;
ALTER DATABASE ADD LOGFILE GROUP 5 ('/oradata/redo05a.log') SIZE 1G;
ALTER DATABASE ADD LOGFILE GROUP 6 ('/oradata/redo06a.log') SIZE 1G;

-- Step 2: Force log switches to cycle through old groups
ALTER SYSTEM SWITCH LOGFILE;   -- repeat until old groups are INACTIVE
ALTER SYSTEM CHECKPOINT;       -- advance checkpoint so ACTIVE becomes INACTIVE

-- Step 3: Drop the old undersized groups
ALTER DATABASE DROP LOGFILE GROUP 1;
ALTER DATABASE DROP LOGFILE GROUP 2;
ALTER DATABASE DROP LOGFILE GROUP 3;

-- Step 4: Verify new configuration
SELECT group#, bytes/1048576 size_mb, status FROM v$log ORDER BY group#;
```

---

## Sizing Redo Logs (Avoiding Frequent Log Switches)

### Why Log Switch Frequency Matters

Each log switch triggers a **checkpoint** (instructing DBWR to flush all dirty buffers to disk) and, in ARCHIVELOG mode, requires the ARCn process to archive the log before it can be recycled. Frequent log switches:

- Elevate I/O pressure from checkpoint activity
- Can stall LGWR when it cycles back to a group not yet archived (log switch wait)
- Produce an excessive volume of archived logs
- Appear in the alert log and V$SESSION_WAIT as `log file switch` wait events

Oracle recommends that log switches occur no more frequently than every 15–30 minutes under normal load.

### Measuring Current Log Switch Frequency

```sql
-- Log switch frequency per hour (from alert log via V$LOG_HISTORY)
SELECT TO_CHAR(first_time, 'YYYY-MM-DD HH24') hour_bucket,
       COUNT(*) switches
FROM v$log_history
WHERE first_time > SYSDATE - 7
GROUP BY TO_CHAR(first_time, 'YYYY-MM-DD HH24')
ORDER BY 1 DESC
FETCH FIRST 48 ROWS ONLY;

-- Average redo generated per switch (helps size new logs)
SELECT ROUND(AVG(blocks * block_size) / 1048576, 1) avg_mb_per_log
FROM v$archived_log
WHERE first_time > SYSDATE - 7
  AND standby_dest = 'NO';

-- Current log group size vs actual usage
SELECT l.group#, l.bytes/1048576 size_mb,
       l.status,
       lh.blocks * lh.block_size / 1048576 last_used_mb
FROM v$log l
LEFT JOIN v$archived_log lh ON l.sequence# = lh.sequence#
ORDER BY l.group#;
```

### Sizing Recommendation

A practical guideline: size redo logs so that log switches occur every 15–30 minutes at peak load.

If current logs are 200MB and switches occur every 3 minutes during peak, the peak redo generation rate is approximately 200MB / 3min = 66 MB/min. The target log size for a 20-minute switch interval is 66 MB/min × 20 min = 1.3 GB.

```sql
-- More precise sizing: check max redo blocks per 10-minute window from UNDOSTAT
-- (UNDOSTAT tracks undo blocks, use V$SYSSTAT for redo)
SELECT statistic#, name, value
FROM v$sysstat
WHERE name IN ('redo size', 'redo entries', 'redo log space requests',
               'redo log space wait time');
```

---

## ARCHIVELOG Mode

### What ARCHIVELOG Mode Does

In **ARCHIVELOG mode**, before Oracle recycles an online redo log group, the ARCn (archiver) process copies it to the **archived log destination**. This archived copy retains all redo data and enables:
- Point-in-time recovery of the database (not limited to the most recent full backup)
- Online (hot) backups using RMAN
- Data Guard (standby databases)
- Oracle Streams, LogMiner, or GoldenGate

In **NOARCHIVELOG mode**, online redo logs are overwritten without being archived. Recovery is restricted to the most recent full backup — all committed changes made since that backup are unrecoverable in a media failure. NOARCHIVELOG is appropriate only for development or test databases.

### Checking and Enabling ARCHIVELOG Mode

```sql
-- Check current mode
SELECT log_mode, name FROM v$database;

-- View archiver status
SELECT archiver FROM v$instance;

-- Enable ARCHIVELOG mode
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;

-- Verify
SELECT log_mode FROM v$database;
-- Should return: ARCHIVELOG
```

### Configuring Archive Log Destinations

```sql
-- Set the primary archive log destination
ALTER SYSTEM SET LOG_ARCHIVE_DEST_1 =
  'LOCATION=/oradata/archive VALID_FOR=(ALL_LOGFILES,ALL_ROLES)'
  SCOPE=BOTH;

-- Enable the destination
ALTER SYSTEM SET LOG_ARCHIVE_DEST_STATE_1 = ENABLE SCOPE=BOTH;

-- Use Fast Recovery Area (FRA) as archive destination
ALTER SYSTEM SET DB_RECOVERY_FILE_DEST = '/oradata/fra' SCOPE=BOTH;
ALTER SYSTEM SET DB_RECOVERY_FILE_DEST_SIZE = 100G SCOPE=BOTH;
ALTER SYSTEM SET LOG_ARCHIVE_DEST_1 =
  'LOCATION=USE_DB_RECOVERY_FILE_DEST' SCOPE=BOTH;

-- View current archive destinations
SELECT dest_id, dest_name, status, target, archiver, schedule,
       destination, transmit_mode
FROM v$archive_dest
WHERE status != 'INACTIVE'
ORDER BY dest_id;
```

### Manual Log Switch and Archive

```sql
-- Force a log switch
ALTER SYSTEM SWITCH LOGFILE;

-- Archive all unarchived logs (for manual archiving or testing)
ALTER SYSTEM ARCHIVE LOG ALL;

-- Archive current log
ALTER SYSTEM ARCHIVE LOG CURRENT;
```

---

## Archived Log Management

Archived logs accumulate continuously. Without active management they will eventually fill the archive destination or Fast Recovery Area, causing the database to stall.

### Monitoring Archived Log Space

```sql
-- Check FRA usage
SELECT name, space_limit/1073741824 limit_gb,
       space_used/1073741824 used_gb,
       space_reclaimable/1073741824 reclaimable_gb,
       ROUND(space_used / space_limit * 100, 1) pct_used
FROM v$recovery_file_dest;

-- Count and size of archived logs on disk
SELECT dest_id, COUNT(*) log_count,
       SUM(blocks * block_size) / 1073741824 total_gb
FROM v$archived_log
WHERE standby_dest = 'NO'
  AND deleted = 'NO'
GROUP BY dest_id;

-- Oldest archived log on disk
SELECT MIN(first_time) oldest_log, MAX(first_time) newest_log
FROM v$archived_log
WHERE standby_dest = 'NO'
  AND deleted = 'NO';
```

### Deleting Archived Logs Safely

Always remove archived logs through RMAN rather than OS-level commands:

```sql
-- Via RMAN: delete archived logs already backed up at least once
DELETE ARCHIVELOG ALL BACKED UP 1 TIMES TO DEVICE TYPE DISK;

-- Delete archived logs older than 7 days (whether backed up or not — use with caution)
DELETE ARCHIVELOG UNTIL TIME 'SYSDATE-7';

-- Delete all archived logs backed up at least 2 times (very safe)
DELETE ARCHIVELOG ALL BACKED UP 2 TIMES TO DEVICE TYPE DISK;
```

If archived logs are accidentally removed via OS commands instead of RMAN:
```sql
-- Crosscheck to find the missing files and mark them EXPIRED
CROSSCHECK ARCHIVELOG ALL;

-- Delete the expired records from the repository
DELETE EXPIRED ARCHIVELOG ALL;
```

---

## Multiplexing Redo Logs

Multiplexing involves keeping multiple copies (members) of each redo log group on separate disks. When one member is lost, LGWR continues writing to the surviving members without any database outage.

```sql
-- Add a second member to every existing group (multiplexing)
-- Assumes groups 1-3 exist
ALTER DATABASE ADD LOGFILE MEMBER '/disk2/redo01b.log' TO GROUP 1;
ALTER DATABASE ADD LOGFILE MEMBER '/disk2/redo02b.log' TO GROUP 2;
ALTER DATABASE ADD LOGFILE MEMBER '/disk2/redo03b.log' TO GROUP 3;

-- Verify multiplexing
SELECT l.group#, lf.member, lf.type, lf.status
FROM v$log l JOIN v$logfile lf ON l.group# = lf.group#
ORDER BY l.group#, lf.member;
```

### Recovering from a Missing Redo Log Member

When a member file is lost (for example, due to disk failure) but the other members of the group are still intact:

```sql
-- The group will show status CURRENT or ACTIVE but one member will show INVALID or STALE
-- Drop the missing member
ALTER DATABASE DROP LOGFILE MEMBER '/disk2/redo01b.log';

-- Re-add a new member (Oracle will create the file)
ALTER DATABASE ADD LOGFILE MEMBER '/disk3/redo01b.log' TO GROUP 1;
-- Note: new member starts INVALID and becomes current on the next log switch
```

### Recovering from a Missing CURRENT Log Group (Media Failure)

This is a more severe scenario. When the CURRENT group is lost:

```sql
-- First, try to clear the log (creates a new empty log, losing unarchived redo)
-- WARNING: This WILL cause data loss — use only when the log truly cannot be recovered
ALTER DATABASE CLEAR UNARCHIVED LOGFILE GROUP 1;

-- After clearing, the database may need recovery from backup
-- Check if all datafiles are consistent
SELECT file#, name, status FROM v$datafile WHERE status != 'ONLINE';
```

---

## Log Switch Frequency Monitoring

### Alert Log Monitoring

Log switches are recorded in the alert log with timestamps. Switches occurring every few minutes indicate that the redo logs are undersized.

```sql
-- Log switch history by day (useful for capacity planning)
SELECT TRUNC(first_time, 'DD') log_date,
       COUNT(*) daily_switches,
       ROUND(COUNT(*) / 24, 1) switches_per_hour_avg
FROM v$log_history
WHERE first_time > SYSDATE - 30
GROUP BY TRUNC(first_time, 'DD')
ORDER BY 1 DESC;

-- Peak switches in a single hour
SELECT TO_CHAR(first_time, 'YYYY-MM-DD HH24') hour,
       COUNT(*) switches
FROM v$log_history
WHERE first_time > SYSDATE - 7
GROUP BY TO_CHAR(first_time, 'YYYY-MM-DD HH24')
ORDER BY 2 DESC
FETCH FIRST 10 ROWS ONLY;
```

### Log Switch Wait Events

When LGWR cannot advance to the next log group (because it is still ACTIVE — either not yet checkpointed or still being archived), sessions wait:

```sql
-- Check for log file switch waits
SELECT event, total_waits, time_waited, average_wait
FROM v$system_event
WHERE event LIKE 'log file switch%'
ORDER BY time_waited DESC;

-- Event: "log file switch (checkpoint incomplete)" → need more groups or faster I/O
-- Event: "log file switch (archiving needed)"     → ARCn cannot keep up; check archiver lag
-- Event: "log file switch completion"             → occasional switch overhead (normal in small amounts)

-- Current session waits for context
SELECT s.sid, s.serial#, s.username, s.event, s.state, s.seconds_in_wait
FROM v$session s
WHERE s.event LIKE 'log file switch%'
   OR s.event = 'log file sync';
```

---

## Best Practices

- **Always operate in ARCHIVELOG mode** in production. NOARCHIVELOG mode eliminates the ability to perform point-in-time recovery.

- **Multiplex redo logs** across separate physical disks. The overhead of an additional copy is negligible compared to the risk of losing the current redo log.

- **Size redo logs for 15–30 minute switches** at peak load. Logs that are too small trigger frequent switches and degrade performance; logs that are too large slightly extend media recovery time since more redo must be replayed per log.

- **Use a Fast Recovery Area (FRA)** for archived log storage. It streamlines management and enables RMAN to clean up the FRA automatically.

- **Monitor FRA space on a daily basis.** A full FRA causes the database to stall waiting for space. Configure an OEM alert on FRA percent used.

- **Never remove archived logs with OS commands.** Always use RMAN to delete archived logs so the control-file repository remains accurate.

- **Provision groups proactively, before they are needed.** At least 3–5 groups give the archiver adequate time to keep pace. Under very high redo generation volumes (data loads, bulk DML), 6 or more groups may be required.

- **Keep LGWR I/O latency low.** Redo logs should reside on low-latency storage (SSD, dedicated spindles, or ASM with high redundancy). LGWR latency has a direct impact on commit response time.

---

## Common Mistakes and How to Avoid Them

**Using only 2 redo log groups**
With just 2 groups, if LGWR fills group 1 and ARCn has not finished archiving it, LGWR stalls until group 1 becomes available. Always configure at least 3 groups.

**Leaving redo logs unmirrored**
Losing the sole member of the CURRENT redo log group due to a disk failure leaves the database unrecoverable unless data loss is accepted and `CLEAR UNARCHIVED LOGFILE` is used. Always multiplex redo log members.

**Placing redo logs on the same physical disk as datafiles**
Under heavy write workloads, redo log I/O contends with datafile I/O. Keep redo logs on dedicated disks, separate from datafiles and archive logs.

**Forgetting to monitor FRA space**
```sql
-- Add this to your daily monitoring script
SELECT name, space_limit/1073741824 limit_gb,
       space_used/1073741824 used_gb,
       ROUND(space_used/space_limit*100,1) pct_full
FROM v$recovery_file_dest;
```
When the FRA reaches 100%, the database will hang on the next log switch.

**Enabling ARCHIVELOG mode without setting an archive destination**
If `LOG_ARCHIVE_DEST_1` is not configured and no FRA is defined, Oracle archives to a default OS location that may lack adequate space or may not be included in backups.

**Attempting to drop a log group while it is ACTIVE**
This fails with ORA-00350. Run `ALTER SYSTEM CHECKPOINT` first to advance the checkpoint and move the group to INACTIVE status before dropping it.

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database Administrator's Guide 19c — Managing the Redo Log](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-the-redo-log.html)
- [Oracle Database 19c Reference — V$LOG](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-LOG.html)
- [Oracle Database 19c Reference — V$LOGFILE](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-LOGFILE.html)
- [Oracle Database 19c Reference — V$LOG_HISTORY](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-LOG_HISTORY.html)
