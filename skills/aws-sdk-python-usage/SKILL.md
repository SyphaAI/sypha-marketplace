---
name: aws-sdk-python-usage
description: >
  Development patterns for the AWS SDK for Python (boto3/botocore). This skill
  MUST be used whenever writing Python code that accesses AWS services through
  boto3 or botocore. That covers creating service clients or resources, setting
  up sessions and credentials, error handling with ClientError, working with
  paginators and waiters, S3 file transfers and presigned URLs, DynamoDB table
  operations, and any boto3/botocore client configuration. Apply it any time
  Python code imports boto3 or botocore, or the user asks about AWS operations
  in Python.
metadata:
  category: development
  source:
    repository: 'https://github.com/aws/agent-toolkit-for-aws'
    path: skills/core-skills/aws-sdk-python-usage
    license_path: LICENSE
    commit: cbdc61a29707dc97989d5d11a2b53ad584781e78
---

> Do not use emojis in any code, comments, or output when this skill is active.

# AWS SDK for Python (boto3)

boto3 is AWS's high-level Python SDK. Built on top of botocore (the low-level
SDK), it exposes two separate interfaces: **clients** (low-level, mapping 1:1
to the API) and **resources** (high-level, object-oriented). Knowing which one
to reach for, and when, is essential.

## Client vs Resource

**Clients** correspond directly to the AWS service APIs. A client exists for
every service, and responses come back as plain dicts.

**Resources** offer an object-oriented interface built around attributes and
actions. Resources exist only for certain services (S3, DynamoDB, EC2, IAM,
SQS, SNS, CloudFormation, CloudWatch, Glacier). They marshal types
automatically, which is particularly helpful with DynamoDB.

```python
import boto3

# Client - low-level, all services
s3_client = boto3.client("s3")
response = s3_client.list_buckets()
buckets = response["Buckets"]  # plain dicts

# Resource - high-level, select services
s3_resource = boto3.resource("s3")
for bucket in s3_resource.buckets.all():
    print(bucket.name)  # attribute access, not dict keys
```

Reach for clients when full API coverage is needed or no resource interface
exists for the service. Reach for resources where they are available and make
the code simpler (DynamoDB and S3 in particular).

## Session and Client Creation

```python
import boto3

# Default session implicitly created
client = boto3.client("s3")
resource = boto3.resource("dynamodb")

# Explicit session use when you need to customize how
# clients are created, use an explicit profile, etc.
session = boto3.Session(
    profile_name="my-profile",
    region_name="us-west-2",
)
client = session.client("s3")
```

Avoid creating clients inside loops - keep one client instance and reuse it.
Once instantiated, clients are thread safe and may be shared between threads.

## Making API Calls

```python
# Client - pass parameters as keyword arguments, get dicts back
response = client.get_object(Bucket="my-bucket", Key="my-key")
data = response["Body"].read()

# Resource - use object methods and attributes
obj = s3_resource.Object("my-bucket", "my-key")
response = obj.get()
data = response["Body"].read()
```

Parameter names follow the exact casing used by the AWS API,
usually PascalCase rather than snake\_case.

## Error Handling

Catch exceptions only when there is something actionable to do - returning a
fallback value, retrying, or branching to a different code path. It is wrong to
catch an exception merely to print and swallow it: doing so buries the real
error and stops callers from responding. By default, let exceptions propagate.

When catching is warranted, favor the typed exceptions exposed via the
`client.exceptions` attribute over generic `ClientError` with string code
matching:

```python
lambda_client = boto3.client("lambda")

def get_function_config(name: str) -> dict | None:
    """Return function configuration, or None if it doesn't exist."""
    try:
        return lambda_client.get_function_configuration(FunctionName=name)
    except lambda_client.exceptions.ResourceNotFoundException:
        return None  # actionable: convert missing function to None
    # Everything else propagates - caller or main() handles it
```

Reserve generic `ClientError` for a catch-all in a top-level error handler;
keep it out of business logic functions. It comes from botocore, not boto3:

```python
from botocore.exceptions import ClientError

def main() -> int:
    try:
        result = do_the_work()
        print(result)
        return 0
    except ClientError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
```

See `references/error-handling.md` for the complete error hierarchy and botocore exceptions.

## Script Structure

When writing a script that relies on `boto3` or `botocore`, limit `if __name__
== "__main__"` to one function call. Argument parsing, error presentation, and
exit codes go in `main()` rather than being spread through business logic
functions:

```python
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bucket")
    args = parser.parse_args()

    try:
        do_the_work(args.bucket)
        return 0
    except ClientError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

A business logic function must never call `sys.exit()` -- that renders it
untestable and useless as a library. Instead, raise an exception or return an
error value, leaving `main()` to decide how to present it.

## Pagination

Do not hand-roll loops over `NextToken` -- rely on paginators. If only certain
fields are needed, call `.search()` with a JMESPath expression to pull them out
and flatten them across pages:

```python
paginator = iam.get_paginator("list_users")
for name in paginator.paginate().search("Users[].UserName"):
    print(name)

# Filter and project
for arn in paginator.paginate().search("Users[?Path == '/admin/'][].Arn"):
    print(arn)
```

If the complete response object is needed per item, or per-page control is
required (e.g. counting pages, batching by page), iterate over pages directly:

```python
for page in paginator.paginate():
    for user in page.get("Users", []):
        process(user)
```

Further pagination details are in: `references/pagination.md`.

## Waiters

Block until a resource arrives at a desired state:

```python
waiter = client.get_waiter("bucket_exists")
waiter.wait(
    Bucket="my-bucket",
    WaiterConfig={"Delay": 5, "MaxAttempts": 20},
)
```

Further waiter details are in `references/waiters.md`.

## Client Configuration

For retries, timeouts, connection pool settings, and the like, use
`botocore.config.Config`:

```python
from botocore.config import Config

config = Config(
    retries={"total_max_attempts": 2, "mode": "adaptive"},
    connect_timeout=5,
    read_timeout=10,
    max_pool_connections=50,
)
client = boto3.client("s3", config=config)
```

See `references/configuration.md` whenever building custom configuration for a client.

## Logging

boto3 and botocore both rely on the standard library `logging` module.
Logging can be set up through the usual `logging` APIs, or via the convenience
helpers that boto3 and botocore provide:

```python
# Quick: log all botocore wire-level details to stderr
boto3.set_stream_logger("")  # root logger -- everything
boto3.set_stream_logger("botocore")  # just botocore

# Botocore, log all botocore details
import logging

from botocore.session import Session

session = Session()

session.set_stream_logger('botocore', logging.DEBUG)
# OR: Configure logging to a file.
session.set_file_logger(logging.DEBUG, '/tmp/botocore.log')
```

`set_stream_logger(name, level=logging.DEBUG)` attaches a
`StreamHandler` to the named logger. This is the idiomatic route to
request/response debug output from the SDK.

## Common Issues

### Issue: ClientError import location

**Wrong:** `from boto3.exceptions import ClientError`
**Right:** `from botocore.exceptions import ClientError`

## Service specific customizations

Whenever writing Python code that touches the services below, you MUST load
the corresponding reference files for best practices and custom high level
APIs:

* S3 - you MUST load `references/s3.md`.
* Dynamodb - you MUST load `references/dynamodb.md`.

## References

* Client configuration (retries, timeouts, endpoints): `references/configuration.md`
* Credentials and sessions: `references/credentials.md`
* Error handling patterns: `references/error-handling.md`
* Pagination: `references/pagination.md`
* Waiters: `references/waiters.md`
* S3 transfers and presigned URLs: `references/s3.md`
* DynamoDB operations: `references/dynamodb.md`
