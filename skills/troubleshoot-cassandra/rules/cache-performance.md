# Apache Cassandra: Cache Performance signals

## Scope

Signals belonging to the Cache Performance domain for Apache Cassandra, as defined in the Netdata
operator playbook. Each entry provides a brief description, the collection source, and guidance on
the MCP query pattern that exposes it. Consult this file during a triage pass to determine which
signal to retrieve first.

## Severity legend

- **HIGH**: primary paging target. Brief time-to-impact.
- **MEDIUM**: warrants a ticket. Typically a precursor rather than a direct cause.
- **LOW**: contextual only. Valuable for RCA; not intended for alerting.

## Signals

### Key Cache Hit Rate [MED]

The proportion of partition key lookups served from the key cache, bypassing the disk seek required
to locate the partition's position in the SSTable index.

Collection source: JMX: `org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=HitRate`
(Gauge<Double>) Also: `Hits` (Meter), `Requests` (Meter), `Size`, `Capacity`, `Entries`

MCP query: retrieve this signal using `query_metrics` and compare the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` when the signal has shifted but no obvious cause is apparent.

### Row Cache Hit Rate [MED]

The proportion of row reads served from the row cache (the full row is held in memory, eliminating
all disk I/O).

Collection source: JMX: `org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=HitRate`
(Gauge<Double>)

MCP query: retrieve this signal using `query_metrics` and compare the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` when the signal has shifted but no obvious cause is apparent.

## Triage order within this domain

Work through signals in HIGH-severity order first, then MEDIUM, then LOW. HIGH-severity signals
carry the shortest time to impact; a confirmed HIGH anomaly typically justifies paging. When two
HIGH signals move simultaneously, treat them as a single incident until `find_correlated_metrics`
rules out a shared cause.

## Common false positives

- A single stale data point following a collector restart can briefly trigger many signals. Re-query
  after 30 seconds before escalating.
- Short bursts lasting under 60 seconds rarely require action unless accompanied by a confirmed
  business impact.
- Comparing against yesterday's baseline on a post-deploy day generates false anomalies. Use the
  pre-deploy baseline instead.
- Collector-visible percentile latency with fewer than 100 samples per minute is noise. Enforce a
  minimum sample count before acting on it.

## Remediation pointers

Remediation for signals in this domain is technology-specific and is typically covered in the
operator playbook's SECTION 3 (Failure Patterns) or SECTION 4 (Runbooks). Before making any
change:

1. Run the MCP verification queries to capture the current state.
2. Apply the smallest remediation that targets the confirmed cause. Prefer config changes over
   restarts; prefer restarts over rollbacks.
3. Re-run the same MCP queries once the remediation has settled. Capturing before/after numbers is
   how a runbook entry gets refined over time.

## Netdata contexts that surface Cache Performance

These are the actual Netdata chart contexts emitted by the native collector for Apache Cassandra.
Use these names exactly as shown in `query_metrics` calls.

- `cassandra.row_cache_hit_ratio`: Key cache hit ratio (percentage). Dimensions: hit_ratio.
- `cassandra.row_cache_hit_rate`: Key cache hit rate (events/s). Dimensions: hits, misses.
- `cassandra.row_cache_utilization`: Key cache utilization (percentage). Dimensions: used.
- `cassandra.row_cache_size`: Key cache size (bytes). Dimensions: size.
- `cassandra.key_cache_hit_ratio`: Row cache hit ratio (percentage). Dimensions: hit_ratio.
- `cassandra.key_cache_hit_rate`: Row cache hit rate (events/s). Dimensions: hits, misses.
- `cassandra.key_cache_utilization`: Row cache utilization (percentage). Dimensions: used.
- `cassandra.key_cache_size`: Row cache size (bytes). Dimensions: size.

## MCP query examples for this domain

```text
# Pull every context in this domain at once
query_metrics with contexts=[cassandra.row_cache_hit_ratio, cassandra.row_cache_hit_rate, cassandra.row_cache_utilization, cassandra.row_cache_size, cassandra.key_cache_hit_ratio, cassandra.key_cache_hit_rate] and relative_window=-30m

# Rank anomalies that match this domain
find_anomalous_metrics with node=<host> and context_pattern="cassandra.*"

# Correlate a problem context with others outside the domain
find_correlated_metrics around the incident window, anchor_context="cassandra.row_cache_hit_ratio"
```

## When to escalate out of this skill

When none of the signals in this domain change during the incident, the root cause lies elsewhere.
Typical re-routing destinations:

- Host-resource domain: load, CPU, memory, disk, network saturation
- Dependency domain: the service's upstream or downstream (database, cache, queue) is the true
  source
- Orchestrator domain: Kubernetes or systemd lifecycle events rather than application misbehavior
- Alert engine domain: a misconfigured alert threshold produced a false-positive incident
