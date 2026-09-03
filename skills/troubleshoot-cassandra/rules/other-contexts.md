# Apache Cassandra: Other Netdata Contexts signals

## Scope

These are the signals belonging to the Other Netdata Contexts domain for Apache Cassandra, as
catalogued in the Netdata operator playbook. Each entry provides a brief description, the collection
source, and a pointer to the MCP query pattern that retrieves it. Consult this file during a triage
pass to determine which signal to fetch first.

## Severity legend

- **HIGH**: first-class paging target. Short time to impact.
- **MEDIUM**: ticket-worthy. Usually a precursor, not a cause.
- **LOW**: context only. Useful for RCA, not for alerting.

## Signals

No structured signal list was extracted from the playbook for the Other Netdata Contexts domain.
Fall back to the MCP discovery pattern: run `list_metrics` scoped to the Apache Cassandra service
and examine any entries with matching keywords.

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

## Netdata contexts that surface Other Netdata Contexts

The following are the actual Netdata chart contexts emitted by the native collector for Apache
Cassandra. Use these names exactly as shown in `query_metrics` calls.

- `cassandra.storage_live_disk_space_used`: Disk space used by live data (bytes). Dimensions: used.
- `cassandra.compaction_pending_tasks_count`: Pending compactions (tasks). Dimensions: pending.
- `cassandra.jvm_memory_used`: Memory used (bytes). Dimensions: heap, nonheap.
- `cassandra.thread_pool_active_tasks_count`: Active tasks (tasks). Dimensions: active.
- `cassandra.thread_pool_pending_tasks_count`: Pending tasks (tasks). Dimensions: pending.
- `cassandra.thread_pool_blocked_tasks_count`: Blocked tasks (tasks). Dimensions: blocked.

## MCP query examples for this domain

```text
# Pull every context in this domain at once
query_metrics with contexts=[cassandra.storage_live_disk_space_used, cassandra.compaction_pending_tasks_count, cassandra.jvm_memory_used, cassandra.thread_pool_active_tasks_count, cassandra.thread_pool_pending_tasks_count, cassandra.thread_pool_blocked_tasks_count] and relative_window=-30m

# Rank anomalies that match this domain
find_anomalous_metrics with node=<host> and context_pattern="cassandra.*"

# Correlate a problem context with others outside the domain
find_correlated_metrics around the incident window, anchor_context="cassandra.storage_live_disk_space_used"
```

## When to escalate out of this skill

If no signals in this domain shift during the incident, the root cause lies elsewhere. Common
re-routing destinations:

- Host-resource domain: load, CPU, memory, disk, network saturation
- Dependency domain: the service's upstream or downstream (database, cache, queue) is the actual
  source
- Orchestrator domain: Kubernetes or systemd lifecycle events rather than application misbehavior
- Alert engine domain: a misconfigured alert threshold triggered a false-positive incident
