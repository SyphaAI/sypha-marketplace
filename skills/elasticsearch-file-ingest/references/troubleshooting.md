# Troubleshooting

Frequent issues and their resolutions for the ingest tool.

## Connection Refused

Elasticsearch is either not running or the URL is wrong. Run the connection test:

```bash
node scripts/ingest.js test
```

If the test fails, ask the user to check their Elasticsearch environment configuration.

## Out of Memory Errors

Lower the buffer size:

```bash
node scripts/ingest.js ingest --file data.json --target my-index --buffer-size 2048
```

## Transform Function Not Loading

Verify that the transform file exports correctly:

```javascript
// ✓ Correct (ES modules)
export default function transform(doc) {
  /* ... */
}

// ✓ Correct (CommonJS)
module.exports = function transform(doc) {
  /* ... */
};

// ✗ Wrong
function transform(doc) {
  /* ... */
}
```

## Mapping Conflicts

Remove and recreate the index:

```bash
node scripts/ingest.js ingest \
  --file data.json \
  --target my-index \
  --mappings mappings.json \
  --delete-index
```

## Slow Ingestion

Investigate these common causes:

1. **Large documents**: Lower `--buffer-size`
2. **Complex transforms**: Simplify the transform logic
3. **Elasticsearch load**: Check cluster health and the indexing queue

## Stall Warnings

Stall warnings indicate that ingestion is pausing due to backpressure:

```bash
# Increase stall warning threshold
node scripts/ingest.js ingest \
  --file data.json \
  --target my-index \
  --stall-warn-seconds 60

# Debug pause/resume events
node scripts/ingest.js ingest \
  --file data.json \
  --target my-index \
  --debug-events
```

## CSV Parsing Issues

For CSV files using non-standard formatting:

```bash
# Create csv-options.json
cat > csv-options.json << 'EOF'
{
  "columns": true,
  "delimiter": ";",
  "trim": true,
  "skip_empty_lines": true
}
EOF

node scripts/ingest.js ingest \
  --file data.csv \
  --source-format csv \
  --csv-options csv-options.json \
  --target my-index
```

## Authentication Errors

Use the built-in connection test to confirm credentials and connectivity:

```bash
node scripts/ingest.js test
```

If the test fails, ask the user to review their Elasticsearch credentials and environment configuration.
