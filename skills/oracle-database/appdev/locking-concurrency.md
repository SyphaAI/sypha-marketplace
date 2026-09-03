# Locking and Concurrency in Oracle Database

## Overview

Oracle's concurrency model differs fundamentally from most other databases. Its Multi-Version Concurrency Control (MVCC) implementation guarantees that **readers never block writers and writers never block readers**. This removes an entire category of contention problems common in other databases, though Oracle still employs locks for write-write conflicts and explicit locking scenarios.

A solid understanding of Oracle's locking architecture is essential for building applications that scale under concurrent load without deadlocks or excessive contention.

---

## Multi-Version Concurrency Control (MVCC)

### How MVCC Works in Oracle

When a row is modified, Oracle does not overwrite the old data in place. Instead:

1. The new row version is written to the data block
2. Instructions for reconstructing the old row version are saved in the **undo tablespace** (rollback segments)
3. Readers that require the previous version rebuild it from undo data on demand

This produces a "time-travel" capability: every read sees a **consistent snapshot** of the database as it existed at the query's start SCN (System Change Number), regardless of concurrent writers.

```sql
-- Check current SCN
SELECT current_scn FROM v$database;

-- Query data as it existed at a specific SCN (Flashback Query)
SELECT * FROM orders AS OF SCN 12345678;

-- Query as of a timestamp
SELECT * FROM orders AS OF TIMESTAMP (SYSTIMESTAMP - INTERVAL '5' MINUTE);
```

### Read Consistency Guarantees

| Scenario | Oracle Behavior |
|---|---|
| Reader vs. Writer (same rows) | No blocking; reader sees pre-change data via undo |
| Writer vs. Reader (same rows) | No blocking; writer proceeds, reader uses undo |
| Writer vs. Writer (same row) | Writer 2 blocks until Writer 1 commits or rolls back |
| Long-running read (undo recycled) | `ORA-01555: snapshot too old` |

### ORA-01555: Snapshot Too Old

This error is raised when Oracle cannot reconstruct a previous row version because the undo data has already been overwritten (undo retention exceeded). Prevention strategies:

```sql
-- Check current undo retention setting
SHOW PARAMETER undo_retention;

-- Increase undo retention (seconds)
ALTER SYSTEM SET UNDO_RETENTION = 3600;  -- 1 hour

-- Check undo advisor recommendation
SELECT d.undoblks, d.maxquerylen, d.tuned_undoretention
FROM   v$undostat d
WHERE  rownum <= 1;

-- Increase current or potential size of undo tablespace
ALTER DATABASE DATAFILE '<undo file>' RESIZE | AUTOEXEND;

-- Enable undo retention guarantee (prevents undo from being overwritten)
ALTER TABLESPACE undotbs1 RETENTION GUARANTEE;
```

---

## Row-Level Locking

Oracle automatically acquires row-level locks on every row that is `INSERT`ed, `UPDATE`d, or `DELETE`d. These locks are:

- **Exclusive (X mode)**: held by the session performing the modification
- **Released only at COMMIT or ROLLBACK**
- Stored within the data block itself (no separate lock table), making them effectively free regardless of the number of rows locked

```sql
-- View current row locks
SELECT o.object_name, l.session_id, l.locked_mode,
       s.username, s.status, s.sql_id
FROM   v$locked_object l
JOIN   dba_objects o ON l.object_id = o.object_id
JOIN   v$session s ON l.session_id = s.sid
ORDER  BY o.object_name;
```

### Lock Modes

| Mode Code | Name | Description |
|---|---|---|
| 0 | None | |
| 1 | Null (N) | Sub-shared; almost no restriction |
| 2 | Row Share (SS) | SELECT FOR UPDATE, or DML in progress |
| 3 | Row Exclusive (SX) | DML in progress on table |
| 4 | Share (S) | `LOCK TABLE ... IN SHARE MODE` |
| 5 | Share Row Exclusive (SSX) | |
| 6 | Exclusive (X) | `LOCK TABLE ... IN EXCLUSIVE MODE`, DDL |

---

## SELECT FOR UPDATE

`SELECT FOR UPDATE` locks the selected rows immediately, before any DML is issued. It is the primary mechanism for **pessimistic locking** — reserving rows for modification before the new values have been determined.

### Basic Syntax

```sql
-- Lock all selected rows; wait indefinitely for any already-locked rows
SELECT account_id, balance
FROM   accounts
WHERE  account_id IN (1001, 2001)
FOR UPDATE;

-- Lock and process
DECLARE
    v_balance accounts.balance%TYPE;
BEGIN
    SELECT balance INTO v_balance
    FROM   accounts
    WHERE  account_id = 1001
    FOR UPDATE;  -- row is now locked exclusively

    IF v_balance >= 500 THEN
        UPDATE accounts SET balance = balance - 500 WHERE account_id = 1001;
        UPDATE accounts SET balance = balance + 500 WHERE account_id = 2001;
        COMMIT;
    ELSE
        --
        -- Generally a rollback should be used here, because the PL/SQL error
        -- will automatically roll back changes made in the PL/SQL block, and a rollback
        -- will also roll back any outstanding made BEFORE this block was called which
        -- is typically not the desired behaviour
        --
        --ROLLBACK;
        --
        RAISE_APPLICATION_ERROR(-20001, 'Insufficient funds');
    END IF;
END;
```

### NOWAIT — Fail Immediately If Locked

```sql
-- Raise ORA-00054 immediately if any row is already locked
SELECT product_id, stock_qty
FROM   inventory
WHERE  product_id = 42
FOR UPDATE NOWAIT;

-- Handle in application
DECLARE
    v_qty NUMBER;
BEGIN
    BEGIN
        SELECT stock_qty INTO v_qty FROM inventory WHERE product_id = 42 FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN resource_busy THEN  -- ORA-00054
            RAISE_APPLICATION_ERROR(-20002, 'Product is being updated by another user. Please try again.');
    END;

    IF v_qty > 0 THEN
        UPDATE inventory SET stock_qty = stock_qty - 1 WHERE product_id = 42;
        COMMIT;
    END IF;
END;
```

### WAIT n — Wait Up to N Seconds

```sql
-- Wait up to 5 seconds for the lock; then raise ORA-30006
SELECT order_id, status
FROM   orders
WHERE  order_id = 9999
FOR UPDATE WAIT 5;
```

### SKIP LOCKED — Non-Blocking Queue Processing

`SKIP LOCKED` is highly effective for implementing work queues. It bypasses rows that are already locked rather than waiting on them, enabling multiple workers to process the queue concurrently without contention.

```sql
-- Worker process: claim the next available pending job
DECLARE
    l_job_id   NUMBER;
    l_payload  VARCHAR2(4000);
    l_rc       SYS_REFCURSOR;
BEGIN
    open l_rc for
      SELECT job_id, payload
      FROM   job_queue
      WHERE  status = 'PENDING'
      ORDER  BY created_at
      FOR UPDATE SKIP LOCKED;

    FETCH l_rc INTO l_job_id, l_payload;
    EXIT WHEN l_rc%NOTFOUND;

    -- Mark as in-progress
    UPDATE job_queue SET status = 'PROCESSING', started_at = SYSTIMESTAMP
    WHERE  job_id = l_job_id;

    COMMIT;

    -- Process the job (outside the lock)
    process_job(l_job_id, l_payload);

    -- Mark complete
    UPDATE job_queue SET status = 'DONE', completed_at = SYSTIMESTAMP
    WHERE  job_id = l_job_id;
    COMMIT;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        NULL;  -- No jobs available
END;
```

will not behave correctly. It fetches one PENDING row (which may already be locked by another process), attempts to lock it, then skips it — returning no rows.

Multiple instances of this worker can execute concurrently with no inter-process coordination required; Oracle manages the row-level locking automatically.

A frequent error when using SKIP LOCKED is applying ROWNUM to limit the returned rows. For example:

```sql
    SELECT job_id, payload INTO l_job_id, l_payload
    FROM   job_queue
    WHERE  status = 'PENDING'
    AND    ROWNUM = 1
    FOR UPDATE SKIP LOCKED;
```

---

## Deadlock Detection and Avoidance

A **deadlock** occurs when two or more sessions each hold a lock that the other session is waiting to acquire.

Oracle detects deadlocks automatically using a background cycle-detection algorithm. Upon detection:
- One session receives `ORA-00060: deadlock detected while waiting for resource`
- Oracle rolls back **only the statement** that triggered the error (not the full transaction)
- The affected session must either re-execute the statement or roll back the entire transaction

```sql
-- Deadlock scenario
-- Session 1                           Session 2
UPDATE t SET v=1 WHERE id=1;  -- OK
                                UPDATE t SET v=2 WHERE id=2;  -- OK
UPDATE t SET v=3 WHERE id=2;  -- WAITS
                                UPDATE t SET v=4 WHERE id=1;  -- WAITS -> DEADLOCK
                                -- Session 2 receives ORA-00060
```

### Deadlock Alert Log

Oracle records deadlock traces in the alert log and a trace file:

```bash
# Find deadlock traces
grep -l "deadlock" $ORACLE_BASE/diag/rdbms/*/trace/*.trc | tail -5
```

```sql
-- Check recent deadlocks in unified auditing / alert log
SELECT value FROM v$diag_info WHERE name = 'Default Trace File';
```

### Deadlock Avoidance Strategies

**Strategy 1: Consistent Lock Ordering**

Always acquire locks in the same order across all code paths:

```sql
-- WRONG: different order creates deadlock potential
-- Path A: locks order 1, then order 2
-- Path B: locks order 2, then order 1

-- RIGHT: always lock in ascending order
-- Both paths: lock lower ID first, then higher ID
SELECT * FROM orders WHERE order_id IN (1, 2) ORDER BY order_id FOR UPDATE;
```

**Strategy 2: Lock at the Start of a Transaction**

Acquire all needed locks upfront rather than incrementally:

```sql
-- Lock all rows the transaction will need before doing any computation
SELECT account_id, balance
FROM   accounts
WHERE  account_id IN (:from_acct, :to_acct)
ORDER  BY account_id  -- consistent ordering
FOR UPDATE;
```

**Strategy 3: Use NOWAIT / Short WAIT**

Convert waiting deadlocks into immediately-handled exceptions:

```sql
BEGIN
    SELECT * FROM resource_table WHERE resource_id = :id FOR UPDATE NOWAIT;
    -- ... process ...
    COMMIT;
EXCEPTION
    WHEN resource_busy THEN
        -- Retry after brief delay, or queue the work
        log_retry('Resource busy, retrying...');
        DBMS_SESSION.SLEEP(0.5);
        -- retry logic
END;
```

**Strategy 4: Minimize Transaction Duration**

The longer a transaction holds locks, the more opportunity for deadlocks.

---

## Table Locks

Oracle acquires **table-level locks (TM locks)** alongside row locks. Table locks prevent conflicting DDL while DML is in progress, but they do NOT block concurrent DML unless explicitly escalated.

### Explicit Table Locking

```sql
-- Lock entire table to prevent concurrent modifications
-- (blocks other DML; use sparingly)
LOCK TABLE orders IN EXCLUSIVE MODE;
LOCK TABLE orders IN EXCLUSIVE MODE NOWAIT;  -- fail if locked

-- Share mode: prevents DML but allows concurrent readers
LOCK TABLE orders IN SHARE MODE;

-- Row exclusive: default mode acquired automatically during DML
LOCK TABLE orders IN ROW EXCLUSIVE MODE;
```

### When Table Locks Are Needed

`EXCLUSIVE MODE` table locks are rarely appropriate in application code. The main use cases are:
- Bulk load operations where all concurrent DML must be prevented
- Schema changes where ONLINE DDL is not available
- Explicit synchronization within ETL processes

```sql
-- ETL pattern: lock staging table exclusively for safe swap
BEGIN
    LOCK TABLE staging_orders IN EXCLUSIVE MODE NOWAIT;

    -- Merge staging into production
    MERGE INTO production_orders p
    USING staging_orders s ON (p.order_id = s.order_id)
    WHEN MATCHED THEN UPDATE SET p.status = s.status
    WHEN NOT MATCHED THEN INSERT VALUES (s.order_id, s.status, s.created_at);

    DELETE FROM staging_orders;
    COMMIT;
EXCEPTION
    WHEN resource_busy THEN
        RAISE_APPLICATION_ERROR(-20010, 'Staging table is locked; ETL already running?');
END;
```

---

## Lock Monitoring Queries

### Active Locks and Blocked Sessions

```sql
-- Find blocking sessions and what they are blocking
SELECT
    blocker.sid         AS blocking_sid,
    blocker.serial#     AS blocking_serial,
    blocker.username    AS blocking_user,
    blocker.status      AS blocking_status,
    blocker.sql_id      AS blocking_sql_id,
    waiter.sid          AS waiting_sid,
    waiter.username     AS waiting_user,
    waiter.event        AS waiting_event,
    waiter.wait_time_micro / 1e6 AS wait_seconds,
    obj.object_name     AS locked_object,
    obj.object_type
FROM
    v$session blocker
    JOIN v$lock bl ON bl.sid = blocker.sid AND bl.block = 1
    JOIN v$lock wl ON wl.id1 = bl.id1 AND wl.id2 = bl.id2
                   AND wl.request > 0
    JOIN v$session waiter ON waiter.sid = wl.sid
    LEFT JOIN dba_objects obj ON obj.object_id = bl.id1
ORDER BY
    wait_seconds DESC;
```

### Lock Wait Tree (Hierarchical)

```sql
-- Show the full lock wait chain using hierarchical query
SELECT
    LPAD(' ', 2 * (LEVEL - 1)) || sid AS sid,
    username,
    status,
    osuser,
    machine,
    program,
    blocking_session,
    wait_class,
    event,
    seconds_in_wait
FROM
    v$session
WHERE
    status = 'ACTIVE'
    OR blocking_session IS NOT NULL
CONNECT BY PRIOR sid = blocking_session
START WITH blocking_session IS NULL AND status = 'ACTIVE'
ORDER SIBLINGS BY sid;
```

### Identify SQL Being Executed by Blocked Session

```sql
SELECT s.sid, s.blocking_session, s.event,
       sq.sql_text, s.seconds_in_wait
FROM   v$session s
JOIN   v$sql sq ON s.sql_id = sq.sql_id
WHERE  s.blocking_session IS NOT NULL;
```

### Lock History (AWR — requires Diagnostics Pack license)

```sql
-- Top waiting events for locks over last hour
SELECT event, total_waits, time_waited_micro / 1e6 AS total_wait_secs
FROM   v$system_event
WHERE  wait_class = 'Concurrency'
ORDER  BY time_waited_micro DESC;
```

---

## Optimistic vs. Pessimistic Locking

### Pessimistic Locking (SELECT FOR UPDATE)

Lock the row immediately, before reading the value that will drive the update. Use this approach when:
- Contention on the row is high
- Retrying on conflict is not acceptable
- The "think time" between the read and the update is very short

### Optimistic Locking

Read the row without acquiring a lock. At update time, verify the row has not changed since it was read:

```sql
-- Read (no lock)
SELECT order_id, status, last_modified
INTO   :order_id, :status, :last_modified
FROM   orders
WHERE  order_id = 1001;
-- Application processes the data, user thinks about it...

-- Update with collision detection using comparison with values previously fetched
UPDATE orders
SET    status = 'APPROVED', last_modified = SYSTIMESTAMP
WHERE  order_id = 1001
  AND  last_modified = :last_modified; -- fails if row was changed since we read it

IF SQL%ROWCOUNT = 0 THEN
    -- Row was modified by someone else; retry or raise conflict error
    RAISE_APPLICATION_ERROR(-20003, 'Conflict: order was modified. Please reload and retry.');
END IF;
COMMIT;
```

Using the ORA_ROWSCN function as an optimistic locking mechanism is an anti-pattern. Avoid it because:
- Tables require the ROW DEPENDENCIES clause, but no error is raised if it is absent
- ORA_ROWSCN does not function on Index Organized Tables
- ORA_ROWSCN requires that columns referenced in the UPDATE SET clause also appear as predicates in the WHERE clause; otherwise it can return null

In version 26ai and later, SYS_ROW_ETAG can be used for optimistic locking without the limitations of ORA_ROWSCN

**Using a version column for optimistic locking:**

```sql
-- Table design
CREATE TABLE orders (
    order_id    NUMBER PRIMARY KEY,
    status      VARCHAR2(20),
    version_no  NUMBER DEFAULT 1 NOT NULL  -- incremented on every update
);

-- Update with version check
UPDATE orders
SET    status = :new_status,
       version_no = version_no + 1
WHERE  order_id = :order_id
  AND  version_no = :read_version;  -- must match what was read

IF SQL%ROWCOUNT = 0 THEN
    RAISE_APPLICATION_ERROR(-20004, 'Stale data: please reload.');
END IF;
```

---

## Best Practices

- **Prefer optimistic locking** for low-contention scenarios. Escalate to `FOR UPDATE` only when you genuinely need to prevent concurrent modification between the read and the update.
- **Minimize lock duration.** Acquire locks immediately before the DML statement, not at the beginning of a user interaction.
- **Never hold locks across network round-trips or user input.** A user stepping away while a transaction holds locks blocks all other sessions.
- **Use `SKIP LOCKED` for queue-based workloads** to support horizontal worker scaling without a separate queue infrastructure.
- **Acquire locks in a consistent order** across all code paths to prevent deadlocks.
- **Monitor `v$lock` and `v$session`** in production for blocking chains. Configure alerts when `seconds_in_wait` exceeds a defined threshold.
- **Avoid `LOCK TABLE IN EXCLUSIVE MODE`** in application code — it is almost always the wrong choice and introduces a serialization bottleneck.

---

## Common Mistakes

### Mistake 1: Assuming Reads Are Blocked by Writes

Developers familiar with SQL Server or MySQL sometimes add unnecessary `NOLOCK` hints or read-uncommitted isolation levels. In Oracle, this is never necessary — readers are never blocked by writers.

### Mistake 2: Catching ORA-00060 and Ignoring It

When an application catches a deadlock error, it must roll back the statement (Oracle has already rolled back the statement, but the transaction remains open with any prior changes intact) and then decide whether to retry or abort the entire transaction.

```plpgsql
-- WRONG: continue as if nothing happened
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -60 THEN NULL; END IF;  -- ignore deadlock!

-- RIGHT: rollback and handle
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -60 THEN
        ROLLBACK;
        retry_or_raise();
    ELSE
        ROLLBACK;
        RAISE;
    END IF;
```

### Mistake 3: Using SELECT FOR UPDATE in Read-Only Scenarios

`SELECT FOR UPDATE` acquires exclusive row locks. When the application only reads the data with no subsequent DML, those locks unnecessarily block other writers for the full duration of the transaction.

### Mistake 4: Escalating to Table Locks Prematurely

Some developers apply `LOCK TABLE IN EXCLUSIVE MODE` to "play it safe" during batch updates. This serializes all processing and eliminates any parallelism benefit. Use row-level locking and batch commits instead.

---


## Oracle Version Notes (19c vs 26ai)

- The baseline guidance in this file applies to Oracle Database 19c unless a newer minimum version is explicitly stated.
- Features labeled 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable; retain 19c-compatible alternatives for mixed-version environments.
- In environments requiring support for both versions, validate syntax and package behavior against both 19c and 26ai, as defaults and deprecated features can differ between release updates.

## Sources

- [Oracle Database 19c Concepts (CNCPT) — Data Concurrency and Consistency](https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/)
- [Oracle Database 19c Application Developer's Guide (ADFNS)](https://docs.oracle.com/en/database/oracle/oracle-database/19/adfns/)
- [V$LOCK — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-LOCK.html)
- [V$SESSION — Oracle Database 19c Reference](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html)
