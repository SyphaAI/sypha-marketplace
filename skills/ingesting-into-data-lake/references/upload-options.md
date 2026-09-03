# Upload Options Reference

## cp vs sync

| Command | Use when |
|---------|----------|
| `aws s3 cp` | Single file, or a directory using `--recursive` |
| `aws s3 sync` | Directory upload, skips files that haven't changed on re-run |

`sync` is idempotent — it can be safely re-run after an interruption. Prefer `sync` for directory uploads.

## Multipart Upload

`aws s3 cp` switches to multipart automatically for files over 8 MB (the default threshold). No additional flags are required. To adjust the threshold or chunk size:

```bash
aws configure set default.s3.multipart_threshold 64MB
aws configure set default.s3.multipart_chunksize 64MB
```

## Compression Before Upload

Compressing files locally reduces transfer time and storage cost. Downstream tools (Athena, Glue) can read gzip natively.

```bash
gzip file.csv
aws s3 cp file.csv.gz s3://<bucket>/<prefix>/
```

Do NOT compress Parquet, Avro, or ORC — these formats include built-in compression.

## Overwrite Protection

Verify the target does not already exist before uploading:

```bash
aws s3 ls s3://<bucket>/<prefix>/<filename>
```

If an object exists at that path, warn the user. `aws s3 cp` will overwrite it without prompting.
