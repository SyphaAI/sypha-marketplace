---
title: Replication Lag Awareness
description: Read-replica consistency pitfalls and mitigations
tags: mysql, replication, lag, read-replicas, consistency, gtid
---

# Replication Lag

By default, MySQL replication operates asynchronously. Queries directed at a replica may retrieve outdated data.

## The Core Problem
1. App writes to primary: `INSERT INTO orders ...`
2. App immediately reads from replica: `SELECT * FROM orders WHERE id = ?`
3. The replica has not yet applied the write — it returns empty or stale data.

## Detecting Lag
```sql
-- On the replica
SHOW REPLICA STATUS\G
-- Key field: Seconds_Behind_Source (0 = caught up, NULL = not replicating)
```
**Warning**: `Seconds_Behind_Source` reflects relay-log lag, not actual wall-clock staleness. It may underreport during long-running transactions because the value only advances when a transaction commits.

**GTID-based lag**: for more precise tracking, compare `@@global.gtid_executed` (replica) against the primary GTID position, or call `WAIT_FOR_EXECUTED_GTID_SET()` to block until a specific transaction has been applied.

**Note**: parallel replication with `replica_parallel_type=LOGICAL_CLOCK` requires `binlog_format=ROW`. Statement-based replication (`binlog_format=STATEMENT`) offers more limited support for parallel apply.

## Mitigation Strategies

| Strategy | How | Trade-off |
|---|---|---|
| **Read from primary** | Route critical reads to primary after writes | Increases primary load |
| **Sticky sessions** | Pin user to primary for N seconds after a write | Adds session affinity complexity |
| **GTID wait** | `SELECT WAIT_FOR_EXECUTED_GTID_SET('gtid', timeout)` on replica | Adds latency equal to lag |
| **Semi-sync replication** | Primary waits for >=1 replica ACK before committing | Higher write latency |

## Common Pitfalls
- **Large transactions cause lag spikes**: A single `INSERT ... SELECT` affecting 1M rows replays as one large transaction on the replica. Split the operation into smaller batches.
- **DDL blocks replication**: `ALTER TABLE` with `ALGORITHM=COPY` on the primary is replayed on the replica, stalling other relay-log events during execution. `INSTANT` and `INPLACE` DDL are less disruptive but still require brief metadata locks.
- **Long queries on replica**: A slow `SELECT` running on the replica can block relay-log application. Enable `replica_parallel_workers` (8.0+) with `replica_parallel_type=LOGICAL_CLOCK` for parallel apply. Note: LOGICAL_CLOCK requires `binlog_format=ROW` and `slave_preserve_commit_order=ON` (or `replica_preserve_commit_order=ON`) to maintain commit order.
- **IO thread bottlenecks**: Network latency, disk I/O pressure, or exhaustion of `relay_log_space_limit` can introduce lag even when the SQL apply thread is not the bottleneck. Monitor `Relay_Log_Space` and network connectivity.

## Guidelines
- Treat replicas as perpetually slightly behind and design read paths accordingly.
- Adopt GTID-based replication for dependable failover and lag visibility.
- Alert on `Seconds_Behind_Source` when it exceeds 5s to catch problems early.
