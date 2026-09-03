# Official sources

Consult this reference only when you need authoritative grounding for GCP event-driven architecture service behavior or the full source list.

## Google Cloud documentation

Treat these as starting points, not as evidence of the user's live GCP state:
- https://cloud.google.com/pubsub/docs/dead-letter-topics
- https://cloud.google.com/pubsub/docs/ordering
- https://cloud.google.com/pubsub/docs/schema-overview
- https://cloud.google.com/eventarc/docs/overview
- https://cloud.google.com/tasks/docs/creating-queues
- https://cloud.google.com/tasks/docs/configuring-queues
- https://cloud.google.com/scheduler/docs/overview
- https://cloud.google.com/workflows/docs/overview
- https://cloud.google.com/workflows/docs/reference/rest/v1/projects.locations.workflows/get

## Grounding rule

Official documentation describes GCP messaging and eventing service behavior. It does not confirm the user's current subscription DLT configuration, queue rate limits, or consumer idempotency posture. For current-state claims, prefer live GCP CLI/API evidence or sanitized user-provided configuration.
