# NiFi Architecture Deep Dive

## Flow-Based Programming Model

NiFi is built on the Flow-Based Programming (FBP) paradigm, in which data moves as independent packets (FlowFiles) through a network of black-box processors joined by explicitly defined, configurable connections. Processors run asynchronously on independent schedules, and back pressure is built in for flow control. The project originated at the NSA as "Niagarafiles" and was donated to Apache in 2014.

### FlowFile Internals

A FlowFile consists of two parts:

**Attributes** (key-value metadata):
- Standard fields: `uuid`, `filename`, `path`, `entryDate`, `lineageStartDate`
- MIME type: `mime.type` (populated by the IdentifyMimeType processor)
- Custom: any key-value pair attached by processors such as UpdateAttribute, EvaluateJsonPath, or ExtractText
- Attributes travel alongside the FlowFile and are kept in memory (lightweight)

**Content** (data payload):
- Persisted in the Content Repository on disk; the FlowFile holds a pointer to it
- Immutable — when a processor modifies content, NiFi generates a new content claim (copy-on-write)
- Reference counting supports deduplication: cloned FlowFiles share the same content claim until one is modified
- FlowFiles accommodate very large objects (multi-GB files) without loading content into heap memory

### Processor Execution Model

Each processor exposes configurable execution parameters:

- **Concurrent Tasks**: Thread count allocated to the processor (default: 1). Raise this value for I/O-bound processors (InvokeHTTP, PutDatabaseRecord); keep it lower for CPU-bound processors.
- **Run Schedule**: Timer-driven (fixed interval), cron-driven (cron expression), or event-driven (activated by incoming FlowFiles from upstream)
- **Penalty Duration**: The time a FlowFile waits before being retried (default: 30 sec)
- **Yield Duration**: How long a processor suspends itself after encountering an error (default: 1 sec)
- **Bulletin Level**: The minimum severity that triggers a bulletin message (DEBUG, INFO, WARNING, ERROR)

Processors declare **Relationships** (success, failure, matched, unmatched, etc.) that govern routing decisions. Every relationship must either connect to a downstream processor or be auto-terminated. Auto-terminating the `failure` relationship silently discards errors — this should be avoided in production.

### Connection and Back Pressure Mechanics

Connections act as bounded queues between processors and enforce two configurable back pressure thresholds:

1. **Object Threshold** (default: 10,000 FlowFiles): Maximum number of queued FlowFiles
2. **Data Size Threshold** (default: 1 GB): Maximum combined content size

When either threshold is breached:
- The upstream processor is **no longer scheduled**
- The connection turns yellow/red in the UI
- Downstream processing continues to drain the queue
- Once the queue falls back below the thresholds, the upstream processor resumes

These are **soft limits** — a processor that emits multiple FlowFiles within a single execution may momentarily exceed the threshold before back pressure applies.

Additional flow control options:
- **FlowFile expiration**: Automatically drops FlowFiles that have exceeded a configurable TTL
- **Prioritization**: FirstInFirstOut (default), NewestFlowFileFirst, OldestFlowFileFirst, PriorityAttribute
- **Load balancing** (clusters): Round Robin, Single Node, Partition by Attribute — distributes FlowFiles across cluster nodes

## Core Repositories

### FlowFile Repository

- Write-Ahead Log (WAL) tracking current FlowFile metadata
- Stores FlowFile attributes and pointers to content claims
- Enables crash recovery — on restart NiFi reconstructs state from the WAL
- Requires fast storage (SSD recommended) for good performance
- Disk footprint scales with the number of in-flight FlowFiles, not content size

### Content Repository

- Holds actual data payloads via content claims
- Uses reference counting to deduplicate content (cloned FlowFiles share the same claim)
- Content modifications follow copy-on-write semantics
- Content claims are garbage-collected once no FlowFile references them
- Can be spread across multiple disk partitions for parallel I/O throughput:
  ```
  nifi.content.repository.directory.default=./content_repository
  nifi.content.repository.directory.disk2=/data2/content_repository
  nifi.content.repository.directory.disk3=/data3/content_repository
  ```
- Allocate 2-3x the expected in-flight data size

### Provenance Repository

- Full history and lineage for every FlowFile
- Indexed through Apache Lucene for fast queries (default 500 MB per shard)
- Journals are merged and compressed every 30 seconds
- Configurable retention:
  ```
  nifi.provenance.repository.max.storage.time=30 days
  nifi.provenance.repository.max.storage.size=10 GB
  nifi.provenance.repository.rollover.time=30 secs
  ```
- Event types: CREATE, RECEIVE, SEND, CLONE, FORK, JOIN, ROUTE, MODIFY_CONTENT, MODIFY_ATTRIBUTES, DROP, EXPIRE, DOWNLOAD, FETCH, ADDINFO
- Enables lineage visualization (DAG), point-in-time replay, and compliance auditing
- Performance note: provenance indexing can drive substantial I/O on high-volume flows. Place it on a dedicated disk and restrict `nifi.provenance.repository.indexed.fields` to only the fields you need.

## Clustering Architecture

### ZooKeeper-Based Clustering (1.x and 2.x Non-K8s)

NiFi uses **zero-leader clustering**: every node works on separate data performing equivalent tasks. No node acts as a work distributor to the others.

Key roles:
- **Cluster Coordinator** (elected by ZooKeeper): Handles cluster membership, node heartbeats, and disconnection/reconnection events
- **Primary Node** (elected by ZooKeeper): Executes "isolated" processors — those configured to run on a single node only (e.g., ListFile) to prevent duplicate processing

Flow configuration changes applied to any node are propagated to all nodes through the Cluster Coordinator. Each node independently processes its own slice of data.

ZooKeeper requirements:
- At least 3 instances (must be an odd count for quorum)
- Can run embedded within NiFi or as an external cluster
- Leader election is managed using ephemeral znodes

### Kubernetes-Native Clustering (2.x)

NiFi 2.0 brought native Kubernetes clustering:
- **Kubernetes Leases**: Take over from ZooKeeper for Cluster Coordinator and Primary Node election
- **Kubernetes ConfigMaps**: Replace ZooKeeper znodes as the shared state store
- Removes the need to deploy and manage ZooKeeper on Kubernetes
- The leader election interface was decoupled and promoted into the `nifi-framework-api` library

### Connection Load Balancing

In clusters, connections can distribute FlowFiles across nodes:
- **Round Robin**: Even distribution across all nodes
- **Single Node**: All FlowFiles go to one node
- **Partition by Attribute**: FlowFiles with the same attribute value go to the same node (useful for ordered processing)

## Security Model

### Authentication

- **Mutual TLS (mTLS)**: Always attempted first whenever HTTPS is configured. This method cannot be disabled.
- **LDAP/LDAPS**: Integrates with LDAP directories such as Active Directory and OpenLDAP
- **Kerberos**: SPNEGO-based authentication. In NiFi 2.x, only the Kerberos User Service is retained (supporting keytab, password, and ticket cache).
- **OpenID Connect (OIDC)**: Works with identity providers such as Keycloak and Okta. Includes support for RP-Initiated Logout, refresh tokens, and automatic bearer token renewal.
- **SAML**: SAML 2.0 single sign-on

### Authorization

- Policy-based RBAC applied at the level of individual processors, process groups, controller services, and UI components
- Supports read, write, and component-specific policies
- Multi-tenant: distinct users or groups can be granted access to different sections of the flow
- User and group providers can be file-based or LDAP-based

### Data Protection

- SSL/TLS protects all inter-node and client communication
- Sensitive properties are encrypted at rest within the flow configuration (flow.json.gz)
- Provenance can be encrypted for flows that handle sensitive data
- The `tls-toolkit` command-line utility generates keystores, truststores, and related configuration
- Sensitive values inside Parameter Contexts are encrypted at rest
- Parameter Providers connect to external secret stores (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)

## NiFi 2.x Architectural Changes

### Runtime and Framework

| Component | NiFi 1.x | NiFi 2.x |
|---|---|---|
| Java | 8 or 11 | 21 (required) |
| Web framework | Spring 5 / Jetty 9 | Spring 6 / Jetty 12 / Servlet 6 |
| UI framework | AngularJS | Angular 18 |
| REST API spec | Swagger | OpenAPI 3 |

### Python Processor Support

NiFi 2.x elevated Python 3.10+ to a first-class extension language:
- Processors can be implemented entirely in Python via the NiFi Python API
- Full CPython runtime with access to the pip/conda ecosystem
- Python processors gained state management support in 2.1.0
- Processors can be bundled into NARs along with their dependencies
- Compatible with NiFi's stateless mode for on-demand processing, data enrichment, and inline ML inference
- MiNiFi Java also supports Python processors

### Component Changes

- **Removed**: All legacy Kafka processors (superseded by controller service-based ConsumeKafka/PublishKafka), all Hive components, and numerous deprecated processors
- **Renamed**: DistributedMapCacheServer -> MapCacheServer, DistributedMapCacheClient -> MapCacheClientService
- **Added**: Git-based Flow Registry Clients (the primary versioning mechanism going forward)
- **Deprecated**: NiFi Registry (community vote in Feb 2026; scheduled for removal in 3.0)
- **Removed**: Template support (use registry-based versioning instead)

### Version History

| Version | Date | Key Changes |
|---|---|---|
| 2.0.0 | Nov 2024 | GA: Java 21, Python support, K8s clustering, component removals |
| 2.1.0 | Jan 2025 | State management in Python processors; Python NAR packaging |
| 2.5.0 | 2025 | 150+ issues resolved |
| 2.6.0 | 2025 | 175+ issues resolved |
| 2.8.0 | 2026 | 170+ issues resolved; Record Gauge method in Process Session |

## NiFi REST API

NiFi provides a full-featured REST API for programmatic control:

- **Flow management**: Create, configure, start, and stop processors and connections
- **Provenance queries**: Search for and retrieve data lineage events
- **System diagnostics**: `GET /nifi-api/system-diagnostics` (heap, disk, thread counts)
- **Cluster management**: `GET /nifi-api/controller/cluster` (per-node status)
- **Flow status**: `GET /nifi-api/flow/process-groups/root/status?recursive=true`
- **Connection queues**: `GET /nifi-api/connections/{id}/status` (queue depth and back pressure state)
- **Counters and metrics**: Flow-level counters and data from reporting tasks

When security is enabled, all API endpoints require HTTPS. Authentication uses the same mechanisms as the web UI.
