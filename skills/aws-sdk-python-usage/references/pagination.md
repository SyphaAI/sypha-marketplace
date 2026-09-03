# Pagination Reference

## Paginators

Pagination is supported by most collection-returning `list_*`, `describe_*`, and `get_*` operations. If only particular fields are needed, `.search()` extracts and flattens them across pages:

```python
client = boto3.client("ec2")
paginator = client.get_paginator("describe_instances")

for instance_id in paginator.paginate().search("Reservations[].Instances[].InstanceId"):
    print(instance_id)
```

If the complete response object is needed per item, or you want per-page control (e.g. counting pages, batching by page), loop over the pages directly:

```python
for page in paginator.paginate():
    for reservation in page.get("Reservations", []):
        for instance in reservation.get("Instances", []):
            process(instance)
```

To find out whether an operation is paginated:

```python
client.can_paginate("describe_instances")  # True
```

## Pagination Configuration

Page size and total item count are controlled with `PaginationConfig`:

```python
paginator = client.get_paginator("list_objects_v2")
pages = paginator.paginate(
    Bucket="my-bucket",
    PaginationConfig={
        "PageSize": 100,        # items per API call
        "MaxItems": 500,        # total items across all pages
        "StartingToken": None,  # resume from a previous NextToken
    },
)
```

- `PageSize` sets the `MaxKeys`/`MaxResults`/`Limit` parameter passed to the API
- `MaxItems` halts iteration once this many items have been returned in total, supplying a `NextToken` to resume from
- The correct token parameter name for each service is chosen by the paginator automatically

## JMESPath Filtering

`.search()` pulls out results and flattens them across pages:

```python
paginator = client.get_paginator("list_objects_v2")
page_iterator = paginator.paginate(Bucket="my-bucket")

# Flatten all keys across all pages
keys = page_iterator.search("Contents[].Key")
for key in keys:
    print(key)

# Filter with JMESPath expressions
large_objects = page_iterator.search(
    "Contents[?Size > `1048576`].{Key: Key, Size: Size}"
)
```

`.search()` gives back a generator yielding individual items rather than pages -- page boundaries never need handling.

## Common Paginated Operations

| Service | Operation | Result key |
|---|---|---|
| S3 | `list_objects_v2` | `Contents` |
| DynamoDB | `scan` | `Items` |
| DynamoDB | `query` | `Items` |
| EC2 | `describe_instances` | `Reservations` |
| IAM | `list_users` | `Users` |
| Lambda | `list_functions` | `Functions` |
| CloudWatch Logs | `describe_log_groups` | `logGroups` |

Note: `list_buckets` has no pagination -- every bucket comes back in one response.

## Resource-Level Pagination

Collection methods on resources take care of pagination for you:

```python
s3 = boto3.resource("s3")
bucket = s3.Bucket("my-bucket")

# .all() paginates automatically
for obj in bucket.objects.all():
    print(obj.key)

# .filter() also paginates
for obj in bucket.objects.filter(Prefix="logs/"):
    print(obj.key)

# .limit() limits total results
for obj in bucket.objects.limit(100):
    print(obj.key)
```
