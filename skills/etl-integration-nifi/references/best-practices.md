# NiFi Best Practices

## Flow Design

### Processor Selection

- **Prefer native processors over scripts**: Rely on built-in processors (300+) whenever they cover the use case. Custom scripts (ExecuteScript, ExecuteStreamCommand) circumvent NiFi's built-in provenance, error handling, and monitoring, and are harder to maintain and debug.
- **Use record-oriented processors for structured data**: ConvertRecord, UpdateRecord, QueryRecord, LookupRecord, and ValidateRecord process many records per FlowFile efficiently. Avoid splitting to one-record-per-FlowFile unless downstream logic specifically requires it.
- **Use the List/Fetch pattern for file ingestion**: Choose ListFile + FetchFile over GetFile. ListFile runs on the Primary Node (preventing duplicate processing in clusters), maintains state, and FetchFile spreads retrieval work across all cluster nodes.
- **Use controller service-based Kafka processors (NiFi 2.x)**: The updated ConsumeKafka/PublishKafka share connection configuration through controller services, replacing the older embedded-config approach. All legacy Kafka processors were dropped in 2.0.

### Connection Sizing

- **Set back pressure thresholds deliberately**: Default values are 10,000 objects and 1 GB. Tune them according to expected throughput, FlowFile sizes, available memory, and tolerable latency.
- **Size connections to handle expected bursts**: When upstream produces faster than downstream can consume, give the queue enough capacity to absorb peaks without triggering back pressure too early.
- **Configure FlowFile expiration on non-critical connections**: This stops stale data from building up indefinitely and is especially useful on monitoring and alerting side flows.
- **Use load-balanced connections in clusters**: Set up Round Robin, Single Node, or Partition by Attribute load balancing to spread work evenly across cluster nodes.

### Process Group Organization

- **Organize by function**: Structure process groups around logical stages — Ingestion, Validation, Transformation, Routing, Delivery, and Error Handling.
- **Use Input/Output Ports for clear interfaces**: Named ports define the data contract between process groups.
- **Choose descriptive names**: Include the source/destination and intent (e.g., "Ingest: Customer Orders from Kafka", "Transform: Normalize Address Records").
- **Cap nesting at 3-4 levels**: Deeper nesting makes flows difficult to navigate and troubleshoot.
- **Use Parameter Contexts per environment**: Capture environment-specific values (database URLs, credentials, file paths) in parameter contexts and swap them when promoting flows between environments.
- **Version process groups through the Git-based Flow Registry**: Git-based Flow Registry Clients are the endorsed versioning mechanism in NiFi 2.x. NiFi Registry is deprecated.

## Performance Optimization

### Concurrent Tasks

- **Start conservatively and scale up**: Begin at the default concurrent task count (1) and raise it based on observed throughput.
- **Increase threads for I/O-bound processors**: InvokeHTTP, PutDatabaseRecord, and PutS3Object all benefit from higher concurrent tasks (4-16+) because they spend time waiting on external systems.
- **Constrain threads for CPU-bound processors**: Transformation processors such as JoltTransformJSON and ConvertRecord can create thread contention if over-parallelized. Watch CPU utilization closely.
- **Remember cluster multiplication**: In a cluster, the effective concurrent task count = (configured value) x (number of nodes).

### Batch Size and FlowFile Management

- **Consolidate records into larger FlowFiles**: Handling 1,000 records in a single FlowFile is far more efficient than processing 1,000 individual FlowFiles. Use MergeRecord or MergeContent to combine small FlowFiles.
- **Merge before egress**: Combine small FlowFiles before writing to destinations (S3, HDFS, databases) to cut overhead and avoid small-file accumulation.
- **Avoid unnecessary splits**: SplitRecord and SplitText generate large numbers of FlowFiles. Split only when individual records are genuinely required downstream.
- **Choose an appropriate Run Schedule**: A timer-driven schedule of 0 sec runs at maximum speed. For polling processors, longer intervals (1 sec, 5 sec) reduce CPU waste during idle periods.

### Repository Configuration

- **Put repositories on dedicated fast disks**: The FlowFile, Content, and Provenance Repositories should each reside on separate physical disks (SSDs recommended) to eliminate I/O contention.
- **Partition the Content Repository across multiple disks**: Spreading partitions across disks increases parallel I/O throughput.
- **Right-size the Provenance Repository**: Provenance indexing generates substantial I/O. Set retention limits that balance compliance requirements against performance impact:
  ```
  nifi.provenance.repository.max.storage.time=30 days
  nifi.provenance.repository.max.storage.size=10 GB
  ```
- **Tune the JVM heap size**: Give NiFi's JVM 50-75% of available RAM. The remainder is used by the OS for disk caching, which is essential for repository performance:
  ```
  # bootstrap.conf
  java.arg.2=-Xms4g
  java.arg.3=-Xmx4g
  ```

### Content Repository Sizing

- Allocate 2-3x the expected in-flight data volume
- Track disk usage with the MonitorDiskUsage reporting task
- NVMe SSDs are recommended for high-throughput deployments; evaluate network storage (NFS, EBS) carefully for latency before relying on it

## Error Handling

### Retry Patterns

- **Configure penalty and yield durations**: Penalty duration determines how long a FlowFile waits before a retry attempt. Yield duration controls how long the processor pauses after an error.
- **Use the RetryFlowFile processor**: It tracks retry counts and routes to `retries_exceeded` once a configurable limit is reached, guarding against infinite retry loops.
- **Implement exponential backoff**: Use UpdateAttribute to record the retry count, then apply ControlRate or the Wait processor to impose progressively longer delays between retries.

### Failure Routing

- **Always wire the failure relationship**: Never auto-terminate `failure` on production processors. Route failures to dedicated error-handling flows instead.
- **Log failures with context**: Pass failed FlowFiles through LogAttribute or LogMessage to record error details, FlowFile attributes, and surrounding context.
- **Distinguish transient from permanent failures**: Transient errors (network timeouts, temporary unavailability) warrant retries. Permanent errors (malformed data, schema violations) should be directed to dead letter flows.

### Dead Letter Pattern

```
[Processor] --failure--> [UpdateAttribute: add error metadata]
                              |
                              v
                         [RouteOnAttribute: transient vs permanent?]
                              |                    |
                         (transient)          (permanent)
                              |                    |
                              v                    v
                    [RetryFlowFile]     [PutFile: dead_letter/]
                         |        |
                    (retry)  (retries_exceeded)
                         |        |
                         v        v
                   [Original]  [PutFile: dead_letter/]
```

- Write failed FlowFiles to a dead letter destination (file system, S3, database)
- Attach error metadata to each FlowFile (error message, timestamp, originating processor, retry count)
- Build the flow to support reprocessing so that failed FlowFiles can be resubmitted once the root cause is fixed
- Set up alerting on dead letter queues so failures are not silently accumulating

## Security Best Practices

### Least Privilege

- Scope user access to specific process groups using NiFi's policy-based authorization model
- Provision dedicated service accounts for each NiFi node and integration point
- Restrict access to controller services — database connection pools and SSL contexts hold sensitive credentials

### Sensitive Properties

- Store credentials in Parameter Contexts — never embed passwords, API keys, or connection strings directly in processor properties
- Pull secrets from external stores via Parameter Providers (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)
- NiFi encrypts sensitive property values within flow.json.gz using the configured sensitive properties key

### Network Security

- Enforce HTTPS for all web UI and REST API access (default port 8443)
- Enable mutual TLS for inter-node communication in clusters
- Use `tls-toolkit` to automate keystore and truststore generation
- Limit network access through firewalls and security group rules

## Deployment

### Docker

- Use the official images: `apache/nifi:2.x.x`
- Mount external volumes for all three repositories — never rely on container-local storage:
  ```yaml
  volumes:
    - nifi-content:/opt/nifi/content_repository
    - nifi-flowfile:/opt/nifi/flowfile_repository
    - nifi-provenance:/opt/nifi/provenance_repository
    - nifi-conf:/opt/nifi/conf
  ```
- Build custom extension images using multi-stage Dockerfiles
- Externalize all configuration through environment variables or mounted config files

### Kubernetes

- **Deploy as a StatefulSet**: NiFi depends on stable network identifiers and persistent storage
- **Select high-performance storage classes**: Use SSDs (gp3/io1 on AWS, premium-lv on Azure) for repository PVCs. Avoid network-attached HDDs.
- **Consider single-node deployments**: Running multiple independent single-node NiFi instances (one per pipeline or team) is often simpler and more resilient than managing a cluster on K8s.
- **Leverage NiFi 2.x K8s clustering**: Removes the ZooKeeper dependency by using Leases and ConfigMaps instead
- **Evaluate the NiFiKop operator**: Konpyutaika NiFiKop automates cluster provisioning, scaling, and lifecycle management on Kubernetes
- **Set resource requests and limits**: Production NiFi workloads typically require at least 4-8 GB RAM

### Monitoring Integration

- **Prometheus + Grafana**: Deploy PrometheusReportingTask to export metrics. Push to Prometheus PushGateway or expose a pull endpoint.
- **REST API polling**: Use `/nifi-api/system-diagnostics` and `/nifi-api/flow/cluster/summary` for programmatic health checks
- **Reporting Tasks**: MonitorDiskUsage, MonitorMemory, ControllerStatusReportingTask, SiteToSiteProvenanceReportingTask
- **Log aggregation**: Forward nifi-app.log, nifi-user.log, and nifi-bootstrap.log to ELK/Splunk/CloudWatch
- **Alert on back pressure**: Watch connection queue depths and fire alerts as queues approach their configured thresholds

## Migration: NiFi 1.x to 2.x

### Pre-Migration Checklist

1. **Upgrade to NiFi 1.27.0 first**: The 2.0 migration path requires starting from 1.27.0. Jumping directly from an earlier 1.x release is not supported.
2. **Review nifi-deprecation.log**: Included in recent 1.x builds, this log identifies deprecated features and components that are still in use.
3. **Inventory deprecated components**: Audit all processors, controller services, and reporting tasks against the 2.0 removal list.
4. **Validate Java 21 compatibility**: Confirm that all custom NARs and extensions compile and run correctly on Java 21.
5. **Plan the Kafka migration**: All legacy Kafka processors have been removed. Transition to controller service-based ConsumeKafka/PublishKafka.
6. **Plan for Hive removal**: All Hive components are gone. Replace them with JDBC-based alternatives.

### Breaking Changes

| Area | Change | Action |
|---|---|---|
| Java | Java 21 required | Update JDK on all nodes |
| Kafka | All legacy Kafka processors removed | Migrate to controller service-based processors |
| Hive | All Hive components removed | Migrate to JDBC alternatives |
| Cache | Distributed*Cache* services renamed | Update bundle coordinates in flow.json.gz |
| Kerberos | Only KerberosUserService retained | Consolidate Kerberos configuration |
| Templates | Support removed | Convert templates to versioned process groups |
| UI | Advanced UI path changed to `/` | Update automation/bookmarks |
| NARs | Some components relocated | Update bundle coordinates |

### Migration Steps

1. Upgrade to NiFi 1.27.0 and clear all deprecation warnings
2. Back up all flow configurations, repositories, and NiFi property files
3. Replace deprecated components with their recommended successors
4. Install Java 21 and deploy the NiFi 2.x binaries
5. Update bundle coordinates in flow.json.gz for renamed or relocated components
6. Migrate all Kafka flows to controller service-based processors
7. Run thorough tests in a non-production environment before cutting over
8. Update monitoring and automation scripts to reflect any API or path changes
