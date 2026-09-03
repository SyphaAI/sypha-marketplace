# Apache Cassandra: Replication / Consistency signals

## Scope

These are the signals belonging to the Replication / Consistency domain for Apache Cassandra, as
catalogued in the Netdata operator playbook. Each entry provides a brief description, the collection
source, and a pointer to the MCP query pattern that retrieves it. Consult this file during a triage
pass to determine which signal to fetch first.

## Severity legend

- **HIGH**: first-class paging target. Short time to impact.
- **MEDIUM**: ticket-worthy. Usually a precursor, not a cause.
- **LOW**: context only. Useful for RCA, not for alerting.

## Signals

### Hinted Handoff Status [MED]

Current state of hint storage and delivery on this node. Hints are persisted when a write's target
replica is down, and forwarded to that replica once it comes back online.

Collection source: JMX: `org.apache.cassandra.metrics:type=Storage,name=TotalHintsInProgress`; hints
currently being delivered (active delivery threads) JMX:
`org.apache.cassandra.metrics:type=Storage,name=TotalHints`; total hints written since restart
(cumulative counter) JMX: `org.apache.cassandra.metrics:type=Hi...

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Repair Status / Last Repair Time [MED]

Whether anti-entropy repair has completed successfully within `gc_grace_seconds` (default 10 days)
for each table. Repair maintains replica consistency and allows tombstone garbage collection to
proceed.

Collection source: `system_distributed.repair_history` table (3.x+) `nodetool repair_admin list`
(4.0+) Log files: grep for repair session completion

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Read Repair and Speculative Retry Activity [MED]

Rate of read repairs (initiated when replicas return conflicting data during a read) and speculative
retries (issued when the coordinator dispatches an additional read to a second replica because the
first replica is responding too slowly).

Collection source: JMX:
`org.apache.cassandra.metrics:type=Table,keyspace=X,scope=Y,name=ReadRepairRequests` (Meter) JMX:
`org.apache.cassandra.metrics:type=Table,keyspace=X,scope=Y,name=SpeculativeRetries` (Counter)

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Streaming Progress and Failures [MED]

Status and error rate of streaming sessions — the bulk data transfers that occur during bootstrap,
decommission, rebuild, or repair operations.

Collection source: JMX: `org.apache.cassandra.metrics:type=Streaming,name=TotalIncomingBytes` /
`TotalOutgoingBytes` Virtual table (4.0+): `system_views.sstable_tasks` (shows streaming tasks)

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

## Netdata contexts that surface Replication / Consistency

No Netdata-native contexts have been assigned to the Replication / Consistency domain for Apache
Cassandra. Use the discovery-style MCP calls below, or consult the full context list in SKILL.md.

## MCP query examples for this domain

```text
# Discover contexts for this service
list_metrics with q="apache-cassandra"

# Rank anomalies on the host running this service
find_anomalous_metrics with node=<host>
```

## When to escalate out of this skill

If no signals in this domain shift during the incident, the root cause lies elsewhere. Common
re-routing destinations:

- Host-resource domain: load, CPU, memory, disk, network saturation
- Dependency domain: the service's upstream or downstream (database, cache, queue) is the actual
  source
- Orchestrator domain: Kubernetes or systemd lifecycle events rather than application misbehavior
- Alert engine domain: a misconfigured alert threshold triggered a false-positive incident
