# senior-data-engineer reference

## Troubleshooting

### Pipeline Failures

**Symptom:** Airflow DAG fails with timeout
```
Task exceeded max execution time
```

**Solution:**
1. Review resource allocation settings
2. Profile the slow operations to identify bottlenecks
3. Introduce incremental processing
```python
# Increase timeout
default_args = {
    'execution_timeout': timedelta(hours=2),
}

# Or use incremental loads
WHERE updated_at > '{{ prev_ds }}'
```

---

**Symptom:** Spark job OOM
```
java.lang.OutOfMemoryError: Java heap space
```

**Solution:**
1. Raise the executor memory allocation
2. Decrease the partition size
3. Enable disk spill to offload memory pressure
```python
spark.conf.set("spark.executor.memory", "8g")
spark.conf.set("spark.sql.shuffle.partitions", "200")
spark.conf.set("spark.memory.fraction", "0.8")
```

---

**Symptom:** Kafka consumer lag increasing
```
Consumer lag: 1000000 messages
```

**Solution:**
1. Raise consumer parallelism
2. Streamline the processing logic
3. Scale out the consumer group
```bash
# Add more partitions
kafka-topics.sh --alter \
  --bootstrap-server localhost:9092 \
  --topic user-events \
  --partitions 24
```

---

### Data Quality Issues

**Symptom:** Duplicate records appearing
```
Expected unique, found 150 duplicates
```

**Solution:**
1. Introduce deduplication logic into the pipeline
2. Switch to merge/upsert operations
```sql
-- dbt incremental with dedup
{{
    config(
        materialized='incremental',
        unique_key='order_id'
    )
}}

SELECT * FROM (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY updated_at DESC
        ) as rn
    FROM {{ source('raw', 'orders') }}
) WHERE rn = 1
```

---

**Symptom:** Stale data in tables
```
Last update: 3 days ago
```

**Solution:**
1. Inspect the status of the upstream pipeline
2. Confirm source system availability
3. Implement freshness monitoring
```yaml
# dbt freshness check
sources:
  - name: "raw"
    freshness:
      warn_after: {count: 12, period: hour}
      error_after: {count: 24, period: hour}
    loaded_at_field: _loaded_at
```

---

**Symptom:** Schema drift detected
```
Column 'new_field' not in expected schema
```

**Solution:**
1. Update the data contract to reflect the new schema
2. Adjust the downstream transformations accordingly
3. Notify upstream producers of the change
```python
# Handle schema evolution
df = spark.read.format("delta") \
    .option("mergeSchema", "true") \
    .load("/data/orders")
```

---

### Performance Issues

**Symptom:** Query takes hours
```
Query runtime: 4 hours (expected: 30 minutes)
```

**Solution:**
1. Examine the query execution plan
2. Apply appropriate partitioning
3. Optimize join strategies
```sql
-- Before: Full table scan
SELECT * FROM orders WHERE order_date = '2024-01-15';

-- After: Partition pruning
-- Table partitioned by order_date
SELECT * FROM orders WHERE order_date = '2024-01-15';

-- Add clustering for frequent filters
ALTER TABLE orders CLUSTER BY (customer_id);
```

---

**Symptom:** dbt model takes too long
```
Model fct_orders completed in 45 minutes
```

**Solution:**
1. Switch to incremental materialization
2. Trim unnecessary upstream dependencies
3. Pre-aggregate data at earlier stages where feasible
```sql
-- Convert to incremental
{{
    config(
        materialized='incremental',
        unique_key='order_id',
        on_schema_change='sync_all_columns'
    )
}}

SELECT * FROM {{ ref('stg_orders') }}
{% if is_incremental() %}
WHERE _loaded_at > (SELECT MAX(_loaded_at) FROM {{ this }})
{% endif %}
```
