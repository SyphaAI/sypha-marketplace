# Apache Cassandra: Throughput signals

## Scope

These are the signals belonging to the Throughput domain for Apache Cassandra, as catalogued in the
Netdata operator playbook. Each entry provides a brief description, the collection source, and a
pointer to the MCP query pattern that retrieves it. Consult this file during a triage pass to
determine which signal to fetch first.

## Severity legend

- **HIGH**: first-class paging target. Short time to impact.
- **MEDIUM**: ticket-worthy. Usually a precursor, not a cause.
- **LOW**: context only. Useful for RCA, not for alerting.

## Signals

### Client Request Rate (Read/Write) [MED]

Rate of client read and write requests handled by this node in its coordinator role. This serves as
the baseline workload measurement.

Collection source: JMX: `org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Latency`;
attribute `Count` (cumulative) and `OneMinuteRate` JMX:
`org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Latency`; same attributes
Additional scopes: `CASRead`, `CASWrite`, `RangeSlice`

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

## Triage order within this domain

Work through HIGH-severity signals first, then MEDIUM, then LOW. HIGH-severity signals carry the
shortest time to impact; a confirmed HIGH anomaly generally warrants a page. When two HIGH signals
shift simultaneously, treat them as a single incident until `find_correlated_metrics` eliminates a
shared root cause.

## Common false positives

- A single stale data point following a collector restart briefly fires many signals. Re-query after
  30 seconds before taking escalation steps.
- Short spikes under 60 seconds seldom require action unless paired with a confirmed business
  impact.
- Comparing against yesterday's baseline on a post-deploy day yields false anomalies. Use the
  pre-deploy baseline for comparison instead.
- Collector-visible percentile latency with < 100 samples per minute is noise. Require a minimum
  sample count before acting on it.

## Remediation pointers

Remediation for signals in this domain is technology-specific and is usually documented in the
operator playbook's SECTION 3 (Failure Patterns) or SECTION 4 (Runbooks). Before applying a fix:

1. Run the MCP verification queries to capture the current state.
2. Apply the narrowest remediation that resolves the confirmed cause. Prefer config changes over
   restarts, and restarts over rollbacks.
3. Re-run the same MCP queries once the remediation has settled. Capturing before/after numbers is
   how a runbook entry is refined over time.

## Netdata contexts that surface Throughput

The following are the actual Netdata chart contexts emitted by the native collector for Apache
Cassandra. Use these names exactly as shown in `query_metrics` calls.

- `cassandra.client_requests_rate`: Client requests rate (requests/s). Dimensions: read, write.
- `cassandra.client_requests_latency`: Client requests total latency (seconds). Dimensions: read,
                                       write.
- `cassandra.row_cache_hit_rate`: Key cache hit rate (events/s). Dimensions: hits, misses.
- `cassandra.key_cache_hit_rate`: Row cache hit rate (events/s). Dimensions: hits, misses.
- `cassandra.compaction_completed_tasks_rate`: Completed compactions rate (tasks/s). Dimensions:
                                               completed.
- `cassandra.compaction_compacted_rate`: Compaction data rate (bytes/s). Dimensions: compacted.
- `cassandra.jvm_gc_rate`: Garbage collections rate (gc/s). Dimensions: parnew, cms.
- `cassandra.dropped_messages_rate`: Dropped messages rate (messages/s). Dimensions: dropped.
- `cassandra.client_requests_timeouts_rate`: Client requests timeouts rate (timeout/s). Dimensions:
                                             read, write.
- `cassandra.client_requests_unavailables_rate`: Client requests unavailable exceptions rate
                                                 (exceptions/s). Dimensions: read, write.
- `cassandra.client_requests_failures_rate`: Client requests failures rate (failures/s). Dimensions:
                                             read, write.
- `cassandra.storage_exceptions_rate`: Storage exceptions rate (exceptions/s). Dimensions: storage.

## MCP query examples for this domain

```text
# Pull every context in this domain at once
query_metrics with contexts=[cassandra.client_requests_rate, cassandra.client_requests_latency, cassandra.row_cache_hit_rate, cassandra.key_cache_hit_rate, cassandra.compaction_completed_tasks_rate, cassandra.compaction_compacted_rate] and relative_window=-30m

# Rank anomalies that match this domain
find_anomalous_metrics with node=<host> and context_pattern="cassandra.*"

# Correlate a problem context with others outside the domain
find_correlated_metrics around the incident window, anchor_context="cassandra.client_requests_rate"
```

## When to escalate out of this skill

If no signals in this domain shift during the incident, the root cause lies elsewhere. Common
re-routing destinations:

- Host-resource domain: load, CPU, memory, disk, network saturation
- Dependency domain: the service's upstream or downstream (database, cache, queue) is the actual
  source
- Orchestrator domain: Kubernetes or systemd lifecycle events rather than application misbehavior
- Alert engine domain: a misconfigured alert threshold triggered a false-positive incident
