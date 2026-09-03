---
name: redshift
description: >-
  This skill should be used for read-only Amazon Redshift exploration and
  business analysis via the AWS Data API.
metadata:
  category: data
  source:
    repository: 'https://github.com/onsen-ai/redshift-skill'
    path: .
    license_path: LICENSE
    commit: 976709a314efc919e61745c6783ecbfac1851e5d
---

# Redshift Skill

Apply this skill for read-only Redshift exploration and business analysis via the AWS Data API. It works with both provisioned Redshift clusters and Redshift Serverless.

This workflow depends on Python 3 and the AWS CLI.

## Python Command

Read `~/.redshift-skill/config.json` and use the `python` key as the Python command. If the config file does not yet exist, try `python3 --version` first, falling back to `python --version`. Throughout this skill, `PYTHON` refers to the detected Python command.

## First-Time Setup

Do not launch an interactive setup wizard directly from the agent. Check whether `~/.redshift-skill/config.json` exists.

If it exists, read it to verify the connection details.

If it does not exist, instruct the user to run the setup wizard in their terminal.

## Source

Canonical source: https://skills.sh/onsen-ai/redshift-skill/redshift
