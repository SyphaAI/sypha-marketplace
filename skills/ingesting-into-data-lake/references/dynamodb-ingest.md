# DynamoDB Ingest

Load DynamoDB tables into the data lake. DynamoDB differs from other sources: it requires no Glue connection, stores schemaless items, and provides no natural watermark column.

## Contents

- [Method Selection](#method-selection)
- [Native Export (Path A)](#native-export-path-a)
- [Glue Direct Read (Path B)](#glue-direct-read-path-b)
- [Schema Flattening](#schema-flattening)
- [Incremental Strategies](#incremental-strategies)
- [Throughput Guidance](#throughput-guidance)
- [Gotchas](#gotchas)

## Method Selection

Inspect the table before choosing a method:

```bash
aws dynamodb describe-table --table-name <TABLE>
```

Record the item count, table size, billing mode, and PITR status.

| Table size | Method | Why |
|---|---|---|
| Small (<10K items, <1 GB) | Glue direct read | Simple, low throughput impact |
| Medium (10K-100M items, 1-100 GB) | Native export | No read capacity consumed |
| Large (>100M items, >100 GB) | Native export | Glue direct read would throttle production |

## Native Export (Path A)

The preferred approach for medium and large tables. Consumes no read capacity.

### Export Command

```bash
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:<REGION>:<ACCOUNT>:table/<TABLE> \
  --s3-bucket <EXPORT_BUCKET> \
  --s3-prefix exports/<TABLE>/ \
  --export-format DYNAMODB_JSON \
  --export-type FULL_EXPORT
```

Available export formats:

- `DYNAMODB_JSON` (default) -- each item serialized as JSON with type descriptors like `{"S": "value"}`
- `ION` -- Amazon Ion format; more compact and handles binary natively

### Monitoring

```bash
aws dynamodb describe-export --export-arn <EXPORT_ARN>
```

Possible states: `IN_PROGRESS`, `COMPLETED`, `FAILED`. Large tables may take anywhere from minutes to hours.

### Output Structure

```
s3://<bucket>/exports/<table>/AWSDynamoDB/<export-id>/
  manifest-summary.json
  manifest-files.json
  data/                    (gzipped JSON or Ion)
```

### Read Export in Glue

```python
export_df = spark.read.json("s3://<bucket>/exports/<table>/AWSDynamoDB/<export-id>/data/")
# Items are nested in type descriptors -- flatten per Schema Flattening below
```

Native export items are enclosed in DynamoDB type descriptors (`{"S": "value"}`, `{"N": "123"}`). Strip the descriptors before flattening the schema:

```python
# Native export items are wrapped in type descriptors -- unwrap before flattening:
flat_df = export_df.select(
    col("Item.pk.S").alias("partition_key"),
    col("Item.name.S").alias("name"),
    col("Item.age.N").cast("bigint").alias("age")
)
```

### Incremental Export

PITR must be enabled on the source table before this option is available.

```bash
aws dynamodb export-table-to-point-in-time \
  --table-arn <arn> \
  --s3-bucket <bucket> \
  --export-type INCREMENTAL_EXPORT \
  --incremental-export-specification '{"ExportFromTime":"<last>","ExportToTime":"<now>","ExportViewType":"NEW_AND_OLD_IMAGES"}'
```

## Glue Direct Read (Path B)

Suited for small tables. No connection is required -- Glue accesses DynamoDB through AWS APIs using the permissions of the Glue job role.

```python
dynamodb_df = glueContext.create_dynamic_frame.from_options(
    connection_type="dynamodb",
    connection_options={
        "dynamodb.input.tableName": "<TABLE>",
        "dynamodb.throughput.read.percent": "0.5"
    }
).toDF()

# After flattening, write to target (see iceberg-catalog-config-and-usage.md for path syntax)
flat_df.writeTo("s3tablescatalog.<namespace>.<table>").append()
```

Options:

| Option | Default | Purpose |
|---|---|---|
| `dynamodb.throughput.read.percent` | 0.5 | Fraction of RCUs to consume (0.1-1.0) |
| `dynamodb.splits` | auto | Parallel scan segments |
| `dynamodb.input.tableName` | required | Table name |

## Schema Flattening

Applies to output from Glue direct-read (Path B). For native export (Path A) output, use the type-descriptor unwrapping pattern shown above.

DynamoDB to Iceberg type mappings:

| DDB | Iceberg | Notes |
|---|---|---|
| `S` | STRING | |
| `N` | BIGINT, DOUBLE, or DECIMAL | Inspect values |
| `BOOL` | BOOLEAN | |
| `B` | BINARY | Rarely useful |
| `M` | STRUCT or flatten to columns | |
| `L` | ARRAY or JSON STRING | |
| `SS` / `NS` | ARRAY&lt;STRING&gt; / ARRAY&lt;DOUBLE&gt; | |

### Strategy Options

**Top-level only (simplest approach):**

```python
flat_df = dynamodb_df.select(
    col("pk").alias("partition_key"),
    col("name").cast("string"),
    col("created_at").cast("timestamp")
)
```

**Flatten one level:**

```python
flat_df = dynamodb_df.select(
    col("pk").alias("user_id"),
    col("profile.first_name").alias("first_name"),
    col("address.city").alias("city")
)
```

**Preserve as STRUCT:**

```python
flat_df = dynamodb_df.select(col("pk"), col("profile"), col("tags"))
```

**Serialize complex types to JSON:**

```python
from pyspark.sql.functions import to_json
flat_df = dynamodb_df.select(col("pk"), to_json(col("metadata")).alias("metadata_json"))
```

### Sampling Items for Schema Inference

```bash
aws dynamodb scan --table-name <TABLE> --limit 10 --output json
```

Or in Spark:

```python
sample = dynamodb_df.limit(100).toPandas()
all_columns = set()
for _, row in sample.iterrows():
    all_columns.update(row.dropna().index.tolist())
```

### Handling Missing Attributes

```python
from pyspark.sql.functions import coalesce, lit
flat_df = dynamodb_df.select(
    col("pk"),
    coalesce(col("email"), lit("")).alias("email"),
    coalesce(col("status"), lit("unknown")).alias("status")
)
```

## Incremental Strategies

| Strategy | Latency | Read impact | Best for |
|---|---|---|---|
| Scheduled full export | Hours | None | Large tables, daily freshness |
| Incremental export | Minutes-hours | None | Medium tables with PITR |
| DynamoDB Streams + Lambda | Seconds | None | Near-real-time |
| Application watermark | Minutes | Some | Tables with `last_modified` attribute |
| Full refresh via Glue | Minutes | High | Small tables (<10K items) |

**Scheduled full export:** An EventBridge rule triggers a Lambda function that runs `export-table-to-point-in-time` followed by a Glue job. Straightforward to set up and captures deleted items.

**DynamoDB Streams:** Enable streams with `--stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES`. A Lambda function consumes the stream and writes records to S3 or the target table. Stream retention is 24 hours -- the consumer must stay current to avoid data loss.

**Application watermark:** When items carry a `last_modified` attribute, filter in Glue using `dynamodb_df.filter(f"last_modified > '{last_watermark}'")`). This approach requires cooperation from the application layer and consumes read capacity.

**Full refresh:** For small tables, use `dynamodb_df.writeTo(target).using("iceberg").createOrReplace()`. Do NOT use `overwritePartitions()` -- it replaces only the partitions present in the DataFrame, leaving deleted items as stale data in any remaining partitions.

## Throughput Guidance

| Billing mode | Recommendation |
|---|---|
| On-demand | `read.percent` = 0.5 or lower |
| Provisioned | `read.percent` = 0.25-0.5; avoid peak hours |
| Large table (any mode) | Use native export instead |

## Gotchas

- Native export uses no read capacity -- always prefer it for tables larger than 1 GB
- Glue direct reads at a high `read.percent` can throttle production traffic on the source table
- DynamoDB's Number type has arbitrary precision -- choose BIGINT or DECIMAL based on the actual values in the data
- Binary (`B`) attributes are rarely useful in analytics -- omit them unless explicitly required
- DynamoDB Streams retention is 24 hours -- if the consumer falls behind, records are permanently lost
- Incremental export requires PITR to be enabled on the source table
- `overwritePartitions()` does NOT remove partitions that are absent from the source DataFrame
