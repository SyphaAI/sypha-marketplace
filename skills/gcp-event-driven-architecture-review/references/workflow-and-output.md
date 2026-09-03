# Workflow and output contract

Consult this reference only when conducting the full event-driven architecture review, retry storm analysis, or hardening assessment.

## Review domains

Evaluate these areas before reaching a verdict:
- Event flow topology: producers, topics, subscriptions, consumers, and downstream dependencies
- Dead-letter topic configuration: DLT existence, max delivery attempts, DLT subscription monitoring
- Message ordering: ordering key usage, per-key throughput limits, ordering vs. throughput SLA compatibility
- Idempotency posture: consumer deduplication logic, message ID tracking, at-least-once delivery handling
- Fan-out blast radius: topic subscriber count, consumer capacity per subscriber, aggregate load during spike
- Schema registry: schema type (Avro/Protobuf), compatibility mode, breaking change protection
- Cloud Tasks queue: rate limits, max concurrent dispatches, max attempts, backoff configuration, consumer capacity
- Cloud Scheduler: retry count, retry interval, target cold start risk, min-instances alignment
- Cloud Workflows: step retry policies, parallel branch concurrency limits, execution timeout, error routing
- Retry storm risk: exponential backoff presence, circuit breaker patterns, DLT as pressure relief valve

## Safe workflow

1. **Frame scope**
   - Services involved (Pub/Sub / Eventarc / Cloud Tasks / Cloud Scheduler / Workflows):
   - Event volume and throughput SLA:
   - Ordering and idempotency requirements:
   - Required outcome:
   - Explicit non-goals:
2. **Collect evidence**
   - Use live GCP CLI/API read-only evidence when it is available.
   - Otherwise, inspect repository IaC/config, sanitized user-provided evidence, or official Google Cloud documentation.
   - Tag each finding as `live evidence`, `repo evidence`, `user-provided evidence`, `documentation-based`, or `inference`.
3. **Stress-test risk**
   - Which subscriptions lack dead-letter topics?
   - Which consumers are not idempotent under at-least-once delivery?
   - Which queue configurations could produce retry storms?
   - Which fan-out patterns exceed consumer capacity?
   - What evidence is absent?
4. **Recommend the smallest safe action**
   - Favor narrow scope, staged rollout, validation steps, and rollback capability.
   - If the safest course is to pause and gather evidence first, state that directly.

## Output contract

Return this structure:
```markdown
# GCP Event-Driven Architecture Review: <scope>
## Executive verdict
- Status: PRODUCTION READY / READY WITH RISKS / NOT READY / NEEDS EVIDENCE
- Biggest risk:
- Evidence level:
## Scope and assumptions
- Confirmed:
- Unknown:
- Out of scope:
## Findings
| Severity | Finding | Evidence | Why it matters | Minimum safe action |
|---|---|---|---|---|
## Dead-letter and retry posture
- DLT configured: <yes / no / partial>
- Max delivery attempts: <value or UNKNOWN>
- Retry storm risk: <low / medium / high>
## Idempotency and ordering posture
- Consumer idempotency: <confirmed / assumed / unknown>
- Ordering keys in use: <yes / no / partial>
- Ordering vs. throughput SLA compatible: <yes / no / unknown>
## Recommended actions
1. <action> — owner: <owner>, validation: <check>, rollback: <rollback>
## Residual risk
- <risk or explicit none>
```
