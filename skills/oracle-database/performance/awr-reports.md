# AWR Reports — Automatic Workload Repository

## Overview

The Automatic Workload Repository (AWR) is Oracle's built-in framework for collecting and analyzing performance data. It captures performance statistics at regular intervals (default: every 60 minutes) and persists them in the SYSAUX tablespace. AWR data forms the basis for diagnosing performance issues, tracking workload trends, and measuring the effect of tuning changes.

An AWR report compares two snapshots and summarizes the database activity that occurred between them. It is typically the first diagnostic tool DBAs turn to when investigating a performance incident.

**Licensing Note:** AWR is bundled with the Oracle Diagnostics Pack and requires a license beyond the base database license. Confirm your entitlement before using AWR in a production environment.

---

## Key Concepts

### Snapshots

A snapshot is a point-in-time capture of all cumulative statistics from V$ views (db block gets, parse counts, wait event totals, etc.). The AWR report derives deltas between two snapshots to characterize activity during that interval.

- Default retention: 8 days
- Default interval: 60 minutes
- Stored in: `SYSAUX` tablespace under the `SYS` schema (WRM$ and WRH$ tables)

### DB Time

**DB Time** is the most critical metric in any AWR report. It measures the total elapsed time consumed by all foreground sessions making database calls, including time spent waiting. Idle wait time is excluded.

```
DB Time = CPU Time + Non-Idle Wait Time
```

When DB Time per second exceeds the CPU count, a capacity or efficiency problem exists.

### Elapsed Time

The wall-clock length of the snapshot interval. Dividing DB Time by Elapsed Time yields the average number of active sessions (AAS):

```
AAS = DB Time (seconds) / Elapsed Time (seconds)
```

An AAS at or above your CPU count frequently indicates saturation.

---

## Snapshot Management with DBMS_WORKLOAD_REPOSITORY

### Create a Manual Snapshot

```sql
-- Create a snapshot immediately (useful before/after a change)
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT();

-- Verify it was created
SELECT snap_id, begin_interval_time, end_interval_time
FROM   dba_hist_snapshot
ORDER  BY snap_id DESC
FETCH  FIRST 5 ROWS ONLY;
```

### Modify AWR Settings

```sql
-- Change interval to 30 minutes, retain 14 days
BEGIN
  DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS(
    retention => 14 * 24 * 60,  -- minutes
    interval  => 30             -- minutes
  );
END;
/

-- Check current settings
SELECT snap_interval, retention
FROM   dba_hist_wr_control;
```

### Drop Snapshots

```sql
-- Drop snapshots in a range to reclaim SYSAUX space
BEGIN
  DBMS_WORKLOAD_REPOSITORY.DROP_SNAPSHOT_RANGE(
    low_snap_id  => 100,
    high_snap_id => 150
  );
END;
/
```

### Find Snapshot IDs for a Time Window

```sql
SELECT snap_id,
       TO_CHAR(begin_interval_time, 'YYYY-MM-DD HH24:MI') AS begin_time,
       TO_CHAR(end_interval_time,   'YYYY-MM-DD HH24:MI') AS end_time
FROM   dba_hist_snapshot
WHERE  begin_interval_time >= SYSDATE - 1
ORDER  BY snap_id;
```

---

## Generating AWR Reports

### Text Report (SQL*Plus)

```sql
-- Interactive: prompts for snap IDs and instance
@$ORACLE_HOME/rdbms/admin/awrrpt.sql

-- Non-interactive using the PL/SQL function directly
SELECT output
FROM   TABLE(
         DBMS_WORKLOAD_REPOSITORY.AWR_REPORT_TEXT(
           l_dbid      => (SELECT dbid FROM v$database),
           l_inst_num  => 1,
           l_bid       => 200,   -- begin snap ID
           l_eid       => 201    -- end snap ID
         )
       );
```

### HTML Report (preferred for readability)

```sql
SELECT output
FROM   TABLE(
         DBMS_WORKLOAD_REPOSITORY.AWR_REPORT_HTML(
           l_dbid      => (SELECT dbid FROM v$database),
           l_inst_num  => 1,
           l_bid       => 200,
           l_eid       => 201
         )
       );
```

### RAC Global AWR Report

```sql
@$ORACLE_HOME/rdbms/admin/awrgrpt.sql
```

### Compare Period Report (baseline vs. current)

```sql
@$ORACLE_HOME/rdbms/admin/awrddrpt.sql
```

---

## Reading Key Sections

### 1. Report Header

Identifies the database version, instance name, host, CPU count, and snapshot window. Always confirm these details match your target environment before interpreting the report.

### 2. Load Profile

Displays per-second and per-transaction rates for key metrics:

| Metric | What it Means |
|---|---|
| DB Time(s) | Average active sessions (divide by elapsed seconds) |
| DB CPU(s) | CPU actually consumed per second |
| Redo size | Write-heavy workload indicator |
| Logical reads | Buffer cache I/O |
| Block changes | DML activity |
| Physical reads | Actual disk I/O |
| Hard parses | Cursor reuse problems |
| Parses | Total parse calls (hard + soft) |
| Logons | Connection churn |

**A hard parse rate above 100/sec** is almost always a sign of missing bind variables or connection pool problems.

```sql
-- Validate hard parse rates from AWR history
SELECT snap_id,
       hard_parses,
       hard_parses / elapsed_time_delta * 1e6 AS hard_parses_per_sec
FROM (
  SELECT snap_id,
         value                                                   AS hard_parses,
         LAG(value) OVER (ORDER BY snap_id)                     AS prev_val,
         (end_interval_time - begin_interval_time) * 86400      AS elapsed_time_delta
  FROM   dba_hist_sysstat s
  JOIN   dba_hist_snapshot sn USING (snap_id, dbid, instance_number)
  WHERE  stat_name = 'hard parses'
    AND  snap_id BETWEEN 200 AND 220
)
WHERE prev_val IS NOT NULL;
```

### 3. Instance Efficiency Percentages

| Metric | Target | Concern If |
|---|---|---|
| Buffer Cache Hit % | > 95% | < 90% |
| Library Cache Hit % | > 99% | < 95% |
| In-memory Sort % | > 95% | < 90% |
| Soft Parse % | > 95% | < 90% |
| Execute to Parse % | > 50% | Very low value |

**Buffer Nowait %** and **Redo Nowait %** should each be close to 100%.

### 4. Top 10 Foreground Wait Events

This section ranks events by their share of DB Time consumed. Concentrate on non-idle events:

```
Event                           Waits    Time(s)  Avg wait  % DB time
------------------------------- -------- -------- --------- ---------
db file sequential read         450,321  1,823.4     4.05ms    18.2%
log file sync                    89,234    412.1     4.62ms     4.1%
buffer busy waits                12,456    234.5    18.83ms     2.3%
```

Events to watch:

| Event | Typical Cause |
|---|---|
| `db file sequential read` | Single-block I/O; index scans, row fetch |
| `db file scattered read` | Full table/index scans (multiblock reads) |
| `log file sync` | COMMIT frequency; redo log I/O |
| `buffer busy waits` | Hot blocks; segment header contention |
| `enq: TX - row lock contention` | Row-level locking; application design |
| `library cache: mutex X` | Hard parsing; cursor sharing issues |
| `latch: cache buffers chains` | Hot blocks in buffer cache |

### 5. SQL Statistics

AWR organizes Top SQL into several sub-sections:

- **SQL ordered by Elapsed Time** — the best initial starting point
- **SQL ordered by CPU Time** — queries that are CPU-intensive
- **SQL ordered by Gets** — statements with high logical I/O
- **SQL ordered by Reads** — statements with heavy physical I/O
- **SQL ordered by Executions** — high-frequency statements; even lightweight SQL can dominate at scale
- **SQL ordered by Parse Calls** — indicators of cursor reuse problems

For each SQL entry, record the SQL ID, execution count, elapsed time per execution, and the opening lines of the SQL text.

```sql
-- Pull top SQL from AWR history programmatically
SELECT sql_id,
       ROUND(elapsed_time_total / 1e6, 2)          AS total_elapsed_sec,
       executions_total,
       ROUND(elapsed_time_total / NULLIF(executions_total,0) / 1e6, 4) AS avg_elapsed_sec,
       SUBSTR(sql_text, 1, 80)                      AS sql_text
FROM   dba_hist_sqlstat
JOIN   dba_hist_sqltext USING (sql_id, dbid)
WHERE  snap_id BETWEEN 200 AND 201
ORDER  BY elapsed_time_total DESC
FETCH  FIRST 20 ROWS ONLY;
```

### 6. Segments Statistics

Reports which segments are consuming the most I/O and buffer gets, helping identify hot tables and indexes.

### 7. Dictionary Cache and Library Cache

Elevated miss ratios in these sections indicate shared pool pressure.

```sql
-- Current library cache performance
SELECT namespace,
       gets,
       gethits,
       ROUND(gethitratio * 100, 2) AS hit_pct,
       pins,
       pinhits,
       ROUND(pinhitratio * 100, 2) AS pin_hit_pct,
       reloads,
       invalidations
FROM   v$librarycache
ORDER  BY gets DESC;

-- Dictionary cache misses (should be < 2%)
SELECT parameter,
       gets,
       getmisses,
       ROUND(getmisses / NULLIF(gets,0) * 100, 2) AS miss_pct
FROM   v$rowcache
WHERE  gets > 0
ORDER  BY getmisses DESC
FETCH  FIRST 15 ROWS ONLY;
```

---

## Identifying Bottlenecks from AWR

### CPU Bound

- DB CPU approaching or exceeding DB Time
- Elevated Parse CPU and execute CPU consumption
- Look for full table scans, absent indexes, or poorly written SQL

### I/O Bound

- `db file sequential read` or `db file scattered read` ranked near the top of wait events
- High physical read rate in the Load Profile
- Examine Top SQL by Reads and evaluate indexing or storage tuning options

### Contention Bound

- `buffer busy waits`, `enq:` waits, and latch waits are dominant
- Frequently rooted in application design problems such as hot sequences or the need for reverse-key indexes

### Memory Pressure

- High soft parse miss rate or library cache misses exceeding 1%
- `free buffer waits` appearing in wait events, signaling an undersized buffer cache
- Elevated `paged-in` values in the OS statistics section

### Redo / Commit Overhead

- `log file sync` present in the top wait events
- High redo size per second in the Load Profile
- Evaluate async commit, grouping commits into batches, or upgrading to faster storage

---

## AWR Baselines

Baselines lock snapshot ranges so they are exempt from the standard retention purge cycle. This allows period comparison reports to be generated against preserved data.

```sql
-- Create a fixed baseline
BEGIN
  DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(
    start_snap_id => 200,
    end_snap_id   => 210,
    baseline_name => 'PRE_PATCH_BASELINE',
    expiration    => 30  -- days; NULL = never expire
  );
END;
/

-- List existing baselines
SELECT baseline_name, start_snap_id, end_snap_id, expiration
FROM   dba_hist_baseline;

-- Drop a baseline
BEGIN
  DBMS_WORKLOAD_REPOSITORY.DROP_BASELINE(
    baseline_name => 'PRE_PATCH_BASELINE',
    cascade       => FALSE  -- TRUE also drops the snapshots
  );
END;
/
```

---

## Best Practices

- **Capture a snapshot before and after every change** (patch, schema modification, parameter update) so a precise before/after report can be produced.
- **Prefer the HTML report** for interactive analysis; the text version suits automated parsing.
- **Focus on DB Time contribution**, not raw wait counts. An event with millions of waits but negligible elapsed time is not the bottleneck.
- **Cross-reference AWR data with OS statistics.** CPU utilization, memory paging, and disk I/O from the OS section can corroborate or challenge in-database metrics.
- **Extend retention on critical systems** to at least 30 days and maintain baselines for significant milestones such as pre- and post-upgrade periods.
- **Avoid snapshot intervals below 15 minutes** on heavily loaded systems; the additional SYSAUX write activity adds measurable overhead.
- **Track SYSAUX space consumption.** AWR data volume grows with retention duration and snapshot frequency. Query `v$sysaux_occupants` to assess AWR's footprint.

```sql
-- Check AWR space usage in SYSAUX
SELECT occupant_name,
       schema_name,
       ROUND(space_usage_kbytes / 1024, 2) AS space_mb
FROM   v$sysaux_occupants
WHERE  occupant_name LIKE 'SM/%'
ORDER  BY space_usage_kbytes DESC;
```

---

## Common Mistakes

| Mistake | Problem | Correction |
|---|---|---|
| Comparing snapshots that span a DST change | Elapsed time is distorted | Account for timezone transitions; prefer UTC-based timestamps |
| Using a 1-hour snapshot window to investigate a 5-minute spike | The spike is averaged out | Take a targeted manual snapshot around the incident; use ASH for sub-minute analysis |
| Ignoring the "per transaction" column | Misses shifts in workload characterization | Compare both per-second and per-transaction rates |
| Sorting by wait count rather than wait time | Leads to misleading conclusions | Always use the Time(s) column as the primary sort key |
| Neglecting to check SQL execution count | A seemingly slow statement may run 1 million times at low cost each | Multiply average elapsed time by execution count to derive total impact |
| Treating Buffer Cache Hit % as authoritative | A 99% hit ratio can coexist with significant I/O pressure on large workloads | Verify physical reads per second in absolute terms |
| Applying AWR to sub-minute incidents | Snapshot granularity is too coarse | Use ASH (`V$ACTIVE_SESSION_HISTORY`) for real-time drilldown |

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database 19c Performance Tuning Guide (TGDBA)](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgdba/)
- [DBMS_WORKLOAD_REPOSITORY — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_WORKLOAD_REPOSITORY.html)
- [DBA_HIST_SNAPSHOT — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_HIST_SNAPSHOT.html)
- [DBA_HIST_WR_CONTROL — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_HIST_WR_CONTROL.html)
- [DBA_HIST_SQLSTAT — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_HIST_SQLSTAT.html)
- [V$LIBRARYCACHE — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-LIBRARYCACHE.html)
- [V$ROWCACHE — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-ROWCACHE.html)
