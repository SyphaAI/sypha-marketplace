---
name: splunk-spl2-pipeline-kit
description: >-
  Generate and lint reusable SPL2 pipeline templates for Cisco Data Fabric,
  Splunk Ingest Processor, and Edge Processor, covering routing, redaction,
  sampling, lookups, metrics, OCSF, decrypt, stats, custom templates,
  SPL-to-SPL2 compatibility, and PCRE2 migration checks. Trigger when the user
  needs SPL2 pipeline authoring, conversion review, compatibility linting, or
  shared templates for Ingest Processor or Edge Processor workflows, including
  Cisco Data Fabric or telemetry pipeline management requests that require
  reusable SPL2 pipeline logic.
metadata:
  category: observability
  source:
    repository: 'https://github.com/chambear2809/splunk-cisco-skills'
    path: skills/splunk-spl2-pipeline-kit
    license_path: LICENSE
    commit: 99b2c778dbeaad84023765d24e1a13f414009f6a
---

# Splunk SPL2 Pipeline Kit

This skill serves as the shared SPL2 authoring and validation layer for
`splunk-ingest-processor-setup` and `splunk-edge-processor-setup`. It operates
entirely offline: it generates starter SPL2, lints pipeline files, and surfaces
profile compatibility issues without making any Splunk API calls.

Under the updated Cisco Data Fabric terminology, this is the reusable SPL2
authoring route. Native Observability Metrics Pipeline Management remains a
distinct UI workflow handled by `splunk-observability-deep-native-workflows`.

## Agent Behavior

- Use `ingestProcessor` for Splunk-hosted Ingest Processor pipelines.
- Use `edgeProcessor` for Edge Processor pipelines.
- Exclude real samples, private keys, HEC tokens, Observability tokens, and
  lookup contents from chat and rendered files. Emit only placeholders and
  file-path handoffs.
- Treat SPL-to-SPL2 conversion as review assistance only. Splunk's in-product
  conversion tool is the authoritative conversion workflow.
- Review `reference.md` before modifying supported commands, templates, or lint
  rules.

## Quick Start

Render every template and lint the rendered output:

```bash
bash skills/splunk-spl2-pipeline-kit/scripts/setup.sh --phase all --profile both
```

Lint a user-provided pipeline:

```bash
bash skills/splunk-spl2-pipeline-kit/scripts/setup.sh \
  --phase lint \
  --profile ingestProcessor \
  --pipeline-file pipelines/my_pipeline.spl2
```

Run the offline smoke test:

```bash
bash skills/splunk-spl2-pipeline-kit/scripts/smoke_offline.sh
```

## Outputs

The default output directory is `splunk-spl2-pipeline-kit-rendered/`:

- `templates/<profile>/*.spl2` - route, branch, redact, sample, lookup,
  extract, timestamp, JSON/XML, OCSF, decrypt, metrics, stats, S3, and
  compatibility starter templates where supported.
- `custom-template-app/default/data/spl2/*.spl2` - SPL2 custom template module
  examples demonstrating `@template` and runtime profile metadata.
- `lint-report.json` and `lint-report.md`.
- `coverage-report.json`.

## Guardrails

- `logs_to_metrics` requires an `import logs_to_metrics from
  /splunk.ingest.commands` style import and is available only on Ingest
  Processor.
- `decrypt` is Ingest Processor-only and must be handled as a private-key
  lookup handoff. Never render private-key material.
- `stats` linting rejects `avg()` because Ingest Processor documents
  `sum()/count()` as the supported average pattern. Edge Processor `stats` is
  supported and adds state-window behavior on current EP versions.
- `object_to_array()` is deprecated per SPL2 release notes; use
  `json_entries()` instead.
- Regex guidance targets PCRE2. Prefer named captures such as
  `(?P<fieldName>...)`.
- Differences that are Edge Processor-only or Ingest Processor-only are
  surfaced in the lint output rather than buried in comments.
