# Local File Upload

Transfer files from the local filesystem to S3, with an optional step to ingest them into a table.

## Workflow

### 1. Determine Intent

**First, check the source path.** If the user supplies an S3 URI (e.g., `s3://...`) as the source, stop and switch to [s3-files.md](s3-files.md) instead. This workflow covers local files only.

Parse the user's request to decide the route:

- **Upload only?** ("put this in S3", "upload my file", "move to AWS") -> Path A
- **Upload + make queryable?** ("load this into a table", "ingest this CSV", "make it queryable") -> Path B

If the intent is unclear and the file is structured (CSV, JSON, Parquet, TSV, Avro, ORC), ask: "Do you want this queryable as a table, or just stored in S3?"

### 2. Discover Local Data

1. **Validate path**: Verify the file or directory exists and is readable
2. **Detect format**: Infer from the extension (.csv, .json, .parquet, .tsv, .avro, .orc) or ask the user
3. **Check size**: `ls -lh` for individual files, `du -sh` for directories
4. **For structured files, inspect content**:
   - CSV/TSV: `head -5` to review headers, delimiters, and encoding
   - JSON: `head -20` to check structure (records vs. arrays)
   - Parquet/Avro/ORC: note the format, no content preview needed

**Encoding check** (CSV/TSV/JSON only):

```bash
file --mime-encoding <path>
```

If the encoding is neither UTF-8 nor ASCII, alert the user before uploading. Files in other encodings can cause failures in downstream parsing.

### 3. Choose S3 Destination

1. **Ask for the target bucket** or list available buckets:

   ```bash
   aws s3 ls
   ```

2. **Suggest prefix structure**: `s3://<bucket>/<domain>/<dataset>/<filename>`
3. **Get user confirmation** before uploading

Default behavior: keep the original filename. The user can specify a different key to override this.

### 4. Upload

**Single file -- check for existing objects** before uploading (`aws s3 cp` silently overwrites existing objects):

```bash
aws s3 ls s3://<bucket>/<prefix>/<filename>
```

If the object already exists, warn the user and obtain explicit confirmation before proceeding.

**Directory -- check for existing objects** before syncing. Use a bounded check to avoid iterating every object under the prefix (which can be extremely slow for large prefixes):

```bash
aws s3api list-objects-v2 --bucket <bucket> --prefix <prefix>/ --max-items 1
```

If `Contents` is present in the result, objects already exist and the user should be warned before continuing. `aws s3 sync` skips files that haven't changed but silently overwrites modified ones.

**Single file upload**:

```bash
aws s3 cp <local-path> s3://<bucket>/<prefix>/<filename>
```

**Directory upload**:

```bash
aws s3 sync <local-dir> s3://<bucket>/<prefix>/
```

For files larger than 8 MB, `aws s3 cp` activates multipart upload automatically. No additional flags are required.

**Verify upload**:

```bash
aws s3 ls s3://<bucket>/<prefix>/<filename>
```

### 5. Route Based on Intent

#### Path A: Upload Only

Report the outcome and stop:

- S3 URI of the uploaded file(s)
- File size and format
- Example command to download: `aws s3 cp s3://... .`

#### Path B: Upload + Table Ingestion

Once the upload is complete, continue with the [s3-files.md](s3-files.md) workflow, passing along:

- S3 path where the data was uploaded
- Detected file format
- Row/size estimate
- Encoding (if it was checked)

Do not re-implement schema inference or table creation — delegate those steps to the S3 files workflow.

## Gotchas

- `aws s3 cp` silently overwrites existing S3 objects — always check before uploading.
- `aws s3 sync` skips files that haven't changed but overwrites modified ones with no warning. Inspect the destination before syncing directories.
- CSV files with mixed encodings (e.g., Latin-1 headers with a UTF-8 body) upload without errors but break downstream parsing. Always verify encoding for text-based formats.
- Large uploads on slow connections may time out. For files over 5 GB, recommend running the upload inside a `screen` or `tmux` session.
- Compressed files (.gz, .zip): upload as-is for Path A. For Path B, record the compression type so the S3 files workflow can manage decompression.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `upload failed: ... An error occurred (AccessDenied)` | No write permission to target bucket | Check IAM policy or bucket policy allows `s3:PutObject` |
| `The user-provided path ... does not exist` | Typo in local path | Verify path with `ls` |
| `fatal error: An error occurred (NoSuchBucket)` | Bucket does not exist | List buckets with `aws s3 ls` and pick an existing one |
| Upload hangs or is very slow | Large file on slow connection | Check file size, suggest `tmux`/`screen`, verify network |

## References

- [upload-options.md](upload-options.md) -- Compression, multipart thresholds, sync vs cp tradeoffs
