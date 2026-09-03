---
name: prometheus-addxai
description: >-
  Query Prometheus monitoring metrics and alert rules. Use when the user needs
  to check CPU/memory/disk utilization, service health, audit alert rules,
  analyze capacity trends, or mentions Prometheus, PromQL, metrics monitoring,
  or targets.
metadata:
  category: observability
  source:
    repository: 'https://github.com/addxai/enterprise-harness-engineering'
    path: skills/prometheus
    license_path: LICENSE
    commit: 0905dae0477eb500d9a46101e6ab27e9bfc96608
---

# prometheus

Query monitoring metrics, inspect alerts, and validate target health using the Prometheus HTTP API. API and PromQL syntax are sourced from Context7 MCP; only rules specific to your environment are documented here.

## Setup

Set up your Prometheus endpoint before working with this skill:

| Variable | Description | Required |
|----------|-------------|----------|
| `PROMETHEUS_URL` | Your Prometheus server URL (e.g. `http://prometheus.internal:9090`) | Yes |

Standard metric prefixes to watch:
- `node_*` — Node Exporter (host metrics: CPU, memory, disk, network)
- `kube_*` — kube-state-metrics (K8s object state: deployments, pods, nodes)
- `container_*` — cAdvisor (container resource usage)
- `apiserver_*` — K8s API Server metrics
- `kubelet_*` — Kubelet metrics
- `prometheus_*` — Prometheus self-monitoring

If your setup includes additional exporters (Kafka, Redis, custom applications), register their metric prefixes below:

| Prefix | Source | Description |
|--------|--------|-------------|
| `kafka_*` | Kafka Exporter | Broker and consumer group metrics |
| `fluentbit_*` | Fluent Bit | Log pipeline metrics |
| *(add your own)* | | |

Authentication: Set this up as required for your environment (none, basic auth, or bearer token).

> Official Prometheus documentation contains the full API endpoint and PromQL syntax reference.

## Rules

### Query Considerations

- Verify whether your Prometheus instance uses HTTP or HTTPS and set `PROMETHEUS_URL` accordingly
- `step` must not be smaller than the scrape interval (typically 15s-60s) to prevent invalid interpolation
- High-cardinality labels (user_id, request_id) **must not** be used in `rate()` / `sum by()` aggregations
- On macOS, use `date -v-1H +%s` instead of the Linux `date -d '1 hour ago' +%s`

### Job Label Convention

Job labels are central to finding services. Common naming schemes:

| Pattern | Example | Description |
|---------|---------|-------------|
| `{env}-{region}-{service}` | `prod-gateway` | Service by environment and region |
| `kubernetes-{resource}` | `kubernetes-pods` | Standard K8s metrics |
| `{component}-exporter` | `kafka-exporter` | Dedicated exporters |

> Add your own job naming convention here so the agent can locate services accurately.

### Kafka Consumer Lag Monitoring

When running Kafka with a Kafka Exporter, the typical pattern is:

```promql
# Aggregate consumer lag by consumergroup and topic
sum by (consumergroup, topic) (kafka_consumergroup_lag)
```

The acceptable lag range depends on your workload. Sustained growth signals consumer processing capacity problems.

### Common Workflows

- **Node resource investigation**: `node_cpu_seconds_total` -> `node_memory_MemAvailable_bytes` -> `node_filesystem_avail_bytes` -> locate high-load nodes
- **Kafka health check**: `kafka_brokers` (broker count) -> `kafka_consumergroup_lag` (consumer lag) -> `kafka_topic_partition_under_replicated_partition` (under-replicated partitions)
- **Container investigation**: `container_cpu_usage_seconds_total` -> `container_memory_working_set_bytes` -> aggregate by pod/namespace
- **K8s cluster health**: `kube_node_status_condition` -> `kube_pod_status_phase` -> `kube_deployment_status_replicas_unavailable`

## Examples

### Bad

```bash
# High-cardinality label aggregation -- will cause Prometheus OOM
curl "$PROMETHEUS_URL/api/v1/query?query=sum by(pod)(rate(container_cpu_usage_seconds_total[5m]))"
# pod label cardinality is too high (hundreds of pods); aggregate by namespace or deployment instead
```

### Good

```bash
# Check Kafka consumer lag
curl -s "$PROMETHEUS_URL/api/v1/query?query=sum%20by%20(consumergroup,topic)(kafka_consumergroup_lag)" | jq '.data.result[] | {group: .metric.consumergroup, topic: .metric.topic, lag: .value[1]}'

# Check node CPU usage top 10
curl -s "$PROMETHEUS_URL/api/v1/query?query=topk(10,100*(1-rate(node_cpu_seconds_total{mode=\"idle\"}[5m])))" | jq '.data.result[] | {node: .metric.instance, cpu_pct: .value[1]}'

# Disk space prediction (will it be full in 24h)
curl -s "$PROMETHEUS_URL/api/v1/query?query=predict_linear(node_filesystem_avail_bytes{mountpoint=\"/\"}[24h],86400)" | jq '.data.result[] | {instance: .metric.instance, predicted_bytes: .value[1]}'
```
