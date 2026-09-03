---
name: apache-hudi-lakehouse
description: >-
  Guides agents through Apache Hudi lakehouse design. Apply when dealing with
  incremental upserts, record-level mutations, timeline behavior, compaction,
  and Hudi-based lakehouse tables.
metadata:
  category: data
  source:
    repository: 'https://github.com/vaquarkhan/data-engineering-agent-skills'
    path: skills/apache-hudi-lakehouse
    license_path: LICENSE
    commit: 421ef57e8d42c464b29339193c18dd5bd2946bc2
---

# Apache Hudi Lakehouse

## Overview

Use this skill when `Apache Hudi` is the primary table layer for incremental lakehouse workloads. It helps agents reason about mutation-heavy patterns, select table types, plan compaction behavior, ensure timeline safety, and understand what consumers require across read-optimized and real-time query paths.

## When to Use

- selecting or running `Apache Hudi` for lakehouse tables
- constructing record-level upsert or delete pipelines
- handling compaction, clustering, and incremental consumption
- operating lakehouse tables under heavy mutations (CDC sinks, slowly changing dimensions)
- planning access from multiple engines (Spark, Presto, Trino, Athena, Hive)

Skip this skill when the workload is append-only with no mutation requirements and a simpler format like Parquet or Iceberg would suffice.

## Workflow

1. Identify the mutation patterns and read access expectations.
   Determine:
   - the primary record key and partition path
   - the expected operations: inserts, upserts, deletes, or bulk replaces
   - read latency requirements: can readers accept merge-on-read, or do they need read-optimized snapshots?
   - which query engines require access to the table
   - projected write throughput and record mutation rate

2. Choose the appropriate table type and indexing strategy.
   - `Copy-on-Write (COW)`: best for read-heavy workloads; produces columnar snapshots at write time
   - `Merge-on-Read (MOR)`: best for write-heavy workloads; defers merging to read time or compaction
   - select a record index type: `BLOOM`, `GLOBAL_BLOOM`, `SIMPLE`, `BUCKET`, or `RECORD_INDEX`
   - the index choice affects upsert performance and how well the table scales
   - document the reasoning for the table type selection — changing it later is expensive

3. Define an explicit plan for compaction and clustering.
   - for MOR tables: compaction converts log files into columnar files — this is mandatory
   - determine the compaction strategy: synchronous (inline) or asynchronous (scheduled)
   - configure compaction triggers: by commit count, elapsed time, or log file size
   - clustering reorganizes the data layout for query efficiency — plan it independently of compaction
   - factor compaction and clustering compute costs into budget planning

4. Define incremental consumption and downstream contracts.
   - incremental queries in Hudi operate from the commit timeline
   - specify the consumer contract: from which commit instant do consumers start?
   - plan for consumer resets and bootstrap reads
   - document how schema changes affect incremental consumers
   - confirm that consumers handle compaction and rollback instants correctly

5. Manage schema evolution and timeline safety.
   - Hudi supports schema evolution, but not all changes are safe for every reader
   - adding columns is usually safe; renames and type changes require careful handling
   - declare compatibility expectations for each reader engine
   - rollback instants can disrupt consumers — document how rollback behaves
   - the archive policy controls timeline visibility for late-arriving consumers

6. Plan operations, monitoring, and recovery.
   - monitor timeline growth, pending compactions, and inflight commits
   - alert on compaction backlog and write failures
   - plan for rollback: Hudi supports instant-level rollback, but consumers must handle gaps in the timeline
   - define retention and archival policies for the Hudi timeline
   - document backup and restore procedures for critical tables

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "Hudi handles upserts so we don't need to think about keys." | The record key and partition path design determines correctness, performance, and scalability. Poorly chosen keys cause silent data loss or duplication. |
| "MOR is always better because writes are faster." | MOR defers work to compaction and read time. Without a compaction plan, read performance degrades indefinitely. |
| "Compaction will just happen in the background." | Compaction requires explicit scheduling, a compute budget, and monitoring. When left unmanaged, it leads to reader degradation and timeline bloat. |
| "All query engines see the same data." | Query types observe different snapshots on COW and MOR tables. On MOR tables, read-optimized queries see only compacted data. |

## Red Flags

- a record key was chosen without understanding its uniqueness guarantees
- a MOR table exists without a compaction schedule or monitoring in place
- incremental consumers have no documented starting instant or reset procedure
- schema changes were deployed without being validated against every reader engine
- timeline growth, pending compactions, and inflight commits are not monitored
- clustering is never executed even as query scan ranges continue to grow
- rollback behavior is undocumented while consumers expect a linear timeline
- the index type remains at its default with no analysis of key cardinality or write patterns

## Verification

- [ ] The record key, partition path, and mutation semantics are explicitly documented
- [ ] The table type selection (COW vs MOR) is supported by a read/write trade-off analysis
- [ ] Compaction has an established schedule, monitoring, and a compute cost budget
- [ ] Contracts for incremental consumers define starting instants and reset behavior
- [ ] Schema evolution paths have been validated against every target query engine
- [ ] Timeline monitoring covers pending compactions, inflight commits, and archival
- [ ] Rollback behavior is documented and consumers can handle timeline gaps safely
