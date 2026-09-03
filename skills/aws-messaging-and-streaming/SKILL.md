---
name: aws-messaging-and-streaming
description: >
  Guidance for working with AWS messaging and streaming services, covering
  Amazon SQS, Amazon SNS, Amazon EventBridge, Amazon MQ, Amazon Kinesis Data
  Streams, Amazon Data Firehose, Amazon Managed Service for Apache Flink, and
  Amazon Managed Streaming for Apache Kafka (MSK). Apply when building
  messaging and streaming patterns.
metadata:
  upstream:
    version: 1
  category: development
  source:
    repository: 'https://github.com/aws/agent-toolkit-for-aws'
    path: plugins/aws-core/skills/aws-messaging-and-streaming
    license_path: LICENSE
    commit: cbdc61a29707dc97989d5d11a2b53ad584781e78
---

# AWS Messaging & Streaming Services

For AWS messaging and streaming questions, confirm exact numbers, versions, limits, and behavioral details against service-specific skills or the official AWS documentation. If unsure, look it up in skills or docs instead of guessing — inventing configuration options or citing wrong version numbers is worse than acknowledging uncertainty.

When asked about recommended configurations (CloudWatch alarm settings, thresholds, missing data treatment), consult the service-specific skills or documentation instead of falling back on generic best practices.

## Overview

Domain knowledge for selecting and working with the AWS services that carry data between producers and consumers.
Two fundamental patterns are covered — **messaging** and **streaming** — along with the AWS services implementing each one.
Use this skill to determine which pattern suits a workload, pick the appropriate service, and understand how the services integrate together.

For detailed guidance on any individual AWS service, consult reference files or the service-specific Skills.

## Streaming and Messaging

### What Is Messaging?

Messaging provides **decoupled, asynchronous communication** between components. A producer emits a message; one or more consumers pick it up and process it, and after processing the message is usually deleted. Delivery guarantees, retries, and dead-letter routing are handled by the messaging service.

**Key characteristics:**

- A message is either consumed once (point-to-point) or fanned out (pub/sub), then removed
- There is no replay — after acknowledgment, the message is gone
- Suited to command/request workloads, task distribution, and event notification

### What Is Streaming?

Streaming provides an **ordered, durable, high-throughput continuous flow of data**. Producers append records to a log, and consumers read from positions within that log. Records remain available for a configurable retention period whether or not they have been consumed.

**Key characteristics:**

- Records stay retained and can be replayed inside the retention window
- Ordering is strict within a partition/shard
- Several independent consumers may read the same data from different positions
- Suited to event sourcing, real-time analytics, change data capture, and continuous processing

### Key Differences

| Dimension | Messaging | Streaming |
|---|---|---|
| **Data lifecycle** | Deleted after consumption | Retained for replay (hours to indefinitely) |
| **Ordering** | Best-effort (Standard) or per-group (FIFO) | Strict per-partition/shard |
| **Consumer model** | Competing consumers (work distribution) | Independent readers (fan-out by position) |
| **Throughput pattern** | Bursty, variable | Sustained, high-volume |
| **Replay** | Not supported (except DLQ redrive) | Native — seek to any position in retention |
| **Typical latency** | Milliseconds (push or short-poll) | Milliseconds to low seconds |
| **Scaling unit** | Concurrency (consumers/pollers) | Partitions or shards |

### Messaging Use Cases

- Decoupling microservices via request/response or command patterns
- Spreading work over a pool of competing consumers (task queues)
- Fan-out notifications in which each subscriber acts on its own
- Bursty workloads that gain from queue buffering
- Moving existing JMS/AMQP applications over (Amazon MQ)

### Streaming Use Cases

- High-throughput, continuous data ingestion (logs, metrics, clickstreams, IoT telemetry)
- Event sourcing in which consumers must replay from arbitrary points in time
- Several independent consumers handling the same data in different ways
- Real-time analytics, windowed aggregations, or complex event processing
- Pipelines for change data capture (CDC)

### Messaging Services

The following services typically serve messaging workloads.
Depending on the precise use case and requirements, streaming services (Kinesis Data Streams, Managed Streaming for Apache Kafka) are occasionally used for messaging workloads too.

| Service | Best For | Key Differentiator |
|---|---|---|
| **Amazon SQS** | Task queues, decoupling, buffering | Fully managed, unlimited throughput (Standard), exactly-once (FIFO), fair queues for multi-tenant workloads |
| **Amazon SNS** | Fan-out, pub/sub notifications | Push to multiple subscribers (SQS, Lambda, HTTP, email, SMS) |
| **Amazon EventBridge** | Event routing, cross-account/SaaS integration | Content-based filtering, schema registry, 200+ AWS source integrations |
| **Amazon MQ** | Lift-and-shift of existing JMS/AMQP/MQTT apps | Protocol compatibility (ActiveMQ, RabbitMQ) for legacy migration |

### Streaming Services

The following services typically serve streaming workloads.

| Service | Best For | Key Differentiator |
|---|---|---|
| **Amazon Kinesis Data Streams** | Real-time ingestion with AWS-native consumers | On-demand Advantage mode (instant scaling, no shard management), 1–365 day retention |
| **Amazon Data Firehose** | Zero-admin delivery to storage/analytics | Auto-scales, buffers, batches, and delivers to destinations |
| **Amazon Managed Service for Apache Flink** | Complex stream processing (joins, windows, state) | Full Apache Flink runtime — SQL, Java, Python APIs for stateful computation |
| **Amazon MSK** | Kafka-native workloads, ecosystem compatibility | Apache Kafka API, Express brokers (3x throughput, 20x faster scaling compared to Standard brokers), broad connector ecosystem |

## Common Integration Gotchas

- **SQS system vs. user message attributes:** Attributes such as `AWSTraceHeader` (written by X-Ray / EventBridge / Pipes on delivery to an SQS DLQ) plus `SenderId` and `SentTimestamp` are SQS *system* attributes, NOT user message attributes. `ReceiveMessage` never returns them by default — you must ask for them explicitly with `AttributeNames=[...]` (or `MessageSystemAttributeNames`), which is separate from `MessageAttributeNames`, the parameter that retrieves user attributes. This is important for DLQs, since the trace header travels in the system attribute while the user-attributes slot holds the service's failure metadata (e.g. EventBridge's `RULE_ARN`, `ERROR_CODE`).

- **SNS → Firehose → S3 record separator:** When an SNS subscription uses the `firehose` protocol and the data ends up in S3, the records arrive newline-delimited by default (NDJSON). Do NOT enable Firehose's `AppendDelimiterToRecord` — the newline is emitted by SNS itself, so turning the processor on results in double newlines.

- **EventBridge rule target DLQ + SNS subscription DLQ both need a DLQ queue policy.** Simply attaching the DLQ is insufficient — until its queue policy permits the service principal, the DLQ drops messages silently. EventBridge: `PutTargets` with `DeadLetterConfig.Arn=<DLQ>`, together with an SQS policy `Allow sqs:SendMessage` for `Service: events.amazonaws.com` where `aws:SourceArn` = the rule ARN. SNS: `SetSubscriptionAttributes` `RedrivePolicy={"deadLetterTargetArn":"<DLQ>"}`, together with an SQS policy permitting `Service: sns.amazonaws.com` scoped by the topic ARN.

- **SQS production defaults: long polling + customer-managed encryption.** Newly created queues come with short-poll (`ReceiveMessageWaitTimeSeconds=0`) and SSE-SQS (AWS-owned key). In production, call `SetQueueAttributes` with `ReceiveMessageWaitTimeSeconds=20` (long polling) and `KmsMasterKeyId=<customer-managed key id/ARN>` instead of keeping `alias/aws/sqs`.

- **Broker and Kafka credentials belong in Secrets Manager, not connection strings.** Never hardcode usernames, passwords, or SASL/SCRAM credentials into application config, env vars, JAAS files, or IaC. With Amazon MQ (ActiveMQ/RabbitMQ), keep broker users as secrets and retrieve them at startup; Lambda event source mappings for Amazon MQ demand the broker credentials as a Secrets Manager secret ARN (`BASIC_AUTH`), never inline. With MSK SASL/SCRAM the secret is mandatory: it must carry the `AmazonMSK_` name prefix and be encrypted with a **customer-managed** KMS key (a secret created under the default `aws/secretsmanager` key cannot be associated with a cluster), and is then attached using `BatchAssociateScramSecret`. Lambda event source mappings for MSK (SASL/SCRAM or mTLS) and for self-managed Kafka likewise point to a Secrets Manager secret ARN instead of inline credentials. Turn on rotation and restrict IAM read access (`secretsmanager:GetSecretValue`) to only the consuming role. See AWS Well-Architected [SEC02-BP03 Store and use secrets securely](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_secrets.html).

- **Service-principal resource policies need `aws:SourceArn` / `aws:SourceAccount` conditions.** If a queue or topic policy grants a service principal such as `events.amazonaws.com`, `sns.amazonaws.com`, or `s3.amazonaws.com` the right to `sqs:SendMessage` or `sns:Publish`, leaving out source conditions creates a confused-deputy hole — writes can be driven by any rule, topic, or bucket in any AWS account. Constrain every such statement with `aws:SourceArn` (the exact rule/topic/bucket/pipe ARN; when the ARN isn't fully known yet, use `ArnLike` with `*`) and `aws:SourceAccount` (your account ID). S3 event notifications require both keys, since S3 bucket ARNs contain no account ID and `aws:SourceArn` by itself does not pin the account. The same pattern extends to role trust policies for IAM roles used by EventBridge rules and EventBridge Pipes (principal `events.amazonaws.com` / `pipes.amazonaws.com`, `aws:SourceArn` = the rule or pipe ARN) — it is not limited to the DLQ case above. See the IAM User Guide on [The confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html).
