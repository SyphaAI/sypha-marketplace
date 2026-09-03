# SPL2 Pipeline Kit Reference

## Coverage Model

The kit targets two runtime profiles:

- `ingestProcessor` - Splunk Cloud Platform Ingest Processor.
- `edgeProcessor` - Splunk Edge Processor on Splunk Cloud Platform or Splunk
  Enterprise 10.0+ data management nodes.

It generates and lints templates for:

- routing and copy/fan-out using `branch`, `route`, `thru`, and `into`
- filtering, sampling, redaction, hashing, timestamp extraction, and field
  extraction
- lookup enrichment and lookup import review
- JSON, XML, object, and multivalue transforms
- logs-to-metrics via `logs_to_metrics`
- OCSF conversion and post-conversion readiness handoff
- decrypt using private-key lookup placeholders
- `stats` aggregation with guardrails on supported functions
- Edge Processor `stats` state-window review
- S3 archive patterns and downstream Federated Search handoff notes
- SPL-to-SPL2 compatibility warnings
- PCRE2 regular expression migration warnings
- custom pipeline templates stored under `default/data/spl2`

## Lint Policy

The linter performs a static offline check. It does not substitute for
Splunk's preview, validation, or in-product SPL-to-SPL2 conversion tooling.

Hard errors:

- missing `$pipeline`
- missing `from $source`
- missing `into $destination`
- Ingest Processor-only commands referenced in an Edge Processor profile
- `logs_to_metrics` lacking an import statement
- `stats avg()` usage
- deprecated `object_to_array()` usage

Warnings:

- unrecognized SPL2 commands that may be custom imported functions
- SPL1-only or SPL1-shaped command patterns
- `index=` style SPL search fragments
- regex named captures using `(?<name>...)` instead of `(?P<name>...)`
- RE2/PCRE2 migration review patterns

## Source Anchors

- Ingest Processor pipeline syntax:
  <https://help.splunk.com/en/data-management/transform-and-route-data/process-data-at-ingest-time/working-with-pipelines/ingest-processor-pipeline-syntax>
- Create custom pipeline templates:
  <https://help.splunk.com/en/data-management/transform-and-route-data/process-data-at-ingest-time/working-with-pipelines/create-custom-pipeline-templates>
- SPL to SPL2 Conversion tool:
  <https://help.splunk.com/en/splunk-cloud-platform/search/spl2-search-reference/introduction/spl-to-spl2-conversion-tool>
- Convert RE2 regular expressions to PCRE2:
  <https://help.splunk.com/en/data-management/process-data-at-ingest-time/use-ingest-processor/working-with-pipelines/convert-re2-regular-expressions-to-pcre2-regular-expressions>
- Generate logs into metrics with Ingest Processor:
  <https://help.splunk.com/en/data-management/process-data-at-ingest-time/use-ingest-processor/process-data-using-pipelines/generate-logs-into-metrics-using-ingest-processor>
