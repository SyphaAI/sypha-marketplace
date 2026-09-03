# SQL Basics

## Core statements

- `CREATE OR REFRESH STREAMING TABLE` — continuous incremental processing. See [streaming-table-sql.md](streaming-table-sql.md).
- `CREATE OR REFRESH MATERIALIZED VIEW` — defines a batch table. See [materialized-view-sql.md](materialized-view-sql.md).
- `CREATE TEMPORARY VIEW` — pipeline-scoped view. See [temporary-view-sql.md](temporary-view-sql.md).
- `CREATE VIEW` — publishes a view to UC. See [view-sql.md](view-sql.md).
- `AUTO CDC INTO` (inside `CREATE FLOW`) — CDC ingestion. See [auto-cdc-sql.md](auto-cdc-sql.md).
- `CREATE FLOW ... AS INSERT INTO [ONCE] target_table` — append and backfill flows. See [streaming-table-sql.md](streaming-table-sql.md).

## Source functions (streaming)

Used as `FROM STREAM read_*(...)` within a streaming table definition:

- `read_files(path, format => '...')` — Auto Loader. See [auto-loader-sql.md](auto-loader-sql.md).
- `read_kafka(bootstrapServers => '...', subscribe => '...')` — Kafka. Also covers Event Hubs via Kafka protocol. See [kafka.md](kafka.md).
- `read_kinesis(streamName => '...', region => '...')` — AWS Kinesis.
- `read_pubsub(subscriptionId => '...', topicId => '...')` — GCP Pub/Sub.
- `read_pulsar(serviceUrl => '...', topics => '...')` — Apache Pulsar.

## Critical rules

- ✅ Prefer `CREATE OR REFRESH` over bare `CREATE` for SDP datasets (the idiomatic convention; both forms parse correctly).
- ✅ Use `FROM STREAM(table)` (function form with parentheses) for table sources in streaming tables; use `FROM STREAM read_files(...)` (no extra parentheses) for function sources.
- ❌ Never use the `LIVE.` prefix when reading sibling datasets — it is deprecated and errors in modern pipelines.
- ❌ Never use `CREATE LIVE TABLE` / `CREATE STREAMING LIVE TABLE` / `CREATE TEMPORARY LIVE VIEW` — all are legacy. (Exception: `CREATE LIVE VIEW` is kept for the edge case of attaching expectations to a temp view — see [temporary-view-sql.md#using-expectations-with-temporary-views](temporary-view-sql.md#using-expectations-with-temporary-views).)
- ❌ Never `CREATE OR REPLACE STREAMING TABLE` — that is standard SQL, not SDP. Use `CREATE OR REFRESH`.
- ❌ `PIVOT` clause is not supported.

## Streaming vs batch

`STREAM(...)` enables streaming semantics; omit it for batch reads. Streaming tables require streaming reads, and materialized views require batch reads.

## `GROUP BY ALL`

Prefer `SELECT category, region, SUM(sales) FROM t GROUP BY ALL` over explicitly listing grouping columns — reduces drift when columns are added or removed and eliminates the risk of omitting a column from the `GROUP BY` clause.

## Configuration

- Reference pipeline configuration values via `${var_name}` interpolation in SQL files.
- Use `SET key = value;` for Spark-level configuration.

## Python UDFs in SQL

UDFs must be declared in a Python file within the pipeline (a `@dp.temporary_view()` alone is insufficient — you need a top-level `spark.udf.register(...)` call or a UC SQL UDF). SQL files can then invoke them by name.

## `skipChangeCommits`

```sql
CREATE OR REFRESH STREAMING TABLE downstream
AS SELECT * FROM STREAM read_stream("upstream_table", skipChangeCommits => true);
```

Use this when reading from a streaming table that carries updates or deletes (GDPR purges, Auto CDC targets). Without it, change commits will fail.
