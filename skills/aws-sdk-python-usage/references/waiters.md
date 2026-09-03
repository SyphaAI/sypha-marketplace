# Waiters Reference

## Using Waiters

A waiter repeatedly polls an AWS operation until the resource hits the desired state or the waiter runs out of time:

```python
import boto3

ec2 = boto3.client("ec2")

# Start an instance
ec2.start_instances(InstanceIds=["i-1234567890abcdef0"])

# Wait until it's running
waiter = ec2.get_waiter("instance_running")
waiter.wait(
    InstanceIds=["i-1234567890abcdef0"],
    WaiterConfig={
        "Delay": 15,        # seconds between polls (default varies by waiter)
        "MaxAttempts": 40,   # max poll attempts (default varies by waiter)
    },
)
```

## WaiterConfig

| Parameter | Description |
|---|---|
| `Delay` | Seconds between polling attempts |
| `MaxAttempts` | Maximum number of polling attempts before raising `WaiterError` |

Both parameters are optional; when supplied they take precedence over the waiter's built-in defaults.

## Common Waiters

| Service | Waiter | Polls until |
|---|---|---|
| S3 | `bucket_exists` | HeadBucket succeeds |
| S3 | `bucket_not_exists` | HeadBucket returns 404 |
| S3 | `object_exists` | HeadObject succeeds |
| S3 | `object_not_exists` | HeadObject returns 404 |
| EC2 | `instance_running` | Instance state is "running" |
| EC2 | `instance_stopped` | Instance state is "stopped" |
| EC2 | `instance_terminated` | Instance state is "terminated" |
| RDS | `db_instance_available` | DB instance is "available" |
| CloudFormation | `stack_create_complete` | Stack status is CREATE_COMPLETE |
| CloudFormation | `stack_delete_complete` | Stack no longer exists |

To see which waiters a client provides:

```python
client.waiter_names  # ["bucket_exists", "bucket_not_exists", ...]
```

## Waiter Errors

```python
from botocore.exceptions import WaiterError

try:
    waiter = s3.get_waiter("object_exists")
    waiter.wait(Bucket="bucket", Key="key")
except WaiterError as e:
    print(f"Waiter failed: {e}")
    # e.last_response contains the last polling response
```

`WaiterError` gets raised when:

- The desired state was not reached before `MaxAttempts` was exhausted
- The waiter hits a terminal failure state (e.g., the resource moved into an unrecoverable state)

## Custom Waiters

When an operation lacks a built-in waiter, you can define your own waiter model:

```python
import boto3
from botocore.waiter import WaiterModel, create_waiter_with_client

waiter_config = {
    "version": 2,
    "waiters": {
        "FunctionActive": {
            "operation": "GetFunction",
            "delay": 5,
            "maxAttempts": 20,
            "acceptors": [
                {
                    "matcher": "path",
                    "expected": "Active",
                    "argument": "Configuration.State",
                    "state": "success",
                },
                {
                    "matcher": "path",
                    "expected": "Failed",
                    "argument": "Configuration.State",
                    "state": "failure",
                },
            ],
        }
    },
}

client = boto3.client("lambda")
waiter_model = WaiterModel(waiter_config)
waiter = create_waiter_with_client("FunctionActive", waiter_model, client)
waiter.wait(FunctionName="my-function")
```

### Acceptor matchers

| Matcher | Description |
|---|---|
| `path` | JMESPath expression against the response |
| `pathAll` | All items in a JMESPath list must match |
| `pathAny` | Any item in a JMESPath list must match |
| `status` | HTTP status code |
| `error` | Error code string |
