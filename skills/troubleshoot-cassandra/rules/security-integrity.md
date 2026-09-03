# Apache Cassandra: Security & Integrity signals

## Scope

These are the signals belonging to the Security & Integrity domain for Apache Cassandra, as
catalogued in the Netdata operator playbook. Each entry provides a brief description, the collection
source, and a pointer to the MCP query pattern that retrieves it. Consult this file during a triage
pass to determine which signal to fetch first.

## Severity legend

- **HIGH**: first-class paging target. Short time to impact.
- **MEDIUM**: ticket-worthy. Usually a precursor, not a cause.
- **LOW**: context only. Useful for RCA, not for alerting.

## Signals

### Authentication / Authorization Failures [MED]

- Source: System logs (`grep "Authentication error"`) or audit log (4.0+) - Significance: Brute
force detection, misconfigured clients - Action: TICKET if high sustained rate from single source

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Authorization Failures [MED]

- Source: System logs (`grep "Unauthorized"`) or audit log - Significance: Compromised accounts,
application misconfiguration - Action: TICKET if sustained from known users

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### DDL Changes to System Keyspaces [MED]

- Source: Audit log (4.0+) - Significance: Unauthorized modifications to `system_auth`,
`system_traces` - Action: TICKET; investigate whether the change was authorized. PAGE only with
external change-control context confirming the change is unexpected.

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Unexpected Client Connections [MED]

- Source: Virtual table (4.0+): `system_views.clients` - Significance: Unknown clients connecting to
the cluster - Action: TICKET for investigation

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Data Integrity / Corruption Detection [MED]

- Source: System logs (grep for `FSError`, `CorruptSSTableException`, `IOError`), `nodetool verify`
output - Significance: Detects on-disk SSTable corruption, filesystem errors, bad sectors - Action:
PAGE for `CorruptSSTableException` or `FSError` detected in logs (these are real hardware/data fa...

MCP query: pull this signal with `query_metrics` and check the last 15 to 30 minutes against
expected bands. Cross-reference with `find_anomalous_metrics` scoped to the same context. Use
`find_correlated_metrics` if the signal has moved but the obvious cause is not visible.

### Tombstone Scan Warnings [MED]

Log warnings emitted when a read query scans tombstones exceeding `tombstone_warn_threshold`
(default 1000). Once the count reaches `tombstone_failure_threshold` (default 100000), the query is
**aborted**.

Collection source: System logs: `grep "Scanned over .* tombstones" /var/log/cassandra/system.log`
Virtual table (4.1+): `system_views.tombstones_per_read`

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

## Netdata contexts that surface Security & Integrity

No Netdata-native contexts have been assigned to the Security & Integrity domain for Apache
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
