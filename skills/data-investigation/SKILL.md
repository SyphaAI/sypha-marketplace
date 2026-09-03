---
name: data-investigation
description: >-
  A workflow for performing rigorous, reproducible data investigations and
  ad-hoc analyses. Trigger this skill when exploring a business question,
  diagnosing a metric anomaly, testing a hypothesis, conducting root cause
  analysis, or producing a one-off investigation dashboard or memo.
metadata:
  category: data
  author: Pedro / Sypha Code
  source:
    repository: 'https://github.com/Sypha-Org/skills'
    path: skills/data-investigation
    license_path: LICENSE
    commit: a30ff33da809171784aca50d1b5978cebc2185f1
---

# Data Investigation

Use this skill to deliver investigations that are fast, accurate, reproducible,
and arrive at a definitive conclusion rather than an accumulation of charts.

## Purpose

Every investigation must be expressible in a single sentence before the first
SQL query is run.

## Phase 1: Frame Before Querying

### 1. Write the one-sentence answer first

Before writing any SQL, draft the sentence that captures the expected conclusion.

Example: `The cohort size gap is a definition problem rather than a product behavior problem.`

If that sentence cannot be written, the question is not yet well-understood.

### 2. Classify the investigation type

| Type | Trigger | Approach |
|---|---|---|
| Gap analysis | Why do A and B not match? | Establish the gap, localize it, explain it |
| Root cause | Why did this metric change? | Confirm real, isolate segment, align timing, validate mechanism |
| Hypothesis test | Is X causing Y? | Define what must be true, test sub-claims, confirm or reject |
| Feasibility check | Is this number trustworthy? | Check grain, joins, nulls, definition overlap |

### 3. State 2-3 competing hypotheses before querying

Never work from a single hypothesis. Doing so introduces confirmation bias.

Rank hypotheses by plausibility and record which one is currently favored
and the reasoning behind that preference.

## Phase 2: Build Queries In Escalating Specificity

### 1. Establish first, explain second

Step 1 always verifies that the anomaly is genuine and measures its scale.
Do not move to root-cause analysis until the effect has been confirmed.

```sql
select
    <time_bucket>,
    <source_a_count> as metric_a,
    <source_b_count> as metric_b,
    <source_a_count> - <source_b_count> as gap,
    round(100.0 * (<source_a_count> - <source_b_count>) / nullif(<source_a_count>, 0), 1) as pct_gap
from ...
order by 1
```

### 2. Localize by breaking one dimension at a time

Once the gap is confirmed, decompose it along one dimension at a time:
- By time: at what point did it emerge?
- By segment: which population is impacted?
- By signal/source: which path is absent?

### 3. Align timing with upstream changes

Once the anomaly's start date is established, examine:
- git commits affecting relevant models, ETL jobs, or application code
- schema migrations or upstream source changes
- revisions to metric definitions
- external events such as launches, campaigns, or pricing adjustments

A credible root cause must account for why the metric shifted at that specific moment.

### 4. Validate the mechanism

After identifying a candidate cause, verify it concretely:
- Does the affected population align with the predicted population?
- What does the counterfactual reveal?
- Does a separate, independent signal corroborate the explanation?

Do not treat correlation as confirmation.

### 5. Quantify each hypothesis before concluding

Attach a concrete number to every candidate explanation.

Examples:
- `H1 accounts for 1,240 users`
- `H2 accounts for 1,050 users`

A hypothesis that cannot be quantified has not yet been validated.

## Phase 3: SQL Hygiene Rules

### Use stable time bounds for investigations

Investigation SQL must be reproducible. Prefer fixed date bounds over rolling
windows unless the analysis is explicitly operational and designed to stay current.

```sql
-- Prefer fixed investigation scope
where created_at >= '2026-02-16'
  and created_at < '2026-04-04'
```

### Add explicit grain comments in important CTEs

```sql
-- grain: one row per user
with users as (
    ...
)
```

### Prefer named comparison outputs over raw aggregates

Bad:

```sql
select count(*) from ...
```

Better:

```sql
select
    count(*) as users_in_scope,
    count(distinct org_id) as orgs_in_scope
from ...
```

### Keep diagnostic queries small and discardable

Diagnostic SQL is written to answer a single question. Avoid building large
reusable queries before the investigation is complete.

## Phase 4: Communication Rules

### Lead with the answer

The opening sentence of any written output must state the conclusion directly.

Bad:

`I looked at several possible explanations for the discrepancy.`

Good:

`The discrepancy is caused by internal users being excluded from the dashboard query but included in the warehouse baseline.`

### Separate evidence from interpretation

Use a structure like:

1. Conclusion
2. Evidence
3. Why alternative hypotheses were rejected
4. Recommended next action

### Include the limiting assumption

Every investigation must identify the most significant assumption that, if wrong,
would alter the conclusion.

Example:

`This conclusion assumes backend event timestamps are complete for the affected week; if ingestion was delayed, the gap may be overstated.`

## Phase 5: Output Standard

Every completed investigation must leave behind:

1. One-sentence answer
2. Final supporting SQL or notebook
3. A note on hypotheses that were ruled out
4. Any remaining follow-up questions or unresolved ambiguities

## Common Failure Modes

- Misclassifying a metric definition dispute as a product issue
- Comparing sources that differ in grain or freshness
- Accepting the first plausible explanation without quantifying it
- Attempting a single large query too early in the investigation
- Concluding with charts rather than a concrete answer

## Related Skills

- Use the [`answering-natural-language-questions-with-dbt`](https://github.com/dbt-labs/dbt-agent-skills/tree/main/skills/dbt/skills/answering-natural-language-questions-with-dbt) workflow when the goal is answering a business question rather than debugging why analysis or metrics disagree.
