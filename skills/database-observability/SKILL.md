---
name: database-observability
description: >
  Grafana Cloud Database Observability — query-level performance insights for
  MySQL and PostgreSQL. Covers Grafana Alloy setup, query samples, visual
  explain plans, RED metrics, pg_stat_statements and Performance Schema
  integration, and trace correlation with application data. Trigger when
  monitoring database performance, diagnosing slow queries, configuring database
  observability for MySQL or PostgreSQL (self-managed, RDS, Aurora, Azure, Cloud
  SQL), or linking DB metrics with APM data.
metadata:
  category: observability
  source:
    repository: 'https://github.com/grafana/skills'
    path: skills/grafana-cloud/database-observability
    license_path: LICENSE
    commit: e8424d242290be2ae187a74b5fd854174f0c5411
---

# Grafana Cloud Database Observability

> **Docs**: https://grafana.com/docs/grafana-cloud/monitor-applications/database-observability/

Delivers query-level insights (RED metrics, query samples, explain plans) for MySQL and PostgreSQL
with no application code changes required. Generally Available as of April 2026.

## Supported Databases

| Database | Variants |
|----------|---------|
| **MySQL** | Self-managed, RDS MySQL, Aurora MySQL, Cloud SQL MySQL, Azure Database for MySQL |
| **PostgreSQL** | Self-managed, RDS PostgreSQL, Aurora PostgreSQL, Cloud SQL PostgreSQL, Azure Database for PostgreSQL |

## Prerequisites

### PostgreSQL

```sql
-- 1. Enable pg_stat_statements in postgresql.conf
-- shared_preload_libraries = 'pg_stat_statements'
-- Then restart PostgreSQL

-- 2. Create monitoring user
CREATE USER grafana_monitoring WITH PASSWORD 'secret';
GRANT pg_monitor TO grafana_monitoring;
GRANT CONNECT ON DATABASE mydb TO grafana_monitoring;

-- 3. Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### MySQL

```sql
-- Create monitoring user with least-privilege permissions
CREATE USER 'grafana_monitoring'@'%' IDENTIFIED BY 'secret';
GRANT SELECT, PROCESS, REPLICATION CLIENT ON *.* TO 'grafana_monitoring'@'%';
GRANT SELECT ON performance_schema.* TO 'grafana_monitoring'@'%';
FLUSH PRIVILEGES;
```

## Alloy Configuration

### PostgreSQL

```alloy
database_observability.postgres "mydb" {
  data_source_name = "postgresql://grafana_monitoring:secret@localhost:5432/mydb?sslmode=disable"

  enable_collectors = ["pg_stat_statements", "query_samples", "schema_details"]

  forward_metrics_to = [prometheus.remote_write.cloud.receiver]
  forward_logs_to    = [loki.write.cloud.receiver]
}

prometheus.remote_write "cloud" {
  endpoint {
    url = sys.env("PROMETHEUS_URL")
    basic_auth {
      username = sys.env("PROMETHEUS_USER")
      password = sys.env("GRAFANA_CLOUD_API_KEY")
    }
  }
}

loki.write "cloud" {
  endpoint {
    url = sys.env("LOKI_URL")
    basic_auth {
      username = sys.env("LOKI_USER")
      password = sys.env("GRAFANA_CLOUD_API_KEY")
    }
  }
}
```

### MySQL

```alloy
database_observability.mysql "mydb" {
  data_source_name = "grafana_monitoring:secret@tcp(localhost:3306)/mydb"

  enable_collectors = ["query_samples", "explain_plans", "schema_details"]

  forward_metrics_to = [prometheus.remote_write.cloud.receiver]
  forward_logs_to    = [loki.write.cloud.receiver]
}
```

## Key Metrics

```promql
# Query rate by database
rate(db_query_total{db_instance="mydb"}[5m])

# P95 query latency
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))

# Error rate
rate(db_query_errors_total[5m]) / rate(db_query_total[5m])

# Slow queries (over 1 second)
count(db_query_duration_seconds > 1) by (db_query_digest)

# Active connections
db_connections_active{db_instance="mydb"}
```

## What You Get

**Query Performance Dashboard** (auto-provisioned):
- Top queries ranked by total execution time, call count, and mean latency
- Query samples showing actual parameters and wall-clock timing
- Visual explain plans that expose index usage, scan types, and costs
- RED metrics broken down per query digest

**Correlation with APM:**
- Trace slow DB queries back to the application traces that initiated them
- `db.statement`, `db.system`, `db.name` OTel attributes link DB spans to query samples
- Navigate from a service latency spike → the specific slow SQL query → its explain plan

## Alert Rules

```yaml
groups:
  - name: database-observability
    rules:
      - alert: SlowQueryDetected
        expr: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 query latency > 1s on {{ $labels.db_instance }}"

      - alert: HighDBErrorRate
        expr: rate(db_query_errors_total[5m]) / rate(db_query_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "DB error rate > 5% on {{ $labels.db_instance }}"

      - alert: TooManyConnections
        expr: db_connections_active / db_connections_max > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "DB connection pool >80% on {{ $labels.db_instance }}"
```

## Setup Checklist

1. Enable `pg_stat_statements` (PostgreSQL) or the Performance Schema (MySQL)
2. Create a least-privilege monitoring user
3. Insert the `database_observability.*` block into your Alloy config
4. Confirm metrics appear in Grafana Cloud → Database Observability
5. Configure alerting for slow queries and elevated error rates
6. Enable trace correlation by verifying your app emits `db.statement` span attributes
