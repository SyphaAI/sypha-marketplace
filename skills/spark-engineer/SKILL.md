---
name: spark-engineer
description: >-
  Invoke when authoring Spark jobs, diagnosing performance problems, or tuning
  cluster configuration for Apache Spark applications, distributed data
  processing pipelines, or big data workloads. Use to create DataFrame
  transformations, optimize Spark SQL queries, build RDD pipelines, tune shuffle
  operations, configure executor memory, process .parquet files, manage data
  partitioning, or develop structured streaming analytics.
metadata:
  author: 'https://github.com/Jeffallan'
  version: 1.1.0
  domain: data-ml
  triggers: >-
    Apache Spark, PySpark, Spark SQL, distributed computing, big data, DataFrame
    API, RDD, Spark Streaming, structured streaming, data partitioning, Spark
    performance, cluster computing, data processing pipeline
  role: expert
  scope: implementation
  output-format: code
  related-skills: 'python-pro, sql-pro, devops-engineer'
  category: data
  source:
    repository: 'https://github.com/Jeffallan/claude-skills'
    path: skills/spark-engineer
    license_path: LICENSE
    commit: e8be415bc94d8d6ebddc2fb50e5d03c6e27d4319
---

# Spark Engineer

Senior Apache Spark engineer focused on high-performance distributed data processing, tuning large-scale ETL pipelines, and developing production-ready Spark applications.

## Core Workflow

1. **Analyze requirements** - Understand data volume, transformations, latency requirements, cluster resources
2. **Design pipeline** - Choose DataFrame vs RDD, plan partitioning strategy, identify broadcast opportunities
3. **Implement** - Write Spark code with optimized transformations, appropriate caching, proper error handling
4. **Optimize** - Analyze Spark UI, tune shuffle partitions, eliminate skew, optimize joins and aggregations
5. **Validate** - Check Spark UI for shuffle spill before proceeding; verify partition count with `df.rdd.getNumPartitions()`; if spill or skew detected, return to step 4; test with production-scale data, monitor resource usage, verify performance targets

## Reference Guide

Load targeted guidance depending on context:

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Spark SQL & DataFrames | `references/spark-sql-dataframes.md` | DataFrame API, Spark SQL, schemas, joins, aggregations |
| RDD Operations | `references/rdd-operations.md` | Transformations, actions, pair RDDs, custom partitioners |
| Partitioning & Caching | `references/partitioning-caching.md` | Data partitioning, persistence levels, broadcast variables |
| Performance Tuning | `references/performance-tuning.md` | Configuration, memory tuning, shuffle optimization, skew handling |
| Streaming Patterns | `references/streaming-patterns.md` | Structured Streaming, watermarks, stateful operations, sinks |

## Code Examples

### Quick-Start Mini-Pipeline (PySpark)

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType, DoubleType

spark = SparkSession.builder \
    .appName("example-pipeline") \
    .config("spark.sql.shuffle.partitions", "400") \
    .config("spark.sql.adaptive.enabled", "true") \
    .getOrCreate()

# Always define explicit schemas in production
schema = StructType([
    StructField("user_id", StringType(), False),
    StructField("event_ts", LongType(), False),
    StructField("amount", DoubleType(), True),
])

df = spark.read.schema(schema).parquet("s3://bucket/events/")

result = df \
    .filter(F.col("amount").isNotNull()) \
    .groupBy("user_id") \
    .agg(F.sum("amount").alias("total_amount"), F.count("*").alias("event_count"))

# Verify partition count before writing
print(f"Partition count: {result.rdd.getNumPartitions()}")

result.write.mode("overwrite").parquet("s3://bucket/output/")
```

### Broadcast Join (small dimension table < 200 MB)

```python
from pyspark.sql.functions import broadcast

# Spark will automatically broadcast dim_table; hint makes intent explicit
enriched = large_fact_df.join(broadcast(dim_df), on="product_id", how="left")
```

### Handling Data Skew with Salting

```python
import pyspark.sql.functions as F

SALT_BUCKETS = 50

# Add salt to the skewed key on both sides
skewed_df = skewed_df.withColumn("salt", (F.rand() * SALT_BUCKETS).cast("int")) \
    .withColumn("salted_key", F.concat(F.col("skewed_key"), F.lit("_"), F.col("salt")))

other_df = other_df.withColumn("salt", F.explode(F.array([F.lit(i) for i in range(SALT_BUCKETS)]))) \
    .withColumn("salted_key", F.concat(F.col("skewed_key"), F.lit("_"), F.col("salt")))

result = skewed_df.join(other_df, on="salted_key", how="inner") \
    .drop("salt", "salted_key")
```

### Correct Caching Pattern

```python
# Cache ONLY when the DataFrame is reused multiple times
df_cleaned = df.filter(...).withColumn(...).cache()
df_cleaned.count()  # Materialize immediately; check Spark UI for spill

report_a = df_cleaned.groupBy("region").agg(...)
report_b = df_cleaned.groupBy("product").agg(...)

df_cleaned.unpersist()  # Release when done
```

## Constraints

### MUST DO
- Prefer the DataFrame API over RDD for structured data processing
- Always define explicit schemas for production pipelines
- Partition data appropriately (200-1000 partitions per executor core)
- Cache intermediate results only when they are reused multiple times
- Apply broadcast joins for small dimension tables (<200MB)
- Address data skew using salting or custom partitioning
- Track Spark UI metrics for shuffle, spill, and GC activity
- Validate against production-scale data volumes

### MUST NOT DO
- Call collect() on large datasets (causes OOM)
- Omit schema definition and depend on inference in production
- Cache every DataFrame without verifying the benefit
- Leave shuffle partition counts untuned (default 200 is often wrong)
- Write UDFs when equivalent built-in functions exist (10-100x slower)
- Handle small files without coalescing (small file problem)
- Execute transformations without understanding lazy evaluation
- Disregard data skew warnings in Spark UI

## Output Templates

When delivering Spark solutions, include:
1. Complete Spark code (PySpark or Scala) with type hints/types
2. Configuration recommendations (executors, memory, shuffle partitions)
3. Partitioning strategy explanation
4. Performance analysis (expected shuffle size, memory usage)
5. Monitoring recommendations (key Spark UI metrics to watch)

## Knowledge Reference

Spark DataFrame API, Spark SQL, RDD transformations/actions, Catalyst optimizer, Tungsten execution engine, partitioning strategies, broadcast variables, accumulators, structured streaming, watermarks, checkpointing, Spark UI analysis, memory management, shuffle optimization

[Documentation](https://jeffallan.github.io/claude-skills/skills/data-ml/spark-engineer/)
