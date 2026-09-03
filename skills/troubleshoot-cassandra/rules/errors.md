# Apache Cassandra: Errors signals

## Scope

These are the signals belonging to the Errors domain for Apache Cassandra, as catalogued in the
Netdata operator playbook. Every signal entry covers a brief description, the collection source,
and a pointer to the MCP query pattern that retrieves it. Consult this file during a triage pass
to determine which signal to fetch first.

## Severity legend

- **HIGH**: first-class paging target. Short time to impact.
- **MEDIUM**: ticket-worthy. Usually a precursor, not a cause.
- **LOW**: context only. Useful for RCA, not for alerting.

## Signals

### Dropped Messages [MED]

Messages (mutations, reads, etc.) that were discarded after sitting in an internal queue beyond
their timeout. The node is offloading traffic it can no longer handle.

Collection source: JMX:
`org.apache.cassandra.metrics:type=DroppedMessage,scope=MUTATION,name=Dropped` (Meter: count, rates)
Additional scopes: `READ`, `COUNTER_MUTATION`, `RANGE_SLICE`, `HINT`, `BATCH_STORE`, `BATCH_REMOVE`,
`READ_REPAIR`, `REQUEST_RESPONSE` Note: In Cassandra 4.x, primary scopes are `MUTATION_REQ...

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Client Request Timeouts [MED]

Number of read or write requests in which the coordinator exhausted its wait for sufficient replica
responses. The client is returned a timeout error.

Collection source: JMX: `org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Timeouts`
(Meter) JMX: `org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Timeouts`

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Client Request Unavailables [MED]

Number of requests in which the coordinator was unable to locate enough live replicas to meet the
consistency level. In contrast to timeouts, these fail right away with no wait period.

Collection source: JMX:
`org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Unavailables` (Meter) JMX:
`org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Unavailables`

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Storage Exceptions [MED]

Number of unhandled exceptions within the storage subsystem; these generally point to disk I/O
errors, filesystem failures, or data corruption events.

Collection source: JMX: `org.apache.cassandra.metrics:type=Storage,name=Exceptions` (Counter)

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

## Netdata contexts that surface Errors

The following are the actual Netdata chart contexts emitted by the native collector for Apache
Cassandra. Use these names exactly as shown in `query_metrics` calls.

- `cassandra.dropped_messages_rate`: Dropped messages rate (messages/s). Dimensions: dropped.
- `cassandra.client_requests_timeouts_rate`: Client requests timeouts rate (timeout/s). Dimensions:
                                             read, write.
- `cassandra.client_requests_failures_rate`: Client requests failures rate (failures/s). Dimensions:
                                             read, write.

## MCP query examples for this domain

```text
# Pull every context in this domain at once
query_metrics with contexts=[cassandra.dropped_messages_rate, cassandra.client_requests_timeouts_rate, cassandra.client_requests_failures_rate] and relative_window=-30m

# Rank anomalies that match this domain
find_anomalous_metrics with node=<host> and context_pattern="cassandra.*"

# Correlate a problem context with others outside the domain
find_correlated_metrics around the incident window, anchor_context="cassandra.dropped_messages_rate"
```

## When to escalate out of this skill

If no signals in this domain shift during the incident, the root cause lies elsewhere. Common
re-routing destinations:

- Host-resource domain: load, CPU, memory, disk, network saturation
- Dependency domain: the service's upstream or downstream (database, cache, queue) is the actual
  source
- Orchestrator domain: Kubernetes or systemd lifecycle events rather than application misbehavior
- Alert engine domain: a misconfigured alert threshold triggered a false-positive incident
