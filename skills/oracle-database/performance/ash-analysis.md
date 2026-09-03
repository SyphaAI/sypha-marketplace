# ASH Analysis — Active Session History

## Overview

Active Session History (ASH) is Oracle's in-memory repository of sampled session activity. Each second, Oracle captures a snapshot of every active (non-idle) session and writes one row per session into a circular in-memory buffer (`V$ACTIVE_SESSION_HISTORY`). Data flushed from this buffer to disk is persisted in `DBA_HIST_ACTIVE_SESS_HISTORY` and retained as part of AWR.

ASH bridges the gap between AWR (coarse-grained, snapshot-level) and real-time V$ views (which reflect only the current instant). It makes retrospective, second-by-second analysis possible without any requirement for continuous monitoring.

**Licensing Note:** ASH is included in the Oracle Diagnostics Pack and requires a license separate from the base database license.

---

## Key Concepts

### Sampling Mechanics

- Oracle samples all active (non-idle) sessions **once per second**
- Every sample row records: session ID, SQL ID, wait event, object accessed, user, module, action, plan hash value, blocking session, and additional fields
- The in-memory buffer retains roughly **1 hour** of data before older entries are flushed to disk
- The disk-resident `DBA_HIST_ACTIVE_SESS_HISTORY` keeps a **1-in-10 subsample** of ASH data (one row per every 10th second) for long-term storage

### AAS (Average Active Sessions)

This is the principal metric derived from ASH. Tally the ASH rows within a time window and divide by the number of elapsed seconds:

```
AAS = COUNT(ash_rows) / seconds_in_window
```

When AAS exceeds your CPU count, the database is over-saturated. Breaking AAS down by wait class or event shows exactly where time is being consumed.

### Session States

Each ASH row carries a `SESSION_STATE` value:
- `ON CPU` — the session was using CPU at the moment of sampling
- `WAITING` — the session was blocked on a specific event

The `WAIT_CLASS` and `EVENT` columns provide further classification for waiting sessions.

---

## Core Views

### V$ACTIVE_SESSION_HISTORY (In-Memory, Real-Time)

Covers roughly the last hour of sampled data, with one row per sample.

```sql
-- Schema preview
DESC v$active_session_history
```

Key columns:

| Column | Description |
|---|---|
| `SAMPLE_TIME` | Timestamp of the sample (1-second resolution) |
| `SESSION_ID` | SID of the sampled session |
| `SESSION_SERIAL#` | Serial number to uniquely identify session |
| `USER_ID` | Numeric user ID |
| `SQL_ID` | SQL being executed at sample time |
| `SQL_PLAN_HASH_VALUE` | Plan being used |
| `SESSION_STATE` | `ON CPU` or `WAITING` |
| `WAIT_CLASS` | Category of wait event |
| `EVENT` | Specific wait event name |
| `CURRENT_OBJ#` | Object being accessed |
| `CURRENT_FILE#` | Datafile number |
| `CURRENT_BLOCK#` | Block number (for I/O waits) |
| `BLOCKING_SESSION` | SID of the blocker (for lock waits) |
| `MODULE` | Application module name |
| `ACTION` | Application action name |
| `PROGRAM` | Client program name |
| `MACHINE` | Client machine name |
| `PGA_ALLOCATED` | PGA memory at sample time |
| `TEMP_SPACE_ALLOCATED` | Temp space at sample time |

### DBA_HIST_ACTIVE_SESS_HISTORY (Disk-Based, Historical)

Shares the same structure as `V$ACTIVE_SESSION_HISTORY` but adds columns (`SNAP_ID`, `DBID`, `INSTANCE_NUMBER`) and samples at 1/10th the frequency.

---

## Real-Time ASH Analysis

### Current Activity Snapshot

```sql
-- What is happening right now (last 5 minutes)
SELECT event,
       COUNT(*) AS samples,
       ROUND(COUNT(*) / (5*60), 2) AS avg_active_sessions,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct_total
FROM   v$active_session_history
WHERE  sample_time > SYSDATE - 5/1440
  AND  session_type = 'FOREGROUND'
GROUP  BY event
ORDER  BY samples DESC;
```

### Top SQL by ASH (Last 30 Minutes)

```sql
SELECT ash.sql_id,
       COUNT(*)                                    AS samples,
       ROUND(COUNT(*) / (30*60), 2)               AS aas,
       SUBSTR(st.sql_text, 1, 80)                 AS sql_text
FROM   v$active_session_history ash
LEFT   JOIN v$sql st ON ash.sql_id = st.sql_id
WHERE  ash.sample_time > SYSDATE - 30/1440
  AND  ash.session_type = 'FOREGROUND'
GROUP  BY ash.sql_id, SUBSTR(st.sql_text, 1, 80)
ORDER  BY samples DESC
FETCH  FIRST 15 ROWS ONLY;
```

### Top SQL by Wait Class (Last Hour)

```sql
SELECT sql_id,
       wait_class,
       COUNT(*)                              AS samples,
       ROUND(COUNT(*) / 3600, 2)            AS aas
FROM   v$active_session_history
WHERE  sample_time > SYSDATE - 1/24
  AND  session_type = 'FOREGROUND'
  AND  wait_class != 'Idle'
GROUP  BY sql_id, wait_class
ORDER  BY samples DESC
FETCH  FIRST 20 ROWS ONLY;
```

### Active Session Trend (Per-Minute Breakdown)

```sql
-- AAS per minute for the last hour — spot the spike
SELECT TRUNC(sample_time, 'MI')           AS sample_minute,
       COUNT(*)                           AS samples,
       ROUND(COUNT(*) / 60, 2)           AS aas,
       SUM(CASE WHEN session_state = 'ON CPU' THEN 1 ELSE 0 END) AS cpu_samples,
       SUM(CASE WHEN session_state = 'WAITING' THEN 1 ELSE 0 END) AS wait_samples
FROM   v$active_session_history
WHERE  sample_time > SYSDATE - 1/24
  AND  session_type = 'FOREGROUND'
GROUP  BY TRUNC(sample_time, 'MI')
ORDER  BY sample_minute;
```

### Blocking Session Analysis

```sql
-- Find blocking chains from ASH
SELECT sample_time,
       session_id,
       blocking_session,
       event,
       sql_id,
       seconds_in_wait
FROM   v$active_session_history
WHERE  blocking_session IS NOT NULL
  AND  sample_time > SYSDATE - 30/1440
ORDER  BY sample_time DESC, seconds_in_wait DESC;
```

### Per-Session Activity

```sql
-- What was a specific session doing over the last hour?
SELECT sample_time,
       sql_id,
       session_state,
       event,
       wait_class,
       seconds_in_wait
FROM   v$active_session_history
WHERE  session_id     = :p_sid
  AND  session_serial# = :p_serial
  AND  sample_time > SYSDATE - 1/24
ORDER  BY sample_time;
```

---

## Historical ASH Analysis

For events that occurred more than approximately 1 hour ago, query `DBA_HIST_ACTIVE_SESS_HISTORY`. Keep in mind that this view provides only 1/10th the sampling resolution of the in-memory view.

### Top Wait Events During a Past Incident

```sql
-- Analyze an incident window: e.g., 2:00 AM to 3:00 AM yesterday
SELECT event,
       wait_class,
       COUNT(*)                              AS samples,
       ROUND(COUNT(*) * 10 / 3600, 2)       AS approx_aas  -- multiply by 10 for 1-in-10 sample
FROM   dba_hist_active_sess_history
WHERE  sample_time BETWEEN
         TO_TIMESTAMP('2026-03-05 02:00:00', 'YYYY-MM-DD HH24:MI:SS')
         AND
         TO_TIMESTAMP('2026-03-05 03:00:00', 'YYYY-MM-DD HH24:MI:SS')
  AND  session_type = 'FOREGROUND'
  AND  wait_class  != 'Idle'
GROUP  BY event, wait_class
ORDER  BY samples DESC;
```

### Historical Top SQL

```sql
SELECT ash.sql_id,
       COUNT(*) * 10                                   AS approx_seconds,  -- adjust for 1-in-10
       ROUND(COUNT(*) * 10 / 3600, 2)                 AS aas,
       SUBSTR(sql.sql_text, 1, 100)                   AS sql_text
FROM   dba_hist_active_sess_history ash
JOIN   dba_hist_sqltext sql USING (sql_id, dbid)
WHERE  ash.sample_time BETWEEN
         TO_TIMESTAMP('2026-03-05 02:00:00', 'YYYY-MM-DD HH24:MI:SS')
         AND
         TO_TIMESTAMP('2026-03-05 03:00:00', 'YYYY-MM-DD HH24:MI:SS')
  AND  ash.session_type = 'FOREGROUND'
GROUP  BY ash.sql_id, SUBSTR(sql.sql_text, 1, 100)
ORDER  BY approx_seconds DESC
FETCH  FIRST 20 ROWS ONLY;
```

### Per-Object Hot Spot Analysis

```sql
-- Which objects (tables/indexes) were causing the most I/O waits?
SELECT o.owner,
       o.object_name,
       o.object_type,
       COUNT(*)           AS wait_samples
FROM   dba_hist_active_sess_history ash
JOIN   dba_objects o ON o.object_id = ash.current_obj#
WHERE  ash.sample_time > SYSDATE - 1
  AND  ash.wait_class = 'User I/O'
  AND  ash.current_obj# > 0
GROUP  BY o.owner, o.object_name, o.object_type
ORDER  BY wait_samples DESC
FETCH  FIRST 15 ROWS ONLY;
```

### Time-Series Breakdown by Wait Class

```sql
-- Stacked area chart data: activity breakdown per 5-minute bucket
SELECT TRUNC(sample_time, 'HH24') +
         FLOOR(TO_NUMBER(TO_CHAR(sample_time,'MI')) / 5) * 5 / 1440 AS bucket,
       wait_class,
       COUNT(*) * 10 AS approx_seconds
FROM   dba_hist_active_sess_history
WHERE  sample_time > SYSDATE - 7
  AND  session_type = 'FOREGROUND'
  AND  wait_class  != 'Idle'
GROUP  BY TRUNC(sample_time, 'HH24') +
            FLOOR(TO_NUMBER(TO_CHAR(sample_time,'MI')) / 5) * 5 / 1440,
          wait_class
ORDER  BY bucket, wait_class;
```

---

## ASH Report Generation

Oracle ships a built-in report script that generates a formatted ASH analysis report styled similarly to an AWR report:

```sql
-- Interactive script (prompts for time range or snap IDs)
@$ORACLE_HOME/rdbms/admin/ashrpt.sql

-- Programmatic HTML report
SELECT output
FROM   TABLE(
         DBMS_WORKLOAD_REPOSITORY.ASH_REPORT_HTML(
           l_dbid       => (SELECT dbid FROM v$database),
           l_inst_num   => 1,
           l_btime      => TO_DATE('2026-03-05 02:00','YYYY-MM-DD HH24:MI'),
           l_etime      => TO_DATE('2026-03-05 03:00','YYYY-MM-DD HH24:MI')
         )
       );

-- Programmatic text report
SELECT output
FROM   TABLE(
         DBMS_WORKLOAD_REPOSITORY.ASH_REPORT_TEXT(
           l_dbid       => (SELECT dbid FROM v$database),
           l_inst_num   => 1,
           l_btime      => TO_DATE('2026-03-05 02:00','YYYY-MM-DD HH24:MI'),
           l_etime      => TO_DATE('2026-03-05 03:00','YYYY-MM-DD HH24:MI')
         )
       );
```

### ASH Report Key Sections

1. **Top User Events** — events that consumed the greatest share of sampled time
2. **Top Background Events** — LGWR, DBWR, CKPT activity
3. **Top SQL with Top Events** — SQL IDs ranked by sampled time, paired with their associated waits
4. **Top SQL with Top Row Sources** — identifies which portion of the plan consumed the most time
5. **Top Sessions** — sessions that used the most time overall
6. **Top Objects/Files/Latches** — hot spots at the object level
7. **Activity Over Time** — a time-series view for pinpointing when a problem began and ended

---

## Identifying Session-Level Bottlenecks

### Scenario: "User reports query was slow between 9:00 and 9:15 AM"

```sql
-- Step 1: Confirm activity spike
SELECT TRUNC(sample_time, 'MI') AS minute,
       COUNT(*)                 AS samples
FROM   dba_hist_active_sess_history
WHERE  sample_time BETWEEN
         TO_TIMESTAMP('2026-03-06 09:00:00','YYYY-MM-DD HH24:MI:SS')
         AND
         TO_TIMESTAMP('2026-03-06 09:15:00','YYYY-MM-DD HH24:MI:SS')
  AND  session_type = 'FOREGROUND'
GROUP  BY TRUNC(sample_time, 'MI')
ORDER  BY minute;

-- Step 2: Find the top SQL during the incident
SELECT sql_id, COUNT(*) AS samples
FROM   dba_hist_active_sess_history
WHERE  sample_time BETWEEN
         TO_TIMESTAMP('2026-03-06 09:00:00','YYYY-MM-DD HH24:MI:SS')
         AND
         TO_TIMESTAMP('2026-03-06 09:15:00','YYYY-MM-DD HH24:MI:SS')
  AND  session_type = 'FOREGROUND'
GROUP  BY sql_id
ORDER  BY samples DESC
FETCH  FIRST 10 ROWS ONLY;

-- Step 3: Find the user/session involved
SELECT session_id, user_id, module, action, program, machine,
       COUNT(*) AS samples
FROM   dba_hist_active_sess_history
WHERE  sql_id = :suspect_sql_id
  AND  sample_time BETWEEN
         TO_TIMESTAMP('2026-03-06 09:00:00','YYYY-MM-DD HH24:MI:SS')
         AND
         TO_TIMESTAMP('2026-03-06 09:15:00','YYYY-MM-DD HH24:MI:SS')
GROUP  BY session_id, user_id, module, action, program, machine
ORDER  BY samples DESC;

-- Step 4: Determine what the session was waiting on
SELECT event, COUNT(*) AS samples
FROM   dba_hist_active_sess_history
WHERE  sql_id = :suspect_sql_id
  AND  sample_time BETWEEN
         TO_TIMESTAMP('2026-03-06 09:00:00','YYYY-MM-DD HH24:MI:SS')
         AND
         TO_TIMESTAMP('2026-03-06 09:15:00','YYYY-MM-DD HH24:MI:SS')
GROUP  BY event
ORDER  BY samples DESC;
```

### Scenario: Finding the Root Blocker

```sql
-- Reconstruct a blocking chain from ASH
SELECT LPAD(' ', 2*(LEVEL-1)) || session_id AS session_tree,
       blocking_session,
       event,
       sql_id,
       sample_time
FROM   v$active_session_history
WHERE  sample_time > SYSDATE - 10/1440
START  WITH blocking_session IS NULL
       AND  session_state = 'WAITING'
       AND  wait_class   != 'Idle'
CONNECT BY PRIOR session_id = blocking_session
       AND PRIOR sample_time = sample_time
ORDER  SIBLINGS BY session_id;
```

---

## ASH vs AWR: When to Use Each

| Scenario | Use |
|---|---|
| Incident occurred in the last 60 minutes | `V$ACTIVE_SESSION_HISTORY` |
| Incident occurred up to 8-30 days ago | `DBA_HIST_ACTIVE_SESS_HISTORY` |
| Need second-by-second granularity | `V$ACTIVE_SESSION_HISTORY` |
| Need to understand overall workload trends | AWR report |
| Need to identify exactly which SQL was slow | ASH (SQL_ID per sample) |
| Need to prove a regression across releases | AWR compare-period report |
| Need < 10-second resolution for old data | Not possible; only in-memory ASH has 1s resolution |

---

## Best Practices

- **Tag incidents with module/action.** When application code calls `DBMS_APPLICATION_INFO.SET_MODULE` and `SET_ACTION`, the resulting ASH data becomes far more useful for post-incident investigation.
- **Avoid purging ASH data without good reason.** Because disk storage retains only 1-in-10 samples, each row carries significant weight for historical analysis.
- **Always include `session_type = 'FOREGROUND'` in filters** unless you specifically need to examine background process behavior. Background waits typically represent system housekeeping, not user-visible performance issues.
- **Apply the 10x multiplier** when comparing in-memory and disk-based ASH. `V$ACTIVE_SESSION_HISTORY` contains every sample; `DBA_HIST` retains only 1/10th of them.
- **Pair ASH findings with SQL execution plans.** After identifying the top SQL_ID from ASH, retrieve the historical plan using `DBMS_XPLAN.DISPLAY_AWR` (or `DISPLAY_WORKLOAD_REPOSITORY` in 23c+).

```sql
-- Pull a historical execution plan for a SQL found in ASH
-- Note: DISPLAY_AWR is deprecated in Oracle 23ai+; use DISPLAY_WORKLOAD_REPOSITORY for new code
SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY_AWR(
    sql_id        => 'abc123xyz',
    plan_hash_value => NULL,  -- NULL = show all plans
    db_id         => NULL,
    format        => 'TYPICAL'
  )
);
```

---

## Common Mistakes

| Mistake | Impact | Fix |
|---|---|---|
| Omitting `session_type = 'FOREGROUND'` | Background process waits contaminate the results | Always add this filter |
| Skipping the 10x multiplier for `DBA_HIST` | AAS values appear 10x smaller than actual | Multiply row counts by 10 for disk-based data |
| Querying `DBA_HIST` for the past 5 minutes | Rows may not have been flushed yet | Use `V$ACTIVE_SESSION_HISTORY` for recent activity |
| Treating each ASH sample as exactly 1 second | Sampling jitter exists under GC pauses or heavy load | Aggregate over time ranges rather than relying on per-row timing |
| Ignoring `CURRENT_OBJ#` for I/O waits | Hot object goes unidentified | Join to `DBA_OBJECTS` to surface the affected segment |
| Treating `BLOCKING_SESSION` as the root cause | The blocker may itself be blocked by another session | Walk the full chain; the true root is a session not waiting on any other session |

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database 19c Performance Tuning Guide (TGDBA)](https://docs.oracle.com/en/database/oracle/oracle-database/19/tgdba/)
- [V$ACTIVE_SESSION_HISTORY — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-ACTIVE_SESSION_HISTORY.html)
- [DBA_HIST_ACTIVE_SESS_HISTORY — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_HIST_ACTIVE_SESS_HISTORY.html)
- [DBMS_WORKLOAD_REPOSITORY — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_WORKLOAD_REPOSITORY.html)
- [DBMS_XPLAN — Oracle Database 19c PL/SQL Packages and Types Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_XPLAN.html)
