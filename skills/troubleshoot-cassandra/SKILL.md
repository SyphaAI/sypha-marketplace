---
name: troubleshoot-cassandra
description: >-
  Trigger when investigating Apache Cassandra problems: gc death spiral,
  compaction death spiral, tombstone storm, disk space exhaustion, or hint
  overflow. Uses Netdata via MCP to check node liveness (failure detector),
  native transport active, client request rate (read/write), client request
  latency (coordinator), walks the diagnostic tree from the Netdata operator
  playbook, and surfaces remediation guidance.
metadata:
  upstream:
    version: 0.1.0
    author: Netdata
    tags:
      - netdata
      - troubleshoot
      - mcp
      - cassandra
  category: observability
  source:
    repository: 'https://github.com/netdata/skills'
    path: skills/troubleshoot-cassandra
    license_path: LICENSE
    commit: ae650fc3766642f14e29892ab4fed607ac29d263
---

# Troubleshoot Apache Cassandra

## When to use this skill

- **GC Death Spiral**: Heap pressure then long GC pauses then gossip failures then node marked DOWN
                       then client retries flood then more heap pressure. Self-reinforcing.
- **Compaction Death Spiral**: Write rate exceeds compaction throughput then SSTables accumulate
                               then read amplification increases then latency spikes then more
                               compaction needed then disk I/O saturated.
- **Tombstone Storm**: Accumulated tombstones (deletes/expired TTLs) force reads to scan massive
                       amounts of dead data then read latency spikes, possible query abortion at
                       100K tombstones.
- **Disk Space Exhaustion**: Compaction backlog + snapshots + hints consume space then compaction
                             cannot run (needs temporary space) then writes blocked.
- **Hint Overflow**: Long node outage then hints accumulate on coordinators then hints expire
                     (`max_hint_window`, default 3h) then data permanently inconsistent unless
                     repaired.
- Whenever a user reports an Apache Cassandra service operating outside its expected envelope
  (elevated errors, latency, saturation, resource exhaustion, or unexpected restarts).
- An on-call engineer is responding to a Netdata alert tied to an Apache Cassandra instance and
  needs a structured triage path.

## Key facts

- This skill wraps the Netdata operator playbook for Apache Cassandra. It does not replace the
  playbook; instead it directs a coding agent through MCP queries targeting the same signals the
  playbook relies on.
- The playbook breaks Apache Cassandra health into 8 signal domains: Availability, Throughput,
  Latency, Errors, Saturation / Internal State, Replication / Consistency. Each domain corresponds
  to one rule file within this skill.
- The primary failure archetypes the playbook identifies: GC Death Spiral; Compaction Death Spiral;
  Tombstone Storm; Disk Space Exhaustion; Hint Overflow.
- Netdata monitors the signals listed in the rule files through its native collectors, plus any
  OpenTelemetry-shipped metrics your Apache Cassandra instrumentation provides. Both paths converge
  at the same MCP query surface.
- Netdata's cassandra collector emits 28 context(s) under `cassandra.*`. The rule files enumerate
  which contexts belong to which domain; the Verification section below identifies the load-bearing
  ones explicitly.

## Step-by-step

1. Verify the Apache Cassandra service is running. Query Netdata via MCP with `list_nodes` and
   filter by the host running the target. An absent node indicates the problem lies at the network
   or orchestrator layer, not within the service itself.
2. Retrieve the last 15 minutes of signals for the target. Use `query_metrics` against the contexts
   listed in the domain rule files. Run `find_anomalous_metrics` in parallel over the same window;
   the anomalies indicate which rule file to consult first.
3. Check for **GC Death Spiral**. Heap pressure then long GC pauses then gossip failures then node
   marked DOWN then client retries flood then more heap pressure. Self-reinforcing. Inspect the rule
   file whose signals move first for this mode.
4. Check for **Compaction Death Spiral**. Write rate exceeds compaction throughput then SSTables
   accumulate then read amplification increases then latency spikes then more compaction needed then
   disk I/O saturated. Inspect the rule file whose signals move first for this mode.
5. Check for **Tombstone Storm**. Accumulated tombstones (deletes/expired TTLs) force reads to scan
   massive amounts of dead data then read latency spikes, possible query abortion at 100K
   tombstones. Inspect the rule file whose signals move first for this mode.
6. Check for **Disk Space Exhaustion**. Compaction backlog + snapshots + hints consume space then
   compaction cannot run (needs temporary space) then writes blocked. Inspect the rule file whose
   signals move first for this mode.
7. Check for **Hint Overflow**. Long node outage then hints accumulate on coordinators then hints
   expire (`max_hint_window`, default 3h) then data permanently inconsistent unless repaired.
   Inspect the rule file whose signals move first for this mode.
8. Cross-reference with host-level signals (`system.cpu.utilization`, `system.memory.usage`,
   `system.disk.io_time`). Many service-level failures are preceded by a host-resource issue.
9. Apply the remediation indicated by the matching rule file or the operator playbook. Re-run the
   MCP queries from the Verification section to confirm signals have returned to expected ranges. A
   fix that does not shift the signal back is not a valid fix.

### Handy MCP call templates

```text
# Discover metrics from Apache Cassandra
list_metrics with q="cassandra"

# Pull a specific context over the last window
query_metrics with context="cassandra.dropped_messages_rate", relative_window=-15m

# Rank anomalies for the service or host
find_anomalous_metrics with node=<host> and context_pattern="cassandra.*"

# Correlate a known problem context with others
find_correlated_metrics around the incident window

# Show current alert state
list_raised_alerts scoped to the node
```

## Common mistakes

- Approaching Apache Cassandra as a generic HTTP or process health check. Apache Cassandra has
  specific failure archetypes (see Key facts) that generic checks will miss.
- Halting investigation at the first anomalous metric. Several archetypes produce correlated spikes;
  use `find_correlated_metrics` to broaden the search before declaring a root cause.
- Citing percentile latency without the accompanying sample count. Low traffic combined with a
  single slow request can shift p99 by seconds.
- Reviewing dashboards over a window shorter than the failure's fingerprint. Slow-developing
  failures (queue growth, bloat, memory fragmentation) require 30+ minutes of data to reveal the
  trend.
- Omitting the host-level correlation step. A process-level fix for a noisy-neighbour problem will
  not hold.
- Assuming alert thresholds are calibrated for your workload. Validate against observed Apache
  Cassandra traffic before treating a threshold as an alert configuration problem.

## Verification

Execute these MCP queries against the Netdata instance monitoring the Apache Cassandra service. Every
context listed below is an actual Netdata chart name; the agent does not need to infer them.

```text
1. list_metrics filtered by q="cassandra" (returns every cassandra.* context Netdata sees)
2. query_metrics with contexts=[cassandra.dropped_messages_rate, cassandra.client_requests_timeouts_rate, cassandra.client_requests_failures_rate, cassandra.client_requests_rate, cassandra.client_requests_latency, cassandra.row_cache_hit_rate] and relative_window=-30m
3. find_anomalous_metrics filtered by node=<host> and context_pattern="cassandra.*"
```

Load-bearing contexts for this service:

- `cassandra.dropped_messages_rate`: Dropped messages rate (messages/s). Dimensions: dropped.
- `cassandra.client_requests_timeouts_rate`: Client requests timeouts rate (timeout/s). Dimensions:
                                             read, write.
- `cassandra.client_requests_failures_rate`: Client requests failures rate (failures/s). Dimensions:
                                             read, write.
- `cassandra.client_requests_rate`: Client requests rate (requests/s). Dimensions: read, write.
- `cassandra.client_requests_latency`: Client requests total latency (seconds). Dimensions: read,
                                       write.
- `cassandra.row_cache_hit_rate`: Key cache hit rate (events/s). Dimensions: hits, misses.

A clean result means every context falls within its expected band and the `find_anomalous_metrics`
list is either empty or contains only already-acknowledged items. When the fix is genuine,
re-running the same queries 10 minutes after applying it will return a clean result. If it does not,
revert the change and investigate further.

### When the fix does not hold

If signals return to the anomalous range within 30 minutes of a remediation, the underlying cause
runs deeper than the applied change. Common misdiagnoses for Apache Cassandra:

- Host-resource pressure presenting as an application bug.
- A dependent service (DB, cache, upstream) generating a secondary symptom in the instrumented
  service.
- A configuration change that was never reloaded (some subsystems only pick up new config after a
  full restart).

Escalate by extending the query window: 2-6 hours rather than 15 minutes. Slow-moving causes are
not visible at triage window sizes.

## References

- [`rules/availability.md`](./rules/availability.md)
- [`rules/throughput.md`](./rules/throughput.md)
- [`rules/latency.md`](./rules/latency.md)
- [`rules/errors.md`](./rules/errors.md)
- [`rules/saturation-internal-state.md`](./rules/saturation-internal-state.md)
- [`rules/replication-consistency.md`](./rules/replication-consistency.md)
- [`rules/cache-performance.md`](./rules/cache-performance.md)
- [`rules/security-integrity.md`](./rules/security-integrity.md)
- Netdata operator playbook: the authoritative source material this skill summarizes.
- `skills/netdata-mcp-integration/` for the transport setup.
- `skills/netdata-otel-setup/` if additional application signals are needed beyond what Netdata
  collects natively.
