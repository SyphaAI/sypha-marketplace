# Error Handling Reference

## Core Principle

Catch an exception only when an actionable response exists: returning a fallback, retrying, or branching to another code path. If printing the error is all you would do, skip the catch and let it propagate -- the caller (or a top-level handler) is better placed to decide the response.

## ClientError Anatomy

All AWS API errors derive from the base exception `botocore.exceptions.ClientError`:

```python
from botocore.exceptions import ClientError

try:
    client.describe_instances(InstanceIds=["i-nonexistent"])
except ClientError as e:
    error = e.response["Error"]
    metadata = e.response["ResponseMetadata"]

    error["Code"]               # "InvalidInstanceID.NotFound"
    error["Message"]            # "The instance ID 'i-nonexistent' does not exist"
    metadata["HTTPStatusCode"]  # 400
    metadata["RequestId"]       # AWS request ID for support cases
```

## Service-Specific Exceptions

Every client carries typed exceptions generated from its service model. Since they subclass `ClientError`, catching `ClientError` still functions as a fallback:

```python
s3 = boto3.client("s3")
try:
    s3.get_object(Bucket="bucket", Key="key")
except s3.exceptions.NoSuchKey:
    return None  # actionable: missing key is a valid case
```

To enumerate the exceptions a client offers:

```python
print([e for e in dir(s3.exceptions) if not e.startswith("_")])
```

## Common botocore Exceptions

```python
from botocore.exceptions import (
    ClientError,              # AWS API returned an error response
    NoCredentialsError,       # no credentials found in the chain
    PartialCredentialsError,  # incomplete credentials (e.g. key without secret)
    NoRegionError,            # no region configured
    ParamValidationError,     # invalid parameters before request is sent
    EndpointConnectionError,  # could not connect to the endpoint
    ConnectTimeoutError,      # connection timed out
    ReadTimeoutError,         # read timed out waiting for response
    WaiterError,              # waiter reached max attempts without success
)
```

`ParamValidationError` is thrown locally, before any network request goes out -- it indicates the parameters did not pass botocore's client-side validation.

## Error Handling Patterns

### Actionable catch: convert to return value

```python
def get_item(table, key: dict) -> dict | None:
    response = table.get_item(Key=key)
    return response.get("Item")  # None if missing, no exception needed

def head_object(client, bucket: str, key: str) -> dict | None:
    try:
        return client.head_object(Bucket=bucket, Key=key)
    except client.exceptions.ClientError as e:
        if e.response["ResponseMetadata"]["HTTPStatusCode"] == 404:
            return None
        raise
```

### Actionable catch: conditional put race

```python
try:
    table.put_item(
        Item=new_item,
        ConditionExpression=Attr("pk").not_exists(),
    )
except table.meta.client.exceptions.ConditionalCheckFailedException:
    # Another writer got there first -- fetch what they wrote
    return table.get_item(Key={"pk": new_item["pk"]})["Item"]
```

### Actionable catch: create-if-not-exists

```python
try:
    client.create_bucket(Bucket="my-bucket")
except client.exceptions.BucketAlreadyOwnedByYou:
    pass  # already exists, that's fine
```

### Top-level catch-all in main()

Exceptions should flow out of business logic functions untouched. A generic catch-all belongs in `main()`, where errors can be presented cleanly to the user. Keep that catch-all minimal -- `ClientError` only. Exceptions such as `NoCredentialsError` already carry clear messages and may propagate on their own:

```python
from botocore.exceptions import ClientError

def main() -> int:
    try:
        do_the_work()
        return 0
    except ClientError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

### What NOT to do

```python
# Wrong: catching just to print and swallow
try:
    client.describe_table(TableName=name)
except client.exceptions.ResourceNotFoundException:
    print("Table not found")     # swallowed -- caller has no idea it failed
except NoCredentialsError:
    print("No credentials")      # swallowed
except EndpointConnectionError:
    print("Can't connect")       # swallowed

# Wrong: sys.exit() from a business logic function
def process_queue(queue_url):
    if not queue_url:
        print("No queue URL provided")
        sys.exit(1)              # untestable, unusable as library code
```
