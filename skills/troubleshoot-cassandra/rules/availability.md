# Apache Cassandra: Availability signals

## Scope

Signals belonging to the Availability domain for Apache Cassandra, as defined in the Netdata
operator playbook. Each entry provides a brief description, the collection source, and guidance on
the MCP query pattern that exposes it. Consult this file during a triage pass to determine which
signal to retrieve first.

## Severity legend

- **HIGH**: primary paging target. Brief time-to-impact.
- **MEDIUM**: warrants a ticket. Typically a precursor rather than a direct cause.
- **LOW**: contextual only. Valuable for RCA; not intended for alerting.

## Signals

### Node Liveness (Failure Detector) [MED]

Indicates whether the cluster's phi accrual failure detector considers a node UP or DOWN. This is
the authoritative gossip-based liveness signal.

Collection source: JMX: `org.apache.cassandra.net:type=FailureDetector`; attributes
`UpEndpointCount`, `DownEndpointCount`, `SimpleStates` (map of endpoint then UP/DOWN). Also:
`org.apache.cassandra.net:type=Gossiper`; attributes `LiveMembers`, `UnreachableMembers`.

MCP query: retrieve this signal using `query_metrics` and compare the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` when the signal has shifted but no obvious cause is apparent.

### Native Transport Active [MED]

Whether the CQL native transport (client-facing protocol, port 9042) is currently accepting connections.

Collection source: JMX: `org.apache.cassandra.db:type=StorageService`; attribute
`NativeTransportRunning` (boolean). JMX:
`org.apache.cassandra.metrics:type=Client,name=connectedNativeClients`; connected client count.

MCP query: retrieve this signal using `query_metrics` and compare the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` when the signal has shifted but no obvious cause is apparent.

### Schema Agreement [MED]

Whether all cluster nodes agree on the same schema version. Schema disagreement blocks DDL
operations and may point to a hung or partitioned node.

Collection source: JMX: `org.apache.cassandra.db:type=StorageService`; attribute `SchemaVersions`
(map of schema UUID then list of endpoints).

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

## Netdata contexts that surface Availability

No Netdata-native contexts have been classified into the Availability domain for Apache Cassandra.
Use the discovery-style MCP calls below, or refer to the full context list in SKILL.md.

## MCP query examples for this domain

```text
# Discover contexts for this service
list_metrics with q="apache-cassandra"

# Rank anomalies on the host running this service
find_anomalous_metrics with node=<host>
```

## When to escalate out of this skill

When none of the signals in this domain change during the incident, the root cause lies elsewhere.
Typical re-routing destinations:

- Host-resource domain: load, CPU, memory, disk, network saturation
- Dependency domain: the service's upstream or downstream (database, cache, queue) is the true
  source
- Orchestrator domain: Kubernetes or systemd lifecycle events rather than application misbehavior
- Alert engine domain: a misconfigured alert threshold produced a false-positive incident
