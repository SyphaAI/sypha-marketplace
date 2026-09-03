---
title: Basic Sensors
triggers:
  - "event-driven automation with file watching or custom polling"
---

# Basic Sensors

For the fundamental sensor pattern with cursors, refer to the main SKILL.md Quick Reference section.

## File Watching Sensor

A canonical file sensor that polls a directory for new files and submits run requests:

```python nocheckundefined
import os
import json
import dagster as dg

@dg.sensor(job=my_job, minimum_interval_seconds=30)
def file_sensor(context: dg.SensorEvaluationContext):
    # Load cursor (tracks files we've already processed)
    processed_files = json.loads(context.cursor) if context.cursor else {}

    # Check directory for files
    directory = "/data/incoming"
    current_files = {}
    runs_to_request = []

    for filename in os.listdir(directory):
        filepath = os.path.join(directory, filename)
        mtime = os.path.getmtime(filepath)
        current_files[filename] = mtime

        # File is new or modified
        if filename not in processed_files or processed_files[filename] != mtime:
            runs_to_request.append(
                dg.RunRequest(
                    run_key=f"{filename}_{mtime}",
                    run_config={"ops": {"my_op": {"config": {"filepath": filepath}}}},
                )
            )

    # Update cursor to track current state
    return dg.SensorResult(
        run_requests=runs_to_request,
        cursor=json.dumps(current_files),
    )
```

**Key pattern**: Record file names and modification times in the cursor to keep track of which files have already been handled.

## Cursor State Management

**Best practices for cursors**:

- **Use JSON for structured state**: `json.dumps()` and `json.loads()` make it straightforward to persist dictionaries or lists
- **Handle missing cursor**: Always verify that `context.cursor` is not None on the first evaluation
- **Update cursor atomically**: Supply the updated cursor value in `SensorResult` or call `context.update_cursor()`
- **Keep cursors small**: Cursors are persisted to the database; avoid storing large data structures

**Two ways to update cursors**:

```python nocheck
# Option 1: Return SensorResult
return dg.SensorResult(
    run_requests=[...],
    cursor=json.dumps(new_state)
)

# Option 2: Call update_cursor() directly
context.update_cursor(json.dumps(new_state))
yield dg.RunRequest(...)
```

## Evaluation Configuration

**Control evaluation frequency**:

```python nocheckundefined
@dg.sensor(
    job=my_job,
    minimum_interval_seconds=60,  # Minimum 60 seconds between evaluations
    default_status=dg.DefaultSensorStatus.RUNNING,  # Auto-enable when deployed
)
def my_sensor(context):
    ...
```

**Important**: `minimum_interval_seconds` sets a lower bound, not an exact interval. If an evaluation takes 10 seconds and the interval is 30 seconds, the next evaluation starts 30 seconds after the previous one began (that is, 20 seconds after it finished).

## SensorEvaluationContext

Properties available in the sensor context:

- `cursor`: String cursor from the previous evaluation (None on the first evaluation)
- `update_cursor(str)`: Set an updated cursor for the next evaluation
- `instance`: DagsterInstance for querying the event log or other instance data
- `log`: Logger for capturing sensor evaluation details
- `repository_def`: Repository that owns the sensor
- `resources`: Access configured resources (if defined)

**Example using context.log**:

```python nocheckundefined
@dg.sensor(job=my_job)
def logging_sensor(context):
    context.log.info(f"Evaluating sensor, cursor: {context.cursor}")
    # ... sensor logic
```
