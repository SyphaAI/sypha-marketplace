---
title: "E1 — DPU Sizing"
description: "Identify DPU under-provisioning or over-provisioning in Glue jobs"
status: active
severity: MEDIUM
triggers:
  - "DPU sizing"
  - "worker type"
  - "how many DPUs"
  - "job too slow"
  - "job too expensive"
  - "G.1X vs G.2X"
owner: devops-agent
objective: "Right-size Glue job DPU allocation for optimal cost and performance"
context: "DPU (Data Processing Unit) sizing depends on data volume, transformation complexity, and memory requirements. G.1X (16 GB, 4 vCPU) for standard ETL. G.2X (32 GB, 8 vCPU) for memory-intensive operations. G.4X (64 GB, 16 vCPU) for ML transforms. G.8X (128 GB, 32 vCPU) for massive datasets. Over-provisioning wastes cost; under-provisioning causes OOM or slow execution."
---

## Phase 1 — Triage

MUST:
- Check current job configuration: `aws glue get-job --name <name>` (WorkerType, NumberOfWorkers)
- Review CloudWatch metrics for DPU utilization: `aws cloudwatch get-metric-statistics --namespace Glue --metric-name glue.ALL.system.cpuSystemLoad --dimensions Name=JobName,Value=<name>,Name=JobRunId,Value=<run-id> --start-time <iso> --end-time <iso> --period 300 --statistics Average`
- Check memory utilization metrics: `glue.driver.jvm.heap.usage` and `glue.ALL.jvm.heap.usage`
- Review job run duration trends: `aws glue get-job-runs --job-name <name> --max-results 10`

SHOULD:
- Look for OOM errors in recent runs as evidence of under-provisioning
- Measure the data volume processed per run
- Evaluate the trade-off between cost and execution time across different configurations
- Determine whether auto-scaling is enabled (Glue 3.0+)

MAY:
- Execute the job with varying worker configurations to establish a benchmark
- Use Spark UI to profile individual stages for memory and CPU bottlenecks

## Phase 2 — Remediate

MUST:
- Adjust the worker type according to memory needs (OOM → upgrade; low utilization → downgrade)
- Tune the worker count to match data volume and parallelism requirements
- Confirm that the adjustment delivers better performance without a disproportionate cost increase

SHOULD:
- Turn on auto-scaling for workloads with variable data volumes (Glue 3.0+)
- Set MaxCapacity to cap auto-scaling spend
- Track DPU-hours per run as part of ongoing cost management

MAY:
- Build job metrics dashboards to support continuous optimization
- Enable Glue job bookmarks to limit per-run data volume
- Evaluate Glue Flex execution for non-time-sensitive jobs to reduce cost

## Common Issues

- symptoms: "Job completes but takes much longer than expected"
  diagnosis: "The worker count is too low for the data volume, resulting in insufficient parallelism."
  resolution: "Increase NumberOfWorkers. Check if data is properly partitioned for parallel processing."

- symptoms: "Job costs are high but CPU utilization is low"
  diagnosis: "Workers are over-provisioned and sitting idle relative to the data volume being processed."
  resolution: "Reduce NumberOfWorkers. Enable auto-scaling to dynamically adjust. Consider G.1X instead of G.2X if memory is sufficient."

- symptoms: "Frequent OOM errors with G.1X workers"
  diagnosis: "The transformations require more than 16 GB of memory per worker (typically large joins or aggregations)."
  resolution: "Upgrade to G.2X (32 GB) or G.4X (64 GB). Alternatively, repartition data into smaller chunks."

## Output Format

```yaml
root_cause: "dpu_sizing — <under_provisioned|over_provisioned>"
evidence:
  - type: job_config
    content: "<worker type, count, and DPU allocation>"
  - type: utilization_metrics
    content: "<CPU and memory utilization>"
severity: MEDIUM
mitigation:
  immediate: "Adjust worker type and count based on utilization data"
  long_term: "Enable auto-scaling, implement cost monitoring"
```


## Safety Ratings
```
safety_ratings:
  - "Check job configuration and metrics: GREEN — read-only API calls"
  - "Review utilization metrics: GREEN — read-only monitoring"
  - "Adjust worker count: YELLOW — changes cost and performance"
  - "Change worker type: YELLOW — changes cost and memory per worker"
  - "Enable auto-scaling: YELLOW — may increase cost during peak"
```

## Escalation Conditions
- Job processes production data pipeline
- DPU costs exceeding budget
- OOM errors requiring worker type upgrade
- Performance degradation requiring capacity increase
- Auto-scaling cost concerns

## Data Sensitivity
```
data_sensitivity:
  classification: HIGH
  sensitive_fields:
    - "Job configuration: worker type and count"
    - "Utilization metrics: processing patterns"
    - "Cost data: DPU-hour usage"
  handling: "Do not expose DPU configuration or cost details externally."
```

## Prohibited Actions
- NEVER suggest resetting job bookmarks without understanding reprocessing impact
- NEVER suggest deleting Data Catalog tables
- NEVER set worker count to 0
- NEVER remove auto-scaling MaxCapacity limit without cost approval

## Phase 3 — Rollback
- If worker type was changed: revert to previous worker type
- If worker count was changed: restore previous count
- If auto-scaling was enabled: disable auto-scaling
- If MaxCapacity was changed: restore previous limit

## Escalation Conditions

escalation_conditions:
  - "Remediation requires modifying IAM policies in a production account"
  - "Remediation requires disabling a security control even temporarily"
  - "Root cause cannot be identified after 3 hypothesis pivots"
  - "Blast radius affects more than one account or region"
  - "Issue involves potential data loss or exposure"

## Prohibited Actions

prohibited_actions:
  - "NEVER suggest disabling encryption for Glue jobs"
  - "NEVER suggest overly broad Glue service role"
  - "NEVER suggest public S3 access for data catalog"
