# Use Observability Commands for Debugging

Redis includes built-in commands for monitoring and diagnosing issues.

**Key commands:**

```
# Slow query log - find slow commands
SLOWLOG GET 10
SLOWLOG LEN
SLOWLOG RESET

# Server info - comprehensive stats
INFO all
INFO memory
INFO stats
INFO replication
INFO clients

# Memory analysis
MEMORY DOCTOR
MEMORY STATS
MEMORY USAGE mykey

# Client connections
CLIENT LIST
CLIENT INFO

# Index info (RQE)
FT.INFO idx:products
FT.PROFILE idx:products SEARCH QUERY "@name:laptop"
```

**Correct:** Review SLOWLOG on a regular basis.

```python
# Get recent slow queries
slow_queries = redis.slowlog_get(10)
for query in slow_queries:
    print(f"Duration: {query['duration']}μs, Command: {query['command']}")
```

Reference: [Redis Monitoring](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/)
