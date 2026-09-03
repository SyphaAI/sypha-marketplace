# Classification Categories

Detailed definitions for the 4-category triage framework used to sort dbt-core to Fusion migration errors.

## Contents
- [Category A: Auto-Fixable (Safe)](#category-a-auto-fixable-safe)
- [Category B: Guided Fixes (Need Approval)](#category-b-guided-fixes-need-approval)
- [Category C: Needs Your Input](#category-c-needs-your-input)
- [Category D: Blocked (Not Fixable in Project)](#category-d-blocked-not-fixable-in-project)

## Category A: Auto-Fixable (Safe)

**Fixable automatically with HIGH confidence.**

These are low-risk changes where the fix is deterministic and well-understood. No user approval is needed beyond an initial confirmation.

### Sub-patterns

| Sub-pattern | Error Code | Signal | Fix | Risk |
|-------------|------------|--------|-----|------|
| Quote nesting in config | `dbt1000` | `syntax error: unexpected identifier` with nested quotes | Use single quotes outside: `warn_if='{{ "text" }}'` | LOW — syntactic only |

### When to use Category A
- The fix is a known, safe transformation
- Exactly one correct fix exists (no ambiguity)
- The change carries no semantic impact on the project

---

## Category B: Guided Fixes (Need Approval)

**Fixable with user approval — present diffs first.**

These fixes are well-understood but may alter project behavior. Always display the exact diff and obtain approval before applying.

### Sub-patterns

| Sub-pattern | Error Code | Signal | Fix | Risk |
|-------------|------------|--------|-----|------|
| Config API deprecated | `dbt1501` | "Argument must be a string or a list. Received: (empty)" | `config.require('meta').key` to `config.meta_require('key')` | MEDIUM — API change |
| Plain dict `.meta_get()` error | `dbt1501` | "unknown method: map has no method named meta_get" | `dict.meta_get()` to `dict.get()` | LOW — method name only |
| Unused schema.yml entries | `dbt1005` | "Unused schema.yml entry for model 'ModelName'" | Remove orphaned YAML entry | LOW — just a warning |
| Source name mismatches | `dbt1005` | "Source 'Name' not found" | Align source references with YAML definitions | MEDIUM — Fusion is strict on naming |
| YAML syntax errors | `dbt1013` | "YAML mapping values not allowed" | Fix quotes, indentation, colons | MEDIUM — syntax dependent |
| Unexpected config keys | `dbt1060` | "Unexpected key in config" | Move custom keys to `meta:` section | MEDIUM — changes config structure |
| Package version issues | `dbt1005`, `dbt8999` | "Package not in lookup map", "Cannot combine non-exact versions" | Update versions, use exact pins | MEDIUM — may change package behavior |
| SQL parsing errors | — | SQL parsing failures under static analysis | Suggest rewriting the logic (with user approval), or set `static_analysis: off` for the model | MEDIUM — may change analysis behavior |
| "--models flag deprecated" | — | If the repro command uses `--models/-m`, replace with `--select/-s` | MEDIUM — may change command behavior |
| Duplicate doc blocks | `dbt1501` | "Duplicate doc block" | Rename or delete conflicting blocks | LOW — documentation only |
| Seed CSV format | `dbt1021` | "Seed cast error" | Clean CSV (ISO dates, lowercase `null`) | MEDIUM — data format change |
| Empty SELECT | `dbt0404` | "SELECT with no columns" | Add `SELECT 1` or actual column list | LOW — placeholder needed |

### When to use Category B
- The fix is well-understood but involves a judgment call
- Multiple files may be affected
- The change could impact query behavior or project structure
- The user should review exactly what will change before it is applied

---

## Category C: Needs Your Input

**Requires user decision — multiple valid approaches exist.**

These errors have more than one correct resolution. The skill should lay out the options and let the user decide.

### Sub-patterns

| Sub-pattern | Signal | Options |
|-------------|--------|---------|
| Permission errors — Hardcoded FQNs | Permission denied, access errors with `FROM database.schema.table` | (1) Replace with `{{ ref('table_name') }}` if dbt model, (2) Replace with `{{ source('schema', 'table_name') }}` if source, (3) Ensure credentials if external table |
| Failing `analyses/` queries | Errors in `analyses/` directory | (1) Disable static analysis, (2) Delete the file, (3) Fix the query |

### When to use Category C
- Multiple valid fixes exist and the correct one depends on project context
- The user holds information the agent does not (e.g., "Is this a source or a model?")
- The decision involves tradeoffs that only the user should make

---

## Category D: Blocked (Not Fixable in Project)

**Requires Fusion updates — NOT fixable in user code.**

These errors cannot be addressed by modifying the user's project. They originate from gaps in the Fusion engine.

When an error is Category D, mark it as blocked, explain the reason, link the GitHub issue, and propose alternative approaches while clearly describing the risks. Let the user decide whether to apply a workaround or wait for the Fusion fix.

### Sub-patterns

| Sub-pattern | Signal | Message | Action |
|-------------|--------|---------|--------|
| Fusion engine gaps | MiniJinja filter differences, parser gaps, missing implementations, wrong materialization dispatch | "This requires a Fusion update (tracked in issue #XXXX)" | Search GitHub issues, link if found. Suggest alternatives with risk descriptions. |
| Known GitHub issues | Incremental models with `on_schema_change='sync_all_columns'`, unsupported macro patterns, adapter-specific gaps | "Known limitation — tracked in issue #XXXX" | Link issue, check if closed (suggest Fusion upgrade). Suggest alternatives with risk descriptions. |
| Engine crashes | `panic!`, `internal error`, `RUST_BACKTRACE`, `not yet implemented` | "This is a Fusion engine crash/missing implementation" | Document and report. Suggest alternatives if possible, with clear risk descriptions. |

### When to use Category D
- The error originates from a Fusion engine gap, not user code
- No direct fix is available in the user's project — the root cause requires a Fusion update
- The error involves internal dispatch, materialization routing, or adapter methods
- Workarounds may exist but carry risks (fragility, breakage on future Fusion updates) — suggest them with clear risk descriptions and let the user decide

### GitHub issue search
When a Fusion bug is suspected:
1. Search: `site:github.com/dbt-labs/dbt-fusion/issues <error_code> <keywords>`
2. If an open issue exists: Link it and explain its status
3. If it is closed: Recommend updating the Fusion version
4. If no issue is found: Document the error pattern for the user to report
