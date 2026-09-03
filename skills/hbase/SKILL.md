---
name: hbase
description: Apache HBase wide-column store on Hadoop. For big data use cases.
metadata:
  category: data
  source:
    repository: 'https://github.com/G1Joshi/Agent-Skills'
    path: skills/databases/hbase
    license_path: LICENSE
    commit: 2c0eacc6ce39edc2d69a1f55e64984f385bc14f8
---

# Apache HBase

HBase is the database layer for Hadoop. It is a distributed, scalable data store built for big data workloads, offering random and real-time read/write access to your data at scale.

## When to Use

- **Hadoop Ecosystem**: Deeply integrated with HDFS, Hive, and Spark.
- **Petabyte Scale**: Handles billions of rows while maintaining low latency.
- **Random Access**: Required when you need random R/W against HDFS data, which is typically WORM (Write Once Read Many).

## Quick Start

Access via the Java API or the Shell.

```bash
create 'users', 'info', 'data'
put 'users', 'row1', 'info:name', 'Alice'
get 'users', 'row1'
```

## Core Concepts

### Column Families

Columns are organized into column families (`info:name`, `info:email`). Data belonging to the same family is colocated on disk.

### Region Servers

HBase achieves scale by dividing tables into "Regions" and distributing them across Region Servers.

### WAL & MemStore

Each write goes to the Write-Ahead-Log (on disk) and into the MemStore (in RAM). Once the MemStore reaches capacity, it is flushed to an HFile on HDFS.

## Best Practices (2025)

**Do**:

- **Design Row Keys carefully**: Row keys govern sorting and sharding. Sequential keys cause "hotspotting" — use salting or hashing to distribute load.
- **Pre-split Regions**: Avoid starting with a single region. Pre-split according to your expected key distribution.
- **Use Phoenix**: Apache Phoenix adds a SQL layer on top of HBase, enabling use patterns similar to a relational database.

**Don't**:

- **Don't use for small data**: The combined overhead of HDFS, ZooKeeper, and HBase is substantial. This stack is only appropriate at >TB scale.
- **Don't scan excessively**: Full table scans behave like MapReduce jobs in terms of cost.

## References

- [Apache HBase Reference Guide](https://hbase.apache.org/book.html)
