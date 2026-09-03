---
name: collibra-chip
description: >-
  Use this skill when a connected Collibra Chip MCP server is available to
  supply domain-specific Collibra workflows and references.
metadata:
  category: data
  source:
    repository: 'https://github.com/collibra/chip'
    path: pkg/skills/files/collibra/index
    license_path: LICENSE
    commit: 613bd03a4c8326cf19049d64884b12d9fb8e5b01
---

# Collibra Chip MCP Skill Discovery

Collibra Chip delivers its detailed guides at runtime via MCP. This package is a Sypha-facing routing reference; it does not include an upstream source tree or embedded copies of the Collibra guides.

## Required Tools

Use the connected Chip MCP server's advertised tools. The expected capabilities are:

- `list_collibra_skills`: discover available guides and descriptions
- `load_collibra_skill`: load a guide body, metadata, or one of its bundled references

Tool names may be namespaced by the MCP client. Identify tools by their advertised name and schema instead of hard-coding a namespace.

## Workflow

1. Verify that the Collibra Chip MCP server is connected.
2. Invoke `list_collibra_skills`, requesting descriptions when the schema supports that parameter.
3. If the task is ambiguous, load the catalog/index guide first; otherwise select the most specific matching guide.
4. Invoke `load_collibra_skill` to retrieve that guide's body.
5. Load a bundled reference only when the guide explicitly requires it.
6. Proceed according to the loaded guide and the live MCP tool schemas. Do not infer operation names, UUID formats, or mutation payloads from this router.

## Common Routing Topics

Depending on the server version, the catalog may contain guides covering discovery, technical lineage, asset creation, and asset editing. Regard this list as orientation only; the output of `list_collibra_skills` is the authoritative source.

- Discovery: semantic versus keyword search and resolving names to UUIDs
- Lineage: technical lineage and identifier bridging
- Asset creation: duplicate checks, required fields, and rich-text handling
- Asset editing: supported operation types and safe update sequencing

## Safety

- Convert human-readable names to identifiers before performing mutations.
- Fetch the target asset before modifying it.
- Seek explicit confirmation before executing destructive or wide-ranging updates.
- Retain the exact rich-text and operation formats specified by the loaded guide.
- If the MCP server is unreachable or a listed guide fails to load, report that the workflow is unavailable; do not substitute nonexistent local files.
