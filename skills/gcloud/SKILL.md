---
name: gcloud
description: >-
  Interacts with Google Cloud services safely and efficiently using the gcloud
  CLI. Covers command validation, data reduction, safety guardrails with a
  denylist, and workflows for discovery and investigation. You MUST read this
  skill before running any gcloud command. Use when managing cloud resources,
  querying configurations, or troubleshooting issues via gcloud. Not intended
  for writing or debugging Google Cloud client library code or raw REST/gRPC API
  interactions.
metadata:
  category: development
  source:
    repository: 'https://github.com/google/skills'
    path: skills/cloud/gcloud
    license_path: LICENSE
    commit: 28d90a333c4d900bcc76e498363e0c835dc69a5c
---

# gcloud CLI Skill for AI Agents

This document provides essential guidelines and best practices for AI agents
working with the Google Cloud SDK (`gcloud` CLI). Adhering to these rules is
critical for preventing hallucinated commands, flags, flag values, and positional
argument syntax, avoiding destructive actions, and minimizing context window usage.

## Getting Started

### 1. Installation

If the `gcloud` executable is not present, consult the official
[Google Cloud CLI Installation Guide](https://docs.cloud.google.com/sdk/docs/install-sdk.md.txt)
to install it on your platform (Linux, macOS, Windows, etc.).

### 2. Authorization

Authenticate the CLI with Google Cloud by selecting the flow that matches your
running environment:

*   **User Account (Interactive)**: Run `gcloud auth login` and follow the browser
    prompts to sign in.
*   **User Account (Headless Flow)**: When working on a terminal without a web
    browser (e.g. containers, remote SSH), add the `--no-browser` flag:
    `gcloud auth login --no-browser`. Copy the URL, complete sign-in on another
    machine, then supply the authentication code.
*   **Application Default Credentials (ADC)**: To authenticate SDK or library
    calls from local applications, configure ADC via `gcloud auth
    application-default login` (add `--no-browser` for headless environments).
*   **Service Account (Best for Detached/Headless Automation)**: Authenticate
    directly with a JSON key file. Suited to fully automated background tasks
    and pipelines: `gcloud auth activate-service-account
    --key-file=path/to/key.json`. Note that some organizations restrict access
    to JSON key files for security reasons.
*   **Service Account Impersonation (Preferred for Local Pair-Programming
    Agents)**: Use the human developer's existing credentials to assume a service
    account identity. Best for local development assistants, avoiding insecure
    private keys on human workstations: `gcloud config set
    auth/impersonate_service_account SERVICE_ACCT_EMAIL`

*Separation of Privilege (Critical)*: Both service account approaches keep the
agent's permissions strictly separate from the human user's broader access
(enforcing least privilege) and ensure actions are audited under the agent's
focused identity. *(Impersonation requires `roles/iam.serviceAccountTokenCreator`)*.

For additional strategies and authentication types (such as Workload Identity
Federation), see
[Authorizing the gcloud CLI](https://docs.cloud.google.com/sdk/docs/authorizing.md.txt).

## Core Principles

### 1. Explicit Command Validation (Mandatory)

Your built-in knowledge of `gcloud` may be outdated or prone to hallucination
(e.g., fabricating commands, flags, flag values, or positional argument syntax).
You are **FORBIDDEN** from running any command until you have validated the
exact syntax at the leaf level.

*   **Action**: Always invoke `gcloud help <command>` for the *exact* command you
    plan to run (e.g., `gcloud help compute instances create`).
*   **Verify**: Confirm that the command, flags, flag values, and positional
    argument syntax are valid for that specific leaf command before executing.
    Validation does not carry over from parent groups.

### 2. Data Reduction Strategies

To conserve context window space and reduce latency, always minimize the volume
of data returned by `gcloud`.

*   **Projection**: Use `--format=json(key1, key2, ...)` to retrieve only the
    specific fields your task requires. For advanced projection and formatting
    syntax, see `gcloud topic projections` and `gcloud topic formats`.

*   **Limiting**: Use `--limit=N` to cap the number of resources returned.

*   **Filtering**: Use `--filter` to restrict results server-side. Use `:` for
    pattern matching and never quote the right-hand side of the colon. Treat the
    entire filter flag as a single string, without quoting or escaping any
    characters. For filter expression syntax, refer to `gcloud topic filters`.

*   **Schema Discovery**: Unconstrained resource lists can rapidly exhaust your
    context window with redundant data. To avoid this, discover a resource's
    schema before running queries. If the correct JSON key path for field
    projection (`--format`) or filtering (`--filter`) is unclear, run the
    relevant resource's list command (if available) with a single-item limit:

    ```bash
    gcloud <GROUP> <RESOURCE> list --limit=1 --format=json
    ```

    Inspect the JSON structure of that single instance to safely identify the
    correct schema keys before requesting full or filtered datasets.

### 3. Execution Constraints

*   **Single Commands**: Issue only one `gcloud` command at a time — no command
    chaining or sequencing.
*   **No Shell Operators**: Do not use command substitution (`$(...)`), pipes
    (`|`), or redirection (`>`, `>>`, `<`). This keeps commands safe and easy
    for users to review and understand.
*   **No Interactivity**: Do not run interactive commands or commands that
    require a TTY (e.g., `gcloud interactive`). Enforce non-interactive mode by
    always appending `--quiet` (or `-q`), ensuring defaults are applied or
    errors are raised when input would otherwise be required.

### 4. Project and Location Scoping (Critical)

To keep commands deterministic, non-interactive, and reliably targeted at the
correct environment, you must explicitly manage project and location scoping.

*   **Explicit Project Target**: Do not depend on active configuration defaults.
    Always include `--project=<PROJECT_ID>` on all resource-manipulating and
    querying commands (except pure local config commands). This prevents
    accidental execution against the wrong project.

*   **Prevent Location Prompts**: Many Google Cloud resources are regional or
    zonal. Omitting the location flag (e.g., `--region`, `--zone`, or
    `--location`) causes `gcloud` to prompt interactively for a zone or region,
    violating the **No Interactivity** rule. Always supply explicit location
    flags when a command requires them.

*   **Location Discovery**: When the correct region, zone, or location for a
    service is unknown, run discovery commands first (and remember to limit
    results when there are many):

    *   **Compute Engine (VMs, Networks)**:

        *   `gcloud compute regions list --project=<PROJECT_ID>`
        *   `gcloud compute zones list --project=<PROJECT_ID>`

    *   **Other Services (Standard API Style)**: Many GCP services utilize a
        unified `locations list` command:

        *   `gcloud <GROUP> locations list --project=<PROJECT_ID>`
        *   *Examples*: `gcloud artifacts locations list`, `gcloud kms locations
            list`, `gcloud secrets locations list`.

## Safety & Guardrails

> [!CAUTION] **Destructive actions (delete, update, remove) MUST be explicitly
> authorized by the user.** Never invoke them autonomously unless explicitly
> instructed to do so in the context of a safe, pre-approved workflow.

### Prohibited Operations (Denylist)

You are **strictly prohibited** from running the following commands autonomously.
All of these require explicit human-in-the-loop authorization:

*   **Any IAM policy, role, or binding modification** (Security): Risks include
    privilege escalation, administrative lockout, service disruption, or
    unauthorized data exposure.
*   **No Proactive API Enabling**: Treat all necessary APIs as already enabled.
    Do not proactively attempt to enable APIs — doing so can trigger unexpected
    resource provisioning or billing charges. User approval is required before
    enabling any API.
*   **`gcloud * delete`** (Destructive): Causes irreversible resource destruction
    (e.g., project deletion) or data loss.
*   **`gcloud billing *`** (Financial): Risk of service disruption or unbounded
    costs.
*   **`gcloud organizations *`** (Governance): Org-level changes affect the
    security posture of all users.
*   **`gcloud kms *`** (Encryption): Risk of permanently locking out access to data.
*   **`gcloud infra-manager deployments apply`** (Destructive): Autonomous IaC
    execution can result in the destruction of managed resources.

### Execution Guidelines

*   **Dry Run (Mandatory)**: If a `--dry-run` flag (or equivalent) is available
    for a command, you MUST invoke it first to preview the changes before running
    the actual command.

*   **Long Running Operations**: For commands that support it, the `--async`
    flag is strongly recommended for long-running operations to prevent blocking
    the agentic flow. Not every command exposes an `--async` flag. For commands
    that return an operation ID (whether via `--async` or by default), you are
    responsible for polling for completion when the operation status is required
    for a subsequent step.

## Structured Workflows

### Discovery Workflow

When asked to perform a task on an unfamiliar service:

1.  You MUST run help on the command (e.g., `gcloud help <COMMAND>`) before
    executing it.
2.  If the exact command is unknown, navigate the command tree by running help
    on a command group (e.g., `gcloud help compute`) to locate available
    subcommands and groups.
3.  **Schema Discovery**: When you need to filter or project fields from a list
    command but do not know the exact JSON keys, first run `gcloud <GROUP>
    <RESOURCE> list --limit=1 --format=json` to discover the schema safely.
    **Never** run a bare `list` command without scoping constraints (such as
    `--limit=1`), as unconstrained output will pollute and exhaust your context
    window.
4.  Execute with data reduction flags applied.

## Quick Reference / Cheat Sheet

Task               | Command Template
------------------ | ----------------------------------------------------------
Discover Schema    | `gcloud <GROUP> <RESOURCE> list --limit=1 --format=json`
Filtered List      | `gcloud <GROUP> <RESOURCE> list --filter="status:RUNNING"`
Specific Columns   | `gcloud <GROUP> <RESOURCE> list --format="json(name, id)"`
Learn Filters      | `gcloud topic filters`
Learn Formats      | `gcloud topic formats`
Learn Projections  | `gcloud topic projections`
Asynchronous Op    | `gcloud <COMMAND> --async`
Check Operation    | `gcloud operations describe <OPERATION_ID>`
Common commands    | `gcloud cheat-sheet`
List Regions (GCE) | `gcloud compute regions list --project=<PROJECT_ID>`
List Zones (GCE)   | `gcloud compute zones list --project=<PROJECT_ID>`
List Locations     | `gcloud <GROUP> locations list --project=<PROJECT_ID>`

See the
[gcloud CLI Scripting Guide](https://docs.cloud.google.com/sdk/docs/scripting-gcloud.md.txt)
for guidance on using the gcloud CLI in automated workflows.
