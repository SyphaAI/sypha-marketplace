# Amazon Redshift Architecture Reference

## Cluster Architecture

### Leader Node

The leader node serves as the sole entry point for all client connections and SQL operations:

- **SQL parsing and semantic analysis** -- Validates syntax, resolves object references, and enforces permissions.
- **Query optimization** -- A cost-based optimizer produces an optimal distributed execution plan, accounting for table statistics (gathered by ANALYZE), distribution styles, sort keys, zone maps, and materialized views.
- **Query plan distribution** -- Compiles the plan into C++ code (on first execution), then dispatches compiled segments to compute nodes.
- **Result aggregation** -- Gathers partial results from compute nodes, executes the final merge/sort/limit, and returns results to the client.
- **Metadata storage** -- The system catalog (pg_catalog), user credentials, and cluster metadata all live on the leader node.
- **No user data** -- The leader node holds no user table data; its role is purely coordination.

The leader node is always present (in single-node clusters, the same node functions as both leader and compute).

### Compute Nodes

Compute nodes hold the data and execute query plan segments in parallel:

- **Local storage (DC2)** -- Dense compute nodes backed by NVMe SSD. Data resides locally and capacity is tied to node count.
- **Managed storage (RA3)** -- Nodes treat local NVMe SSD as a high-performance cache, with Amazon S3 providing durable backing storage (Redshift Managed Storage / RMS). Hot data stays cached locally; cold data is pulled from S3 transparently. Storage capacity scales to virtually unlimited levels independently of compute.
- **DS2 nodes** -- Legacy dense storage nodes using HDD. Not recommended for new cluster deployments.

### Node Types (Current Generation)

| Node Type | vCPU | Memory | Storage | Slices | Use Case |
|---|---|---|---|---|---|
| RA3.xlplus | 4 | 32 GB | 32 TB RMS | 2 | Small workloads, dev/test |
| RA3.4xlarge | 12 | 96 GB | 128 TB RMS | 4 | Production workloads |
| RA3.16xlarge | 48 | 384 GB | 128 TB RMS | 16 | Large-scale production |
| DC2.large | 2 | 15 GB | 160 GB SSD | 2 | Small datasets, low latency |
| DC2.8xlarge | 32 | 244 GB | 2.56 TB SSD | 16 | Compute-intensive, <2.56TB/node |

**Elastic resize** adds or removes nodes (altering the slice count). **Classic resize** changes the node type. RA3 clusters can additionally leverage **concurrency scaling** to provision transient compute during demand spikes.

### Slices

Every compute node is partitioned into slices. Each slice:

- Holds its own allocation of memory, CPU, and disk (or cache for RA3).
- Operates on its share of the data independently and in parallel.
- Receives a subset of table rows determined by the table's distribution style.
- Runs query plan steps (scan, join, aggregate) against its local data.

The overall parallelism of a cluster equals the total slice count across all compute nodes. For example, a 4-node RA3.4xlarge cluster contains 4 × 4 = 16 slices.

## Columnar Storage Engine

### 1 MB Block Architecture

Redshift persists each column as a sequence of immutable 1 MB blocks:

- Each block holds compressed values for a single column across a contiguous row range.
- Blocks are the I/O unit: Redshift either reads or skips whole 1 MB blocks.
- Column blocks covering the same row range form a **superblock** (a logical grouping, not a physical entity).
- Block headers carry compression metadata, row count, and zone map information.

### Zone Maps

Zone maps are per-block min/max metadata that Redshift maintains automatically:

- Each 1 MB block records the minimum and maximum values of the data it holds.
- Before reading a block, the query executor inspects the zone map.
- If the query predicate falls outside the block's [min, max] range, the block is skipped entirely.
- Zone maps are what make sort keys essential: a well-sorted column yields narrow min/max ranges per block, allowing the executor to skip aggressively.
- Zone maps are kept current automatically on every column — no user intervention is required.

**Zone map effectiveness depends on data order:**
```
-- Table sorted by order_date
-- Block 1: order_date min=2026-01-01, max=2026-01-15  --> Zone map tight
-- Block 2: order_date min=2026-01-16, max=2026-01-31  --> Zone map tight
-- WHERE order_date = '2026-01-20' skips Block 1 entirely

-- Table NOT sorted by order_date
-- Block 1: order_date min=2020-01-01, max=2026-12-31  --> Zone map useless
-- Block 2: order_date min=2020-03-01, max=2026-11-15  --> Zone map useless
-- WHERE order_date = '2026-01-20' must read ALL blocks
```

### Late Materialization

Redshift applies late materialization to minimize data movement:

1. Predicates are evaluated against individual compressed columns.
2. Only the row positions that satisfy all predicates are collected.
3. The remaining projected columns are materialized (decompressed and assembled) solely for the qualifying rows.

This means a query such as `SELECT name FROM users WHERE age > 30 AND country = 'US'` decompresses the `name` column only for rows that clear both the `age` and `country` filters.

### Compression Architecture

Compression operates at the block level on a per-column basis:

- **Encoding** is specified per column at CREATE TABLE time (or chosen automatically via ENCODE AUTO / ATO).
- **ANALYZE COMPRESSION** samples the data and produces recommendations for optimal encodings.
- Compressed data remains compressed during I/O and while resident in the buffer cache; decompression happens at query execution time.
- Compression ratios of 3:1 to 10:1 are common for well-encoded analytical workloads.

**Encoding selection algorithm (ENCODE AUTO):**
1. New tables with ENCODE AUTO start with RAW encoding.
2. Once enough data has been loaded, background ATO processes examine the data patterns.
3. Redshift chooses the encoding that minimizes storage with acceptable CPU overhead.
4. The leading column of a sort key may use any encoding (the historical RAW-only restriction for sort key columns has been lifted).

## Query Execution Pipeline

### 1. Parse and Analyze

- SQL text reaches the leader node.
- The parser validates syntax and produces an AST.
- The analyzer resolves table/column references, verifies permissions, and binds data types.

### 2. Optimize

The cost-based optimizer:

- Enumerates candidate query plans across join order, join type (hash join, merge join, nested loop), scan type (sequential, zone-map-accelerated), and data distribution options.
- Draws on table statistics (row count, distinct values, null fraction, histogram) gathered by ANALYZE or auto-analyze.
- Accounts for sort key order (to exploit merge joins on pre-sorted data and enable zone map pruning).
- Factors in distribution style (to detect co-located joins versus cases requiring redistribution).
- Explores materialized view rewriting opportunities.
- Chooses the plan with the lowest estimated cost.

### 3. Compile

- The optimized plan is translated into C++ code.
- The compiled code is cached, keyed by query template / parameterized plan.
- **Compilation cache** survives across sessions. The first run of a new query template bears compilation overhead (1-10 seconds); later executions using the same template hit the cache.
- Inspect compilation activity in SVL_COMPILE. Elevated compile times signal a large number of distinct query shapes.

### 4. Distribute and Execute

- Compiled plan segments are pushed to compute nodes.
- Each slice runs its segment in parallel against its local data.
- Inter-slice data movement occurs in these cases:
  - **Redistribution** (DS_DIST_BOTH, DS_DIST_INNER, DS_DIST_ALL_INNER) -- Rows are reshuffled across slices for joins on tables that are not co-located.
  - **Broadcast** (DS_BCAST_INNER) -- A small table is copied to every slice to enable a join.
  - **Sort merge** -- Data is sorted and merged across slices for ORDER BY operations or merge joins.

### 5. Return Results

- Compute nodes send partial results back to the leader node.
- The leader node executes the final aggregation, sorting (where required), and LIMIT.
- Results are streamed to the client.

### Data Movement in Joins (EXPLAIN Plan Labels)

| Label | Meaning | Performance Impact |
|---|---|---|
| `DS_DIST_NONE` | Both tables are co-located on the join key (same DISTKEY) | Best -- no data movement |
| `DS_DIST_ALL_NONE` | Inner table is DISTSTYLE ALL (replicated on every node) | Good -- no data movement |
| `DS_DIST_INNER` | Inner table is redistributed to match outer table's distribution | Moderate -- moves inner table data |
| `DS_DIST_BOTH` | Both tables are redistributed on the join key | Expensive -- moves data from both tables |
| `DS_BCAST_INNER` | Inner table is broadcast to all nodes | Acceptable for small inner tables; costly if inner is large |
| `DS_DIST_ALL_INNER` | Inner table (ALL distribution) is redistributed | Unusual; indicates mismatched distribution |

### Result Caching

Redshift stores query result sets in a cache on the leader node:

- When an identical query is reissued and the underlying data has not changed, the cached result is returned immediately.
- The result cache is cluster-scoped, persists across sessions, and is invalidated whenever data changes.
- Behavior is controlled by `enable_result_cache_for_session` (default ON).
- Cache hits appear in SYS_QUERY_HISTORY with a `source_query` field referencing the original execution.

## Redshift Managed Storage (RMS) Architecture

RA3 nodes operate on a tiered storage design:

1. **Local NVMe SSD cache** -- A multi-TB local cache on each compute node that holds hot blocks (those accessed recently or frequently).
2. **Amazon S3 durable storage** -- All data is stored durably in S3, which serves as the system of record.
3. **Automatic tiering** -- Redshift's caching algorithm tracks block access patterns and retains hot data locally. Cold data is moved to S3 and retrieved on demand.
4. **Prefetching** -- The query executor fetches blocks from S3 in advance of sequential scans.
5. **Cross-AZ durability** -- S3 delivers 99.999999999% (11 nines) durability.

### Snapshots and Recovery

- **Automated snapshots** -- Created every 8 hours or after 5 GB of data changes. Kept for 1-35 days. Incremental — only changed blocks are stored.
- **Manual snapshots** -- User-triggered and retained until explicitly deleted. Can be copied to another region.
- **Restore** -- Provisions a new cluster from a snapshot. The target can differ in node type or count.
- **Table-level restore** -- Recovers individual tables from a snapshot without a full cluster restore.
- **Point-in-time recovery** -- Restores the cluster to any second within the retention window (continuous backup).

## Redshift Serverless Architecture

Redshift Serverless fully decouples compute from storage:

### Workgroups and Namespaces

- **Namespace** -- A logical container for databases, schemas, tables, users, and datashares. Each namespace has a single underlying Redshift Managed Storage instance. Multiple workgroups can share one namespace for data sharing.
- **Workgroup** -- A compute endpoint defined by a base RPU capacity (8-512 RPUs in increments of 8). Scales up automatically from the base when demand increases.
- **RPU (Redshift Processing Unit)** -- An abstract unit of compute capacity. One RPU provides roughly the compute equivalent of one RA3 slice. Billing is per RPU-second of actual usage.

### Auto-Scaling Behavior

1. A query arrives at the workgroup endpoint.
2. If the current RPU allocation cannot handle the load, Redshift Serverless scales up automatically (within seconds).
3. When queries finish and demand falls, RPUs scale back down.
4. Billing covers only the RPU-seconds consumed, with a 60-second minimum per query.
5. The base RPU setting defines the minimum compute that is kept warm at all times (zero cold-start for queries within base capacity).

### Cost Controls

- **Usage limits** -- Define an RPU-hour ceiling per period (daily, weekly, or monthly).
- **Actions on limit breach** -- Log only, dispatch an alert via SNS, or shut down the workgroup.
- **Cross-workgroup isolation** -- Different teams or workloads can target the same namespace through separate workgroups, each governed by its own cost controls and RPU configuration.

## AQUA (Advanced Query Accelerator)

AQUA is a hardware-accelerated distributed cache layer that RA3 nodes can use:

### Architecture

- AQUA nodes reside between compute nodes and Redshift Managed Storage (S3).
- Each AQUA node runs on custom AWS-designed hardware (Nitro-based) with FPGA-accelerated processing.
- AQUA offloads scan filtering and aggregation to the storage/cache tier.
- For selective queries, this can cut the volume of data transferred to compute nodes by orders of magnitude.

### Operations Accelerated by AQUA

- Predicate evaluation (WHERE clause filtering) — particularly LIKE, string comparisons, and numeric comparisons.
- Aggregations (SUM, COUNT, MIN, MAX, AVG) applied to filtered data.
- Scan-heavy queries against large tables.

### AQUA Behavior

- Enabled automatically on RA3 node types — no user configuration is required.
- The query optimizer determines whether to send scan/filter operations to AQUA using cost estimation.
- The performance benefit is most pronounced for queries that scan large data volumes but produce small result sets.
- AQUA activity is visible in SYS_QUERY_DETAIL (indicates whether AQUA handled scan steps).

## Concurrency Scaling

Concurrency scaling delivers burst compute capacity on demand:

1. When WLM queues fill up, Redshift provisions transient concurrency scaling clusters.
2. These clusters are functionally equivalent to the main cluster and have full access to the same data via RMS/S3.
3. Queries are directed to scaling clusters without any change visible to users.
4. Scaling clusters are decommissioned when demand recedes.
5. **Free credit:** Each cluster accrues up to 1 hour of free concurrency scaling credits per day for every 24 hours the cluster remains active.
6. **Beyond free credits:** Usage is billed per-second at the standard on-demand cluster rate.

### Concurrency Scaling Modes

- `auto` (default) -- Redshift activates concurrency scaling automatically as queues grow.
- `off` -- Concurrency scaling is disabled; queries queue in WLM.

Enable per-queue by setting `concurrency_scaling` to `auto` in the target WLM queue configuration.

## Data Sharing Architecture

Data sharing leverages the Redshift Managed Storage layer for zero-copy access:

- **Producer** -- The cluster or serverless namespace that owns the data and publishes the datashare.
- **Consumer** -- The cluster or serverless workgroup that reads the shared data.
- **No data movement** -- Consumers query producer data directly through RMS; the data remains in the producer's S3 storage.
- **Live access** -- Consumers always read the producer's current data — no snapshots or replication lag.
- **Isolation** -- Consumer queries run on consumer compute resources and have no effect on producer performance.
- **Cross-region** -- Data sharing functions across AWS regions (cross-region data transfer costs apply).
- **Cross-account** -- Data can be shared with other AWS accounts.
- **Granularity** -- Sharing can be scoped to the schema, table, view (including materialized views), or UDF level.

## Streaming Ingestion Architecture

Streaming ingestion enables low-latency data intake directly from streaming sources:

1. Redshift establishes a direct connection to Kinesis Data Streams or Amazon MSK (Kafka) topics.
2. Data flows in through a materialized view defined over an external schema FROM KINESIS or FROM MSK.
3. The materialized view is auto-refreshed (typically every 10 seconds to a few minutes, depending on configuration).
4. Incoming records are parsed (JSON, Avro, etc.) and written to Redshift columnar storage.
5. No intermediate staging in S3 or Kinesis Firehose is needed.

## Zero-ETL Integration Architecture

Zero-ETL replication moves data from transactional databases into Redshift:

1. **Change data capture (CDC)** -- Writes to Aurora/RDS are captured from the database engine's transaction log.
2. **Continuous replication** -- Changes are streamed into Redshift with seconds-to-minutes latency.
3. **Schema mapping** -- Source tables are projected onto Redshift tables within a target database.
4. **Automatic schema evolution** -- DDL changes (such as adding a column) are propagated automatically.
5. **Integration management** -- Configured through the AWS Console, CLI, or CloudFormation. Each integration connects one source database to one Redshift target.

Supported sources: Amazon Aurora MySQL, Amazon Aurora PostgreSQL, Amazon RDS MySQL, Amazon RDS PostgreSQL, Amazon DynamoDB.

## Network and Security Architecture

### VPC and Network

- Redshift clusters operate inside a VPC.
- **Enhanced VPC Routing** -- Channels all COPY/UNLOAD traffic through the VPC rather than the public internet, enabling VPC flow logs, VPC endpoints, and network ACLs.
- **VPC endpoints** -- Interface VPC endpoints (PrivateLink) provide private connectivity from other VPCs.
- **Publicly accessible** -- An optional setting that assigns a public IP for external tool access. Not recommended for production environments.

### Encryption

- **At rest** -- AES-256 encryption via AWS KMS (default) or CloudHSM, covering data blocks, system metadata, and snapshots.
- **In transit** -- SSL/TLS secures client connections (enforced through the `require_ssl` parameter).
- **Key rotation** -- Automated key rotation is available for KMS-managed keys.

### Authentication and Authorization

- **IAM authentication** -- Short-lived credentials obtained through the GetClusterCredentials API or IAM identity federation.
- **Native database users** -- Standard CREATE USER with a password.
- **Federated identity** -- SAML 2.0 or OIDC integration for SSO workflows.
- **Role-based access control (RBAC)** -- CREATE ROLE, GRANT ROLE, and a set of system-defined roles (sys:operator, sys:dba, sys:superuser, sys:secadmin, sys:monitor).
- **Row-level security (RLS)** -- CREATE RLS POLICY to limit row visibility on a per-user/role basis.
- **Column-level access control** -- GRANT SELECT scoped to specific columns.
- **Dynamic data masking** -- CREATE MASKING POLICY to obscure sensitive column values according to user/role.
