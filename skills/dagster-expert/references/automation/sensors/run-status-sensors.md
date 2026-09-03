---
title: Run Status Sensors
triggers:
  - "reacting to run success, failure, or other status changes"
---

# Run Status Sensors

Run status sensors observe runs for particular status transitions and execute actions whenever those statuses are reached.

## Run Failure Sensor

Use `@run_failure_sensor` to detect run failures across all jobs:

```python nocheckundefined
import dagster as dg

@dg.run_failure_sensor
def failure_alert_sensor(context: dg.RunFailureSensorContext):
    slack_client.chat_postMessage(
        channel="#alerts",
        text=f'Job "{context.dagster_run.job_name}" failed: {context.failure_event.message}',
    )
```

Run failure sensors are a standard tool for alerting and error notification workflows.

## Run Status Sensor

Use `@run_status_sensor` to react to any run status:

```python nocheckundefined
@dg.run_status_sensor(
    run_status=dg.DagsterRunStatus.SUCCESS,
    request_job=downstream_job,
)
def success_sensor(context: dg.RunStatusSensorContext):
    if context.dagster_run.job_name == "upstream_job":
        return dg.RunRequest(run_key=context.dagster_run.run_id)
```

This approach lets you build job-to-job dependencies driven by run completion.

## Available Run Statuses

Common run statuses for monitoring:

- `DagsterRunStatus.SUCCESS` - Run completed successfully
- `DagsterRunStatus.FAILURE` - Run failed
- `DagsterRunStatus.STARTED` - Run execution started
- `DagsterRunStatus.CANCELED` - Run was canceled
- `DagsterRunStatus.CANCELING` - Run is being canceled

Additional statuses: `QUEUED`, `NOT_STARTED`, `MANAGED`, `STARTING`

## Monitoring Specific Jobs

Use `monitored_jobs` to restrict which jobs can activate the sensor:

```python nocheckundefined
@dg.run_status_sensor(
    run_status=dg.DagsterRunStatus.SUCCESS,
    monitored_jobs=[job1, job2],
)
def job_specific_sensor(context):
    # Only triggered when job1 or job2 succeeds
    ...
```

Omitting `monitored_jobs` causes the sensor to fire for every run that reaches the specified status.

## Cross-Code Location Monitoring

Watch runs across all code locations:

```python
@dg.run_status_sensor(
    run_status=dg.DagsterRunStatus.FAILURE,
    monitor_all_code_locations=True,
)
def global_failure_sensor(context):
    # Monitors failures across the entire deployment
    ...
```

Set `monitor_all_code_locations=True` to extend monitoring to the entire deployment.

## Context Properties

**RunStatusSensorContext** provides:

- `dagster_run`: The run that activated the sensor
- `dagster_event`: The event associated with the status change
- `partition_key`: Partition key from run tags (if partitioned)
- `instance`: DagsterInstance
- `log`: Logger

**RunFailureSensorContext** adds:

- `failure_event`: The run failure event containing error details
- `get_step_failure_events()`: List of step-level failures with stack traces

## Common Use Cases

**Alerting**: Send notifications on run failures:

```python nocheckundefined
@dg.run_failure_sensor
def slack_alert(context: dg.RunFailureSensorContext):
    slack_client.chat_postMessage(
        channel="#alerts",
        text=f"Job {context.dagster_run.job_name} failed"
    )
```

**Job coordination**: Trigger downstream jobs after success:

```python nocheckundefined
@dg.run_status_sensor(
    run_status=dg.DagsterRunStatus.SUCCESS,
    monitored_jobs=[upstream_job],
    request_job=downstream_job,
)
def chain_jobs(context):
    return dg.RunRequest()
```

**Error handling**: Trigger cleanup on failure:

```python nocheckundefined
@dg.run_failure_sensor(monitored_jobs=[data_job])
def cleanup_on_failure(context):
    cleanup_partial_data()
```
