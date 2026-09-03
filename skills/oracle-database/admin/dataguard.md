# Oracle Data Guard

## Overview

Oracle Data Guard is Oracle's high-availability, disaster recovery, and data protection platform. It keeps one or more synchronized replicas of a production database (the **primary**) known as **standby databases**. When the primary database becomes unavailable, a standby can be promoted to take over, limiting downtime and data loss.

Data Guard is licensed under Oracle Database Enterprise Edition. It is Oracle's recommended disaster recovery solution for mission-critical databases and forms a core element of Maximum Availability Architecture (MAA).

---

## Physical vs Logical Standby

### Physical Standby

A physical standby is a block-for-block exact copy of the primary database. Redo data produced on the primary is transmitted to the standby and applied through **Media Recovery** (Redo Apply). The standby remains in a continuous recovery state.

**Characteristics:**
- Byte-for-byte identical to the primary at the block level
- Uses Redo Apply (MRP — Managed Recovery Process)
- Can be opened read-only while continuing to apply redo (Active Data Guard — requires a separate license)
- Supports all data types and object types without restriction
- Quickest to set up and simplest to maintain
- Employed in the majority of DR and HA deployments

**When to use:** DR/HA for any workload, read offload with Active Data Guard, rolling upgrades.

### Logical Standby

A logical standby receives redo from the primary, converts it into SQL statements via LogMiner, and applies those statements using **SQL Apply**. The standby database remains open for read-write access and may contain additional objects that do not exist on the primary.

**Characteristics:**
- Open for read-write activity during apply
- Additional reporting tables, indexes, or schemas may be present on the standby
- Does not support all data types (e.g., BFILE, NCLOB have restrictions on certain versions)
- More complex to administer; SQL Apply can fall behind Redo Apply under heavy load
- Supports data transformations during the apply process

**When to use:** Reporting databases that require read-write access, custom schema additions on the standby, selective replication.

### Snapshot Standby

A snapshot standby is a physical standby that has been temporarily switched to a read-write state for testing purposes. Redo continues to arrive from the primary but is not applied. When it is switched back, the divergent changes are discarded and recovery resumes.

```sql
-- Convert physical standby to snapshot standby (via DGMGRL)
DGMGRL> CONVERT DATABASE standby_db TO SNAPSHOT STANDBY;

-- Convert back to physical standby
DGMGRL> CONVERT DATABASE standby_db TO PHYSICAL STANDBY;
```

---

## Redo Transport and Apply

### Redo Transport

The primary database sends redo log data to standby destinations. Transport can be synchronous or asynchronous.

**SYNC (synchronous):** The primary waits for acknowledgment from the standby before completing the commit. This achieves zero data loss but introduces latency proportional to the round-trip to the standby.

**ASYNC (asynchronous):** The primary commits without waiting for standby acknowledgment. This improves performance but exposes potential data loss equal to the transport lag.

```sql
-- Configure redo transport on primary (example LOG_ARCHIVE_DEST_2)
ALTER SYSTEM SET LOG_ARCHIVE_DEST_2 =
  'SERVICE=standby_tns ASYNC NOAFFIRM
   DB_UNIQUE_NAME=standby_db
   VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE)
   COMPRESSION=ENABLE'
  SCOPE=BOTH;

ALTER SYSTEM SET LOG_ARCHIVE_DEST_STATE_2 = ENABLE SCOPE=BOTH;
```

### Redo Apply (Physical Standby)

The Managed Recovery Process (MRP) applies archived redo logs or redo sourced from standby redo logs (real-time apply).

```sql
-- Start managed recovery (on physical standby)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;

-- Start real-time apply (applies redo as it arrives, before archiving)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE
  USING CURRENT LOGFILE DISCONNECT FROM SESSION;

-- Stop managed recovery
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;

-- Check apply status
SELECT process, status, sequence#, thread#
FROM v$managed_standby
ORDER BY process;
```

### SQL Apply (Logical Standby)

```sql
-- Start SQL Apply on logical standby
ALTER DATABASE START LOGICAL STANDBY APPLY IMMEDIATE;

-- Stop SQL Apply
ALTER DATABASE STOP LOGICAL STANDBY APPLY;

-- Check SQL Apply status
SELECT status, applied_scn, latest_scn
FROM dba_logstdby_progress;
```

### Standby Redo Logs

Standby Redo Logs (SRLs) are necessary for real-time apply and for synchronous redo transport. They receive redo from the primary's current online redo logs in addition to archived logs.

```sql
-- Add standby redo log groups (on standby; should have primary group count + 1)
-- Each group should be same size as primary online redo logs
ALTER DATABASE ADD STANDBY LOGFILE GROUP 4
  ('/oradata/standby/stdby_redo04.log') SIZE 500M;

ALTER DATABASE ADD STANDBY LOGFILE GROUP 5
  ('/oradata/standby/stdby_redo05.log') SIZE 500M;

-- View standby redo logs
SELECT group#, members, bytes/1048576 size_mb, status
FROM v$standby_log;
```

---

## Data Guard Broker (DGMGRL)

Data Guard Broker is the management layer for Data Guard configurations. It automates and centralizes configuration, monitoring, and role transitions. Using Broker is strongly preferred over manual Data Guard management.

### Enabling the Broker

```sql
-- Enable on both primary and standby
ALTER SYSTEM SET dg_broker_start = TRUE SCOPE=BOTH;
```

### Creating a Broker Configuration

```bash
# Connect to DGMGRL (from primary or any host with network access)
dgmgrl sys/<password>@primary_db

DGMGRL> CREATE CONFIGURATION 'my_dg_config'
          AS PRIMARY DATABASE IS primary_db
          CONNECT IDENTIFIER IS primary_tns;

DGMGRL> ADD DATABASE standby_db
          AS CONNECT IDENTIFIER IS standby_tns
          MAINTAINED AS PHYSICAL;

DGMGRL> ENABLE CONFIGURATION;
```

### Common DGMGRL Commands

```bash
# Show full configuration and health
DGMGRL> SHOW CONFIGURATION;

# Show details for a specific database
DGMGRL> SHOW DATABASE VERBOSE standby_db;

# Show current lag
DGMGRL> SHOW DATABASE standby_db 'ApplyLag';
DGMGRL> SHOW DATABASE standby_db 'TransportLag';

# Edit a property
DGMGRL> EDIT DATABASE standby_db SET PROPERTY LogXptMode='ASYNC';
DGMGRL> EDIT DATABASE primary_db SET PROPERTY RedoRoutes='(LOCAL : standby_db ASYNC)';

# Validate the configuration
DGMGRL> VALIDATE DATABASE standby_db;
DGMGRL> VALIDATE DATABASE VERBOSE standby_db;
```

---

## Switchover vs Failover

### Switchover

A **switchover** is a planned, controlled role reversal. Both databases remain intact and no data is lost. It is used for scheduled maintenance, patching, or testing.

**Sequence of events:**
1. The primary transitions to the standby role (flushes redo, halts new connections)
2. The standby transitions to the primary role
3. Both databases are fully operational in their new roles

```bash
# Verify readiness before switchover
DGMGRL> VALIDATE DATABASE standby_db;

# Perform switchover (Broker handles both sides automatically)
DGMGRL> SWITCHOVER TO standby_db;

# Verify new configuration
DGMGRL> SHOW CONFIGURATION;
```

**Manual switchover (without Broker):**
```sql
-- On PRIMARY: initiate switchover
ALTER DATABASE COMMIT TO SWITCHOVER TO PHYSICAL STANDBY WITH SESSION SHUTDOWN;

-- On STANDBY: complete the switchover to become primary
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY WITH SESSION SHUTDOWN;
ALTER DATABASE OPEN;
```

### Failover

A **failover** is an emergency operation triggered when the primary database is unavailable or has failed and cannot be restored quickly. Data loss is possible unless the configuration uses Maximum Protection or Maximum Availability mode with synchronous redo transport and all redo has been received.

**Failover permanently promotes the standby to the new primary.** The former primary cannot be reused without first reinstating it as a standby.

```bash
# Complete failover using Broker (recommended)
DGMGRL> FAILOVER TO standby_db;

# Immediate failover bypasses applying remaining redo on the standby
# Use only when a complete failover is not possible; this can increase data loss
DGMGRL> FAILOVER TO standby_db IMMEDIATE;
```

**Manual failover (without Broker):**
```sql
-- On STANDBY: recover any remaining archived logs, then activate
RECOVER MANAGED STANDBY DATABASE CANCEL;
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE FINISH;
ALTER DATABASE ACTIVATE PHYSICAL STANDBY DATABASE;
ALTER DATABASE OPEN;
```

### Reinstating the Old Primary

After a failover, the former primary can be reinstated as a standby:

```bash
DGMGRL> REINSTATE DATABASE old_primary_db;
```

This process uses Flashback Database on the old primary to revert it to the state before the failover point, then re-synchronizes it with the new primary.

---

## Lag Monitoring

### Transport Lag and Apply Lag

- **Transport Lag:** How far the standby has fallen behind in receiving redo from the primary
- **Apply Lag:** How far the standby has fallen behind in applying received redo

```sql
-- View lag from the standby database
SELECT name, value, time_computed, datum_time
FROM v$dataguard_stats
WHERE name IN ('transport lag', 'apply lag', 'apply finish time');

-- View from primary (requires DBA_LOGSTDBY_LOG or V$ARCHIVE_DEST_STATUS)
SELECT dest_id, dest_name, status, archived_seq#, applied_seq#,
       gap_status
FROM v$archive_dest_status
WHERE target = 'STANDBY';

-- Check for archive gap
SELECT thread#, low_sequence#, high_sequence#
FROM v$archive_gap;
```

### Monitoring via DGMGRL

```bash
DGMGRL> SHOW DATABASE standby_db 'ApplyLag';
DGMGRL> SHOW DATABASE standby_db 'TransportLag';
DGMGRL> SHOW DATABASE standby_db 'RecvQEntries';
DGMGRL> SHOW DATABASE standby_db 'SendQEntries';
```

### Monitoring via Enterprise Manager

The Enterprise Manager Data Guard management page displays lag graphs, configuration topology, and alert thresholds. For automated alerting, configure EM metric thresholds on `ApplyLag` and `TransportLag`.

---

## Active Data Guard (Read Offload)

Active Data Guard (ADG) enables a physical standby database to remain open **read-only** while simultaneously applying redo from the primary. An additional Active Data Guard license is required.

**Use cases:**
- Redirect reporting queries away from the primary
- Offload backup operations to the standby rather than the primary
- Distribute read workloads globally using far sync instances

### Opening a Physical Standby Read-Only with ADG

```sql
-- On standby: open read-only while continuing to apply redo
ALTER DATABASE OPEN READ ONLY;
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE
  USING CURRENT LOGFILE DISCONNECT FROM SESSION;

-- Confirm it is applying while open
SELECT open_mode, db_unique_name FROM v$database;
-- open_mode should be: READ ONLY WITH APPLY
```

### Far Sync Instance

A Far Sync instance is a lightweight Oracle instance (no datafiles) positioned geographically near the standby. It receives synchronous redo from the primary and forwards it asynchronously to the remote standby. This approach achieves synchronous transport over a short, low-latency network segment while still protecting a geographically distant standby.

```bash
# Add a far sync instance to broker configuration
DGMGRL> ADD FAR_SYNC farsync_inst AS CONNECT IDENTIFIER IS farsync_tns;
DGMGRL> EDIT DATABASE primary_db SET PROPERTY RedoRoutes =
          '(LOCAL : farsync_inst SYNC)(farsync_inst : standby_db ASYNC)';
DGMGRL> ENABLE FAR_SYNC farsync_inst;
```

---

## Protection Modes

Data Guard protection modes govern the trade-off between data protection (zero data loss) and primary database performance and availability.

### Maximum Protection

- Requires synchronous redo transport (SYNC AFFIRM) to at least one standby
- The primary shuts down if no synchronized standby is reachable
- Guarantees zero data loss
- Introduces commit latency equivalent to the round-trip time to the standby

```sql
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION;
```

### Maximum Availability

- Requires SYNC transport; when the standby is unreachable, automatically falls back to asynchronous transport without shutting down the primary
- Zero data loss when the standby is reachable
- Optimal balance of protection and availability — the recommended choice for most production deployments

```sql
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;
```

### Maximum Performance (Default)

- Uses asynchronous transport (ASYNC)
- The primary never waits for standby acknowledgment
- Best throughput performance; potential data loss equals the transport lag
- Default mode; appropriate when a degree of data loss is tolerable

```sql
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PERFORMANCE;
```

---

## Best Practices

- **Use Data Guard Broker (DGMGRL)** for all configuration management. Managing log_archive_dest parameters manually is error-prone and hard to maintain.

- **Configure Standby Redo Logs** on both the primary and standby. They are mandatory for real-time apply and synchronous transport.

- **Use Maximum Availability** mode with SYNC transport for critical OLTP workloads where the network latency to the standby is acceptable (typically below 5ms RTT).

- **Monitor lag proactively.** A standby carrying 4 hours of apply lag delivers 4 hours of recovery time, not instant failover.

- **Test switchovers on a regular schedule** (at least quarterly). A failover procedure that has never actually been executed represents a significant unvalidated assumption.

- **Run backups from the standby** to relieve backup I/O pressure on the primary. RMAN supports backing up from a physical standby.

- **Enable Flashback Database** on the primary so the old primary can be reinstated after a failover.
  ```sql
  ALTER DATABASE FLASHBACK ON;
  ```

- **Size Standby Redo Logs correctly.** Each group should match the size of the primary online redo logs, and the standby should have (number of primary groups + 1) redo log groups per thread.

---

## Common Mistakes and How to Avoid Them

**Not configuring Standby Redo Logs**
Without SRLs, real-time apply is unavailable. Redo is only applied after archiving completes, unnecessarily increasing apply lag.

**Incorrect LOG_ARCHIVE_DEST parameter syntax**
The `VALID_FOR` attribute must align with the database role and log type. A misconfiguration causes redo transport to silently halt.

```sql
-- Correct: ship online logs when acting as primary
ALTER SYSTEM SET LOG_ARCHIVE_DEST_2 =
  'SERVICE=standby ASYNC NOAFFIRM
   DB_UNIQUE_NAME=standby
   VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE)';
```

**Forgetting to set DB_UNIQUE_NAME**
Every database in a Data Guard configuration must have a unique `DB_UNIQUE_NAME`. They may share the same `DB_NAME`.

```sql
-- Check
SELECT db_unique_name, db_name FROM v$database;
```

**Failing over without checking for gaps**
Before initiating a manual failover, always verify that no archive gaps exist:
```sql
SELECT * FROM v$archive_gap;
```

**Not enabling Flashback on the primary**
Without Flashback, reinstating the old primary after a failover requires a full rebuild from backup. Enable Flashback on the primary before any failover scenario arises.

**Treating the standby as a permanent reporting database without the ADG license**
Opening a standby read-only while suspending apply does not constitute Active Data Guard. The ADG license is required to keep apply running concurrently with an open database.

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Data Guard Concepts and Administration 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sbydb/)
- [Oracle Database 19c SQL Language Reference — ALTER DATABASE (Data Guard clauses)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ALTER-DATABASE.html)
- [Oracle Data Guard Broker 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/dgbkr/)
- [Oracle Database 19c Reference — V$DATAGUARD_STATS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-DATAGUARD_STATS.html)
