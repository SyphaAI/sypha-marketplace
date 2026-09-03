---
title: Connection Pooling and Limits
description: Connection management best practices
tags: mysql, connections, pooling, max-connections, performance
---

# Connection Management

Each MySQL connection consumes memory (~1–10 MB depending on buffer configuration). Without an upper bound, connections can cause OOM conditions or `Too many connections` errors.

## Sizing `max_connections`
The default is 151. Do not raise this value indiscriminately — more connections means more memory consumption and greater contention.

```sql
SHOW VARIABLES LIKE 'max_connections';         -- current limit
SHOW STATUS LIKE 'Max_used_connections';        -- high-water mark
SHOW STATUS LIKE 'Threads_connected';           -- current count
```

## Pool Sizing Formula
A reasonable starting point for OLTP workloads: **pool size = (CPU cores * N)** where N is typically 2–10. Treat this as a baseline and refine based on:
- Query characteristics (I/O-bound queries may tolerate more connections)
- Observed connection usage (monitor `Threads_connected` relative to `Max_used_connections`)
- Application concurrency requirements

Adding connections beyond the CPU-bound optimum introduces context-switch overhead without improving throughput.

## Timeout Tuning

### Idle Connection Timeouts
```sql
-- Kill idle connections after 5 minutes (default is 28800 seconds / 8 hours — way too long)
SET GLOBAL wait_timeout = 300;         -- Non-interactive connections (apps)
SET GLOBAL interactive_timeout = 300;  -- Interactive connections (CLI)
```

**Note**: These are server-side timeouts. The server closes idle connections once the period elapses. Client-side timeouts (e.g., `connectTimeout` in JDBC) are a separate mechanism that governs connection establishment only.

### Active Query Timeouts
```sql
-- Increase for bulk operations or large result sets (default: 30 seconds)
SET GLOBAL net_read_timeout = 60;      -- Time server waits for data from client
SET GLOBAL net_write_timeout = 60;     -- Time server waits to send data to client
```

These settings apply only to active data transmission, not to idle connections. Increase them if you encounter `Lost connection to MySQL server during query` errors during bulk inserts or large SELECT operations.

## Thread Handling
MySQL defaults to a **one-thread-per-connection** model: every connection is assigned its own OS thread. Consequently, `max_connections` has a direct effect on total thread count and memory consumption.

MySQL caches threads for reuse after a connection closes. When connection churn is high, increase `thread_cache_size` to reduce the overhead of creating new threads.

## Common Pitfalls
- **ORM default pools too large**: Rails defaults to 5 connections per process — with 20 Puma workers that is 100 connections from a single app server. Scale this by the number of app servers.
- **No pool at all**: PHP/CGI models open a new connection for each request. Use persistent connections or ProxySQL instead.
- **Connection storms on deploy**: When all app servers restart simultaneously, they reconnect at once and can exhaust `max_connections`. Mitigate by staggering deployments, warming up pools gradually, or routing through a proxy layer.
- **Idle transactions**: Connections holding open transactions (`BEGIN` without a matching `COMMIT`/`ROLLBACK`) are **not** closed by `wait_timeout` and continue to hold locks. This leads to deadlocks and connection leaks. Always commit or roll back promptly, and enforce application-level transaction timeouts.

## Prepared Statements
Combine prepared statements with connection pooling for both performance and security:
- **Performance**: avoids repeated parsing of the same parameterized query
- **Security**: helps prevent SQL injection attacks

Note: prepared statements are ordinarily scoped to a connection; some connection pools and drivers offer statement-level caching to extend this benefit.

## When to Use a Proxy
Introduce **ProxySQL** or **PlanetScale connection pooling** when multiple application services share a database, when query routing (read/write split) is required, or when total connection demand would otherwise exceed a safe `max_connections` limit.

## Vitess / PlanetScale Note
On **PlanetScale** (or Vitess), connection pooling is managed at the Vitess `vtgate` tier. Your application can open a large number of connections to vtgate without each one mapping one-to-one to a MySQL backend connection, which substantially reduces backend connection pressure.
