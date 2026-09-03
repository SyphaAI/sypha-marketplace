---
name: web-design-guidelines
description: >-
  Evaluate UI code for Web Interface Guidelines compliance. Use when asked to
  "review my UI", "check accessibility", "audit design", "review UX", or "check
  my site against best practices".
metadata:
  author: vercel
  version: 1.0.0
  argument-hint: <file-or-pattern>
  category: development
  source:
    repository: 'https://github.com/vercel-labs/agent-skills'
    path: skills/web-design-guidelines
    commit: f8a72b9603728bb92a217a879b7e62e43ad76c81
license: MIT
---

# Web Interface Guidelines

Audit files for adherence to the Web Interface Guidelines.

## How It Works

1. Retrieve the latest guidelines from the source URL below
2. Read the specified files (or ask the user for files/pattern)
3. Validate against every rule in the fetched guidelines
4. Report findings in the terse `file:line` format

## Guidelines Source

Always fetch fresh guidelines before starting a review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to pull the current rules. The retrieved content includes all rules and instructions for formatting output.

## Usage

When the user supplies a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply every rule from the fetched guidelines
4. Report findings using the format described in the guidelines

If no files are provided, ask the user which files they want reviewed.
