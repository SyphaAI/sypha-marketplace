---
title: InnoDB Row Locking Gotchas
description: Gap locks, next-key locks, and surprise escalation
tags: mysql, innodb, locking, gap-locks, next-key-locks, concurrency
---

# Row Locking Gotchas

InnoDB operates at the row level for locking, yet the range actually locked is frequently broader than developers anticipate.

## Next-Key Locks (REPEATABLE READ)
At InnoDB's default isolation level, **locking reads** (`SELECT ... FOR UPDATE`, `SELECT ... FOR SHARE`, `UPDATE`, `DELETE`) use next-key locks to prevent phantom reads. Every gap within a scanned range is locked. Ordinary `SELECT` statements rely on consistent reads (MVCC) and acquire no locks.

**Exception**: a unique index lookup with an exact match condition (e.g., `WHERE id = 5` on a unique `id`) locks only the index record itself, not the surrounding gap. Gap and next-key locks still apply to range scans and non-unique searches.

```sql
-- Locks rows with id 5..10 AND the gaps between them and after the range
SELECT * FROM orders WHERE id BETWEEN 5 AND 10 FOR UPDATE;
-- Another session inserting id=7 blocks until the lock is released.
```

## Gap Locks on Non-Existent Rows
Issuing `SELECT ... FOR UPDATE` for a row that does not exist still results in a gap lock:
```sql
-- No row with id=999 exists, but this locks the gap around where 999 would be
SELECT * FROM orders WHERE id = 999 FOR UPDATE;
-- Concurrent INSERTs into that gap are blocked.
```

## Index-Less UPDATE/DELETE = Full Scan and Broad Locking
When the WHERE clause references an unindexed column, InnoDB must examine every row and acquires a lock on each one it visits (in practice, often every row in the table). This is not table-level locking—InnoDB never escalates locks—but the end result is row-level locks held across all rows:
```sql
-- No index on status → locks all rows (not a table lock, but all row locks)
UPDATE orders SET processed = 1 WHERE status = 'pending';
-- Fix: CREATE INDEX idx_status ON orders (status);
```

## SELECT ... FOR SHARE (Shared Locks)
`SELECT ... FOR SHARE` obtains shared (S) locks rather than exclusive (X) locks. Multiple concurrent sessions may each hold a shared lock at the same time, but any attempt to acquire an exclusive lock is blocked:

```sql
-- Session 1: shared lock
SELECT * FROM orders WHERE id = 5 FOR SHARE;

-- Session 2: also allowed (shared lock)
SELECT * FROM orders WHERE id = 5 FOR SHARE;

-- Session 3: blocked until shared locks are released
UPDATE orders SET status = 'processed' WHERE id = 5;
```

Gap and next-key locks remain in effect under REPEATABLE READ, so inserts targeting a locked gap can be blocked even when only shared locks are held.

## INSERT ... ON DUPLICATE KEY UPDATE
This statement acquires an exclusive next-key lock on the relevant index entry. When several sessions execute this concurrently against adjacent key values, gap-lock deadlocks occur frequently.

## Lock Escalation Misconception
InnoDB does **not** automatically promote row locks to table locks. When a missing index produces effectively table-wide locking, it is because InnoDB scanned and locked every row individually—not because any lock escalation took place.

## Mitigation Strategies
- **Use READ COMMITTED** when gap locks create excessive contention (gap locks are disabled in RC, except for FK and duplicate-key checks).
- **Keep transactions short** — hold locks for milliseconds, not seconds.
- **Index WHERE columns** to prevent full-table lock scans.
