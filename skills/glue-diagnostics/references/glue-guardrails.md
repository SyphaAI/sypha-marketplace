# Glue Anti-Misdiagnosis Guardrails

Review these guardrails BEFORE reaching a conclusion on any AWS Glue issue.

## Guardrail 1: DPU Sizing Is Not One-Size-Fits-All
G.1X (16 GB) handles standard ETL workloads. G.2X (32 GB) is required for memory-intensive joins and aggregations. G.4X (64 GB) and G.8X (128 GB) are reserved for ML transforms and very large datasets. Under-provisioning leads to OOM errors; over-provisioning wastes budget. Always verify the worker type and worker count before diagnosing performance problems.

## Guardrail 2: Executor OOM and Driver OOM Have Different Root Causes
Executor OOM indicates that individual data partitions exceed the available worker memory. Resolve it by repartitioning data or upgrading the worker type. Driver OOM indicates that too much data is being pulled into the driver node. Resolve it by eliminating collect() calls, lowering broadcast join thresholds, or removing groupBy operations that funnel results to the driver. Never apply the same remedy to both failure modes.

## Guardrail 3: Job Bookmarks Require Explicit Code Integration
Job bookmarks function only with S3 and JDBC sources. The job script must invoke job.init() at the beginning and job.commit() at the end. Without those calls, bookmark state is never recorded. Resetting a bookmark triggers full reprocessing of all data. Never claim bookmarks operate automatically without the required code changes.

## Guardrail 4: Crawler Schema Changes Depend on Policy
Crawlers carry a SchemaChangePolicy with UpdateBehavior (UPDATE_IN_DATABASE or LOG) and DeleteBehavior (DELETE_FROM_DATABASE, LOG, DEPRECATE_IN_DATABASE). UPDATE_IN_DATABASE replaces the existing schema. LOG records changes without altering the table. Never assume crawlers handle schema evolution correctly by default.

## Guardrail 5: Glue Connections Require Full VPC Networking
JDBC connections depend on a VPC, subnet, and security group. The subnet must have a route to the target database. For Glue service connectivity, the subnet requires either a NAT gateway for internet access or VPC endpoints for Glue and S3. Security groups must include self-referencing inbound rules for Glue ENIs. Never imply JDBC connections work without proper VPC configuration.

## Guardrail 6: Job Timeout Defaults to 48 Hours
The default job timeout is 2880 minutes (48 hours). Jobs that hang or run inefficiently can silently burn DPUs for two full days. Always recommend an explicit timeout sized to the expected job duration. A stalled job running at 10 DPUs for 48 hours incurs far more cost than anticipated.

## Guardrail 7: Glue Version Determines Available Features
Glue 2.0 uses Spark 2.4 and Python 3.7. Glue 3.0 uses Spark 3.1 with optimized shuffle and auto-scaling. Glue 4.0 uses Spark 3.3 with Python 3.10 and Ray support. Libraries, APIs, and runtime behaviors differ across versions. Never recommend features from one version when the job is running on a different version.

## Guardrail 8: Data Catalog Is Not a Real-Time View of S3
The Glue Data Catalog holds metadata about tables and partitions. It does not automatically stay in sync with S3. Newly added S3 partitions remain invisible until a crawler runs or MSCK REPAIR TABLE / batch-create-partition is executed. Never treat the Catalog as a live reflection of S3 state.

## Guardrail 9: Spark UI Is Only Available for Glue 2.0+
The Spark UI for performance debugging is available on Glue version 2.0 and later. It must be enabled by setting --enable-spark-ui to true and supplying an S3 path for Spark event logs. It is not available on Glue 0.9 or 1.0 jobs. Never reference the Spark UI when working with legacy Glue versions.

## Guardrail 10: Partition Count Directly Impacts Performance
Too many small partitions (< 1 MB each) create excessive S3 LIST API calls and task scheduling overhead. Too few large partitions (> 1 GB each) cause executor OOM and reduce parallelism. Target 128 MB–512 MB per partition. Use coalesce() to lower the partition count or repartition() to raise it.

## Guardrail 11: Glue Studio Visual Editor Has Transform Limitations
Glue Studio's visual editor covers common transforms (ApplyMapping, Filter, Join, SelectFields) but does not expose all PySpark/Scala operations. Complex logic such as window functions, UDFs, or multi-step aggregations must be implemented via custom code nodes or script-only jobs. Never state that all transformations are available in the visual editor.

## Guardrail 12: S3 Strong Consistency Does Not Eliminate All Race Conditions
S3 has delivered strong read-after-write consistency since December 2020. However, Glue Data Catalog metadata updates, crawler runs, and job bookmark state changes are independent operations that may not be immediately consistent with S3 object-level changes. Race conditions can still arise between concurrent jobs writing to the same S3 prefix and catalog update operations.
