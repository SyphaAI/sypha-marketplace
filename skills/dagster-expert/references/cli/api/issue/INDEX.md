---
title: dg api issue
type: index
triggers:
  - "listing Dagster Plus Issues, fetching a specifc Dagster Plus Issue"
---

# dg api issue Reference

Commands for working with Dagster Plus Issues.

A Dagster Plus Issue is an entry that records a problem in the user's Dagster deployment, similar to a ticket in an issue tracking system. Each Issue contains the following fields: ID, title, description, status, createdBy, links to associated Runs and Assets, and supplementary context about the Issue, including any prior discussions about the problem.

Not all organizations have access to Dagster Plus Issues. If an Unauthorized error is returned indicating that Issues are unavailable, let the user know that Issues have not been enabled for their organization.

## Get a specific Dagster Plus Issue

```bash
dg api issue get <ID>
```
- `<ID>` — the ID of the Issue to get

## List Issues for a deployment.

```bash
dg api issue list
```
Issues can be filtered by:
- Status: `--status` - options are `OPEN`, `CLOSED`, `TRIAGE`. Multiple `--status` filters can be specified
- Created before: `--created-before` - filter to Issues created before this date
- Created after: `--created-after` - filter to Issues created after this date

The response returns a list of `limit` Issues ordered chronologically from newest to oldest. To retrieve the next page of Issues, supply the ID of the oldest Issue as the cursor.

## Create a Dagster Plus Issue

```bash
dg api issue create --title <title> --description <description> --status <status>
```

- `<title>` - The title should be concise and describe the problem clearly enough that the reader immediately grasps the cause. Do not reference specific run IDs or other downstream effects.
- `<description>` - The description should consist of 2-4 bullet points covering the root cause of the problem and the recommended next steps.
- `--status` (optional) - updates the status of the Issue. One of `OPEN`, `CLOSED`, `TRIAGE`, `CANCELED`

## Update a Dagster Plus Issue

```bash
dg api issue update <ID>
```
- `<ID>` - The ID of the Issue to update
- `--status` (optional) - updates the status of the Issue. One of `OPEN`, `CLOSED`, `TRIAGE`, `CANCELED`
- `--title` (optional) - updates the title of the Issue
- `--description` (optional) - updates the description of the Issue
- `--context` (optional) - replaces the supplementary context stored for this Issue. To append rather than overwrite, retrieve the Issue first, concatenate the new information onto the existing context string, then pass the combined result to the `update` command.


## Link a run or asset to an Issue
 ```bash
 dg api issue add-link <ID>
 ```

 - `<ID>` - The ID of the Issue
 - `--run-id` (optional) - The run id of the run to link to the Issue
 - `--asset-key` (optional) - The asset key of the asset to link to the Issue. The asset key should be slash-separated (e.g. `my/asset`)

 ## Remove a linked run or asset from an Issue
 ```bash
 dg api issue remove-link <ID>
 ```

 - `<ID>` - The ID of the Issue
 - `--run-id` (optional) - The run id of the run to remove from the Issue
 - `--asset-key` (optional) - The asset key of the asset to remove from to the Issue. The asset key should be slash-separated (e.g. `my/asset`)
