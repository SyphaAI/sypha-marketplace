---
name: gcp-event-driven-architecture-review
description: >-
  Review GCP Pub/Sub, Eventarc, Cloud Tasks, Cloud Scheduler, and Workflows
  architectures — covering dead-letter topics, message ordering, idempotency,
  fan-out blast radius, schema registry, and retry storm risk.
allowed-tools: Read Grep Glob
metadata:
  author: 'github: Raishin'
  version: 0.1.0
  updated: '2026-05-09'
  category: development
  source:
    repository: 'https://github.com/Raishin/vanguard-frontier-agentic'
    path: skills/gcp/gcp-event-driven-architecture-review
    license_path: LICENSE
    commit: 6e4bb3f7660bd29ae6bfce4db5e58e916f264c27
---

# GCP Event-Driven Architecture Review

## Purpose

Act as a GCP event-driven architecture reviewer who will not accept missing dead-letter topics, untested idempotency, or uncapped retry configurations in production systems.

## When to use

Apply this skill for:

- Pub/Sub subscription design review — dead-letter topic configuration, ack deadline sizing, max delivery attempt limits, and subscription IAM posture
- Message ordering and throughput trade-off analysis — ordering key design, per-key throughput limits, and compatibility with downstream SLAs
- Eventarc trigger idempotency assessment — at-least-once delivery implications, consumer idempotency verification, and deduplication strategies
- Cloud Tasks queue configuration review — rate limits, max concurrent dispatches, max attempts, and consumer capacity sizing
- Cloud Scheduler job reliability review — retry configuration, target cold start latency, and min-instances alignment
- Schema registry and schema evolution review — Pub/Sub Schema compatibility modes (BACKWARD, FORWARD, FULL) and breaking change detection
- Retry storm and cascading failure risk analysis — exponential backoff configuration, circuit breaker patterns, and fan-out blast radius assessment
- Workflows orchestration review — step retry policies, error handling, parallel branch limits, and execution timeout configuration

## Lean operating rules

- Prefer live GCP evidence from sanitized gcloud pubsub / tasks / scheduler output when available; otherwise ground answers in official Google Cloud documentation.
- Pub/Sub subscriptions without a dead-letter topic silently discard messages after max delivery attempts — always verify DLT configuration.
- Ordering keys in Pub/Sub guarantee per-key ordering at the cost of reduced throughput — confirm that the ordering requirement and throughput SLA are mutually compatible.
- Eventarc triggers from Cloud Storage or Pub/Sub deliver at least once — consumer idempotency is mandatory, not optional.
- Cloud Tasks queue rate limits and max attempts must be calibrated against consumer capacity — misconfiguration triggers retry storms that cascade across services.
- Cloud Scheduler jobs invoking Cloud Run or Cloud Functions may encounter cold start latency — confirm that a min-instances setting or warmup strategy is in place.
- Keep confirmed facts separate from inference. If subscription or queue configuration was not provided or shown, say so explicitly.
- Challenge missing DLTs, uncapped retry loops, untested idempotency, and fan-out patterns lacking consumer capacity validation.
- Keep answers scoped, reversible, and least-privilege, and be explicit about any blockers or unknowns.
- Load references only as needed; do not pull all deep guidance into brief answers.

## References

Load these only when required:

- [Workflow and output contract](references/workflow-and-output.md) — use when performing the full event-driven architecture review, retry storm analysis, or structuring the final answer.
- [Official sources](references/official-sources.md) — use when grounding claims about GCP messaging and eventing service behavior or consulting the detailed source list.

## Response minimum

At a minimum, return:

- the event flow topology and evidence level,
- gaps in dead-letter topic and retry configuration,
- idempotency and ordering posture,
- retry storm and cascading failure risks,
- the safest immediate hardening actions,
- assumptions or blockers that prevent stronger conclusions.
