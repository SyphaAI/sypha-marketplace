# NiFi Diagnostics

## Back Pressure Issues

### Symptoms

- Connection queues reach capacity (yellow/red indicators in the UI)
- Upstream processors halt scheduling
- Data flow stalls or degrades significantly
- FlowFiles accumulate in queues (rising latency)

### Diagnostic Steps

1. **Identify the bottleneck processor**: Examine processor stats -- compare inbound vs. outbound FlowFile counts. The processor with an expanding input queue and minimal output is the bottleneck.
2. **Check downstream processor bulletins**: Look for error bulletins on the processor failing to drain its input.
3. **Check external system health**: Verify database connections, API reachability, and file system capacity.
4. **Review connection queue details**: Right-click the connection in the UI to see object count, data size, and percentage full.

### Resolutions

| Cause | Fix |
|---|---|
| Downstream processor slower than upstream | Increase concurrent tasks on bottleneck processor if I/O-bound |
| Downstream processor in error state | Fix the error (check bulletins, logs, external system health) |
| External system unresponsive or slow | Verify connectivity, check external system load |
| Thresholds too low for workload | Increase back pressure thresholds (default: 10,000 objects / 1 GB) |
| CPU/memory-bound processor | Scale the cluster or reduce concurrent tasks on other processors |

**Additional mitigations**:
- Insert MergeRecord before the bottleneck to batch records and boost throughput
- Insert ControlRate to throttle the upstream production rate
- Use load-balanced connections in clustered environments to spread load across nodes

### Monitoring

- Connection queue status visible in UI (object count, data size, percentage full, color coding)
- REST API: `GET /nifi-api/connections/{id}/status` returns queuedCount, queuedSize, percentUseCount, percentUseBytes
- PrometheusReportingTask exports connection queue metrics for Grafana dashboards and alerting

## Memory Pressure

### Symptoms

- NiFi UI becomes slow or unresponsive
- JVM garbage collection pauses (visible in GC logs)
- `OutOfMemoryError` entries in nifi-app.log
- Node disconnections in clustered environments
- Elevated CPU driven by excessive GC activity

### Diagnostic Steps

1. Open System Diagnostics (Global Menu -> System Diagnostics or `GET /nifi-api/system-diagnostics`) and review Heap Usage, Non-Heap Usage, GC count, and GC time.
2. Examine GC logs for pauses exceeding 500ms:
   ```
   java.arg.13=-Xlog:gc*:file=./logs/nifi-gc.log
   ```
3. Tally total in-flight FlowFiles across all connections (large queues consume FlowFile Repository memory).
4. Locate processors that load entire FlowFile content into the heap (certain processors hold full content in memory).

### Resolutions

1. **Increase JVM heap** (target 50-75% of available RAM):
   ```
   # bootstrap.conf
   java.arg.2=-Xms4g
   java.arg.3=-Xmx4g
   ```
2. **Reduce in-flight FlowFiles**: Decrease back pressure thresholds to cap total queue sizes.
3. **Avoid content buffering**: Prefer streaming processors. Do not load entire FlowFile content into memory when handling large files.
4. **Tune garbage collection**: G1GC is the default in Java 21. Watch for long pauses.
5. **Reduce concurrent tasks**: Decrease total thread count if memory pressure originates from thread overhead.
6. **Configure Content Repository cleanup**: Set an appropriate `nifi.content.claim.max.appendable.size` and confirm that garbage collection executes on schedule.
7. **Configure Provenance Repository limits**:
   ```
   nifi.provenance.repository.max.storage.size=10 GB
   nifi.provenance.repository.max.storage.time=30 days
   nifi.provenance.repository.rollover.time=30 secs
   ```

## Processor Errors

### Symptoms

- Red error indicator displayed on processor in the UI
- Bulletins appearing on the processor (icon overlay)
- FlowFiles routed to the `failure` relationship
- Processor entering a STOPPED or INVALID state

### Common Error Types

| Error | Typical Cause | Resolution |
|---|---|---|
| Connection refused / timeout | External system is down or unreachable | Verify network connectivity, firewall rules, and service health |
| Authentication failure | Invalid credentials or expired tokens | Refresh credentials in controller services or parameter contexts |
| Schema mismatch | Input data does not conform to the expected schema | Validate input data; use ValidateRecord to filter non-conforming records |
| Permission denied | File system or service permission issues | Correct permissions; verify NiFi user identity |
| SQL exception | Malformed query, constraint violation, or pool exhaustion | Review the SQL statement, check constraints, raise pool size in DBCPConnectionPool |
| NullPointerException | Required FlowFile attributes or content is missing | Insert attribute validation before the failing processor |
| Invalid configuration | Missing required properties or invalid values | Inspect processor configuration; look for deprecated properties after a 2.x upgrade |

### Resolution Steps

1. Review the processor's bulletin (hover over the processor or open the Bulletin Board)
2. Examine `nifi-app.log` for detailed stack traces
3. Inspect the FlowFile in the incoming connection queue (right-click connection -> List queue -> View attributes and content)
4. Reproduce the issue with a simple FlowFile to isolate the root cause
5. Confirm controller service status (verify that all referenced services are enabled)

## Clustering Issues

### Symptoms

- Nodes appearing as DISCONNECTED in the cluster summary
- Flow changes not propagating to all nodes
- Uneven processing behavior (some nodes operational, others not)
- ZooKeeper connection errors appearing in logs
- "Unable to communicate with cluster" error messages

### Common Causes and Resolutions

| Issue | Cause | Resolution |
|---|---|---|
| Node disconnection | Network partition, ZK timeout, or node overload | Inspect network, ZK health, and node resource utilization |
| Flow out of sync | Manual edits or version conflicts | Use Git-based Flow Registry; re-sync from the coordinator |
| Primary node failover | Primary node has crashed | Automatic via ZK election; confirm the new primary is operational |
| ZooKeeper quorum loss | Majority of ZK nodes are offline | Restore ZK nodes; quorum requires a majority |
| Split brain | Network partition has isolated node groups | Resolve the network partition; may require manual intervention |
| K8s lease expiry | Pod rescheduling or resource pressure | Inspect pod health; review lease TTL configuration |

### Clustering Health Checks

1. Confirm all nodes are connected: NiFi UI -> Cluster Summary (hamburger menu)
2. Verify ZooKeeper status: `echo ruok | nc zookeeper-host 2181` (returns `imok`)
3. Examine `nifi-app.log` on disconnected nodes to determine the root cause
4. Confirm network connectivity among all nodes (NiFi ports and ZK ports)
5. Verify time synchronization across nodes (NTP)

## Performance Monitoring

### Bulletin Board

Real-time alerting surface:
- Access: Global Menu -> Bulletin Board, or via the status bar at the top of the UI
- Severity levels: DEBUG, INFO, WARNING, ERROR
- Filter by component, severity, message content, or time range
- Retention: configurable (default 5 minutes)
- Priority bulletins to monitor: ERROR on any processor, WARNING on controller services, and system-level memory/disk/cluster alerts

### System Diagnostics

Accessible via Global Menu -> System Diagnostics or `GET /nifi-api/system-diagnostics`:

| Metric | Warning Threshold |
|---|---|
| **Heap Usage** | >80% sustained |
| **Non-Heap Usage** | Unusual growth |
| **Processor Load** | >80% sustained |
| **Thread Count** | Unusual growth |
| **Uptime** | Frequent restarts |
| **FlowFile Repository Usage** | >80% |
| **Content Repository Usage** | >80% |
| **Provenance Repository Usage** | >80% |
| **Garbage Collection** | Long pauses (>500ms) |

### Provenance Analysis

Data provenance offers detailed visibility into flow behavior:
- **Lineage view**: Visual DAG depicting the complete path traveled by a FlowFile
- **Event search**: Query by processor, FlowFile UUID, time range, or event type
- **Replay**: Resubmit a FlowFile from any point in its lineage for debugging purposes
- Performance impact: provenance indexing produces substantial I/O. High-volume flows may require reduced provenance detail or a dedicated provenance disk.

### Reporting Tasks

| Task | Purpose |
|---|---|
| **MonitorDiskUsage** | Alert when repository disk usage exceeds threshold |
| **MonitorMemory** | Alert when JVM memory pool usage exceeds threshold |
| **ControllerStatusReportingTask** | Report overall controller status metrics |
| **SiteToSiteProvenanceReportingTask** | Forward provenance events to remote NiFi or external system |
| **PrometheusReportingTask** | Export metrics in Prometheus format |

## Troubleshooting Procedures

### Flow Debugging

1. **Identify the problem area**: Look for processors carrying error bulletins, connections with accumulating queues, or processors producing zero output.
2. **Check the Bulletin Board**: Global Menu -> Bulletin Board. Apply the ERROR severity filter.
3. **Inspect connection queues**: Right-click connection -> "List queue". Examine FlowFiles:
   - View attributes: confirm expected attributes are present and correctly formatted
   - View content: download or view in-browser to verify the data format
4. **Review provenance**: Right-click processor -> "View data provenance". Locate the problematic FlowFile and trace its lineage backward.
5. **Use DebugFlow processor**: Insert DebugFlow to simulate specific failure modes (exception, yield, penalize) when testing error-handling logic.
6. **Check processor stats**: Right-click processor -> "View status history". Inspect Tasks/Time, FlowFiles In/Out, Bytes Read/Written. Look for trends.
7. **Review logs**: `nifi-app.log` for errors and stack traces; `nifi-user.log` for access-related issues.

### FlowFile Inspection

1. Right-click connection -> "List queue"
2. Select a FlowFile and click the "eye" icon to view details:
   - **Attributes tab**: All key-value pairs
   - **Content tab**: View or download (renders text, JSON, XML, hex)
3. Queue listing displays: position, UUID, filename, file size, queue duration, and lineage duration

### Common Diagnostic Commands

```bash
# Check NiFi status
./bin/nifi.sh status

# System diagnostics via REST API
curl --cacert "$NIFI_CA_CERT" https://localhost:8443/nifi-api/system-diagnostics

# Cluster status
curl --cacert "$NIFI_CA_CERT" https://localhost:8443/nifi-api/controller/cluster

# All connections with queue sizes (recursive)
curl --cacert "$NIFI_CA_CERT" https://localhost:8443/nifi-api/flow/process-groups/root/status?recursive=true

# ZooKeeper health (1.x clusters)
echo ruok | nc zookeeper-host 2181
echo stat | nc zookeeper-host 2181
```

### Log Files

| Log File | Contents |
|---|---|
| `nifi-app.log` | Main application log: processor errors, framework events, stack traces |
| `nifi-user.log` | User actions: login, flow changes, access denials |
| `nifi-bootstrap.log` | NiFi startup/shutdown, JVM launch parameters |
| `nifi-deprecation.log` | Deprecated feature usage (important for 2.x migration planning) |
| `nifi-gc.log` | JVM garbage collection events (if configured) |

## Performance Tuning Checklist

- [ ] JVM heap allocated to 50-75% of available RAM
- [ ] Repositories placed on separate, high-speed disks (SSD/NVMe)
- [ ] Content Repository distributed across multiple partitions
- [ ] Provenance Repository configured with suitable retention limits
- [ ] Concurrent tasks adjusted per processor according to workload type
- [ ] Back pressure thresholds calibrated appropriately for each connection
- [ ] MergeRecord/MergeContent applied before data egress
- [ ] Record-oriented processors preferred over per-FlowFile processing
- [ ] Monitoring in place (Prometheus, disk alerts, memory alerts)
- [ ] GC logging enabled to assist with memory diagnostics
- [ ] Load-balanced connections set up in clustered environments
- [ ] Poll schedule set appropriately (avoid excessive polling when idle)
