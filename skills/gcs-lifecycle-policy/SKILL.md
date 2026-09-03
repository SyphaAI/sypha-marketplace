---
name: gcs-lifecycle-policy
description: >
  Handles GCS lifecycle policy operations. Auto-activating skill for GCP Skills.

  Triggers on: gcs lifecycle policy, gcs lifecycle policy

  Part of the GCP Skills category. Use when working with GCS lifecycle policy
  functionality. Activate with phrases like "gcs lifecycle policy", "gcs
  policy", "gcs".
allowed-tools: 'Read, Write, Edit, Bash(gcloud:*)'
metadata:
  upstream:
    version: 1.0.0
    author: Jeremy Longshore <jeremy@intentsolutions.io>
    compatible-with: agent-clients
  category: data
  source:
    repository: 'https://github.com/jeremylongshore/claude-code-plugins-plus-skills'
    path: skills/14-gcp-skills/gcs-lifecycle-policy
    license_path: LICENSE
    commit: 6e3a65f8c516f11e963382ec3a5ff9c72942f5fa
---

# Gcs Lifecycle Policy

## Overview

This skill offers automated assistance for GCS lifecycle policy tasks within the GCP Skills domain.

## When to Use

This skill activates automatically when you:
- Include "gcs lifecycle policy" in your request
- Ask about GCS lifecycle policy patterns or best practices
- Need assistance with Google Cloud Platform skills spanning compute, storage, BigQuery, Vertex AI, and other GCP-specific services.

## Instructions

1. Delivers step-by-step guidance for GCS lifecycle policy tasks
2. Adheres to industry best practices and established patterns
3. Produces production-ready code and configurations
4. Validates outputs against common standards

## Examples

**Example: Basic Usage**
Request: "Help me with gcs lifecycle policy"
Result: Delivers step-by-step guidance and generates the appropriate configurations


## Prerequisites

- Relevant development environment set up and configured
- Access to the necessary tools and services
- Basic understanding of GCP Skills concepts


## Output

- Generated code and configurations
- Best practice recommendations
- Validation results


## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Configuration invalid | Missing required fields | Check documentation for required parameters |
| Tool not found | Dependency not installed | Install required tools per prerequisites |
| Permission denied | Insufficient access | Verify credentials and permissions |


## Resources

- Official documentation for the related tools
- Best practices guides and reference material
- Community examples and tutorials

## Related Skills

Part of the **GCP Skills** skill category.
Tags: gcp, bigquery, vertex-ai, cloud-run, firebase
