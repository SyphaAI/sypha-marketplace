# Migration Triage References

## WHAT
This directory holds reference material for the Fusion migration triage skill's 4-category classification framework.

## LAYOUT

- [error-patterns-reference.md](error-patterns-reference.md) — Full catalog of error patterns grouped by type (YAML, packages, config/API, SQL/Jinja, static analysis, framework)
- [classification-categories.md](classification-categories.md) — Detailed definitions for each triage category (A: auto-fixable, B: guided fixes, C: needs input, D: blocked)

## CONTRIBUTING

When you encounter a migration error pattern not yet covered here, add it to the relevant section of `error-patterns-reference.md` and update `classification-categories.md` if it constitutes a new sub-pattern.
