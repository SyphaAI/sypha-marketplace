# Reload-Fix Patterns

Reload feedback from Qlik generally falls into one of five finding types. Each has a corresponding diagnosis and fix pattern. Use this file as a triage guide when a user reports a reload error or unexpected post-load behavior.

## Finding Type 1: Reload Failure (Syntax Error)

The reload failed at a specific line — almost always due to SQL-syntax intrusion or a dollar-sign-expansion comma violation.

1. Identify the exact line that triggered the error.
2. Check it against the SQL-constructs list in `references/sql-constructs.md` and the five adjacent failure modes (`NoConcatenate`, `Count()` argument requirements, `QUALIFY` with prefixed fields, `DROP TABLE` discipline, `NullAsValue` scope).
3. For a dollar-sign expansion comma violation, rewrite the variable-function call inline per SKILL.md § 3.
4. For `HAVING` / `Count(*)` / `CASE WHEN` / `IN (list)` / `IS NULL` / `BETWEEN` / `LIMIT`, rewrite using the Qlik equivalents (see SKILL.md § 1).
5. For a missing `NoConcatenate` or `DROP TABLE`, add the required statement.
6. Report the fix with a reference to the constraint that was violated.

## Finding Type 2: Synthetic Key Detected

Qlik created a `$Syn` synthetic key table because two or more tables share more than one field name. The conceptual treatment — what synthetic keys are, why Qlik creates one, the three prevention mechanisms, common triggers, and the QUALIFY failure modes — is in `qlik-data-modeling` → `references/anti-patterns.md` #1 and #4. Script-level fix flow:

1. Identify which tables share the unintended field name(s) that caused the association.
2. Check whether `QUALIFY` is applied to already-prefixed fields (this causes double-prefixing; see anti-patterns.md #4).
3. Check whether a non-key field appears in multiple tables (e.g., `source_system`, `load_date`).
4. Check whether `NullAsValue` on a key field is generating phantom associations.
5. If the field should be removed, add `DROP FIELD` before storing QVDs.
6. If `QUALIFY` caused double-prefixing, remove `QUALIFY`.
7. If the field needs different names in different tables, update the LOAD aliases accordingly.
8. Escalate as a data-model design question when the root cause is structural, not implementation-level.

## Finding Type 3: Data Quality Issues Post-Load

The reload succeeded but the data looks wrong — high null rates, duplicates, unexpected aggregations, or unexpected row counts.

1. Run diagnostic queries from `diagnostic-patterns.md` (sibling reference file) to isolate the issue.
2. Trace the affected value back through the transform layer.
3. High null rate in a key field? The source may be incomplete — escalate as a data question.
4. Duplicates in a key field? Verify deduplication logic (`DISTINCT`, `WHERE NOT EXISTS`).
5. Unexpected type (text where a number is expected)? Check for string functions applied to numeric fields.
6. Row count dropped unexpectedly? Verify that `JOIN` logic did not eliminate valid rows (consider using `LEFT KEEP`).
7. Re-run the diagnostic to confirm the fix resolved the issue.

## Finding Type 4: Field Type Coercion

A field is being treated as the wrong type — string aggregations on what should be a numeric field, dates not sorting correctly, or booleans not filterable.

1. Identify the affected field and the table it belongs to.
2. Check whether the source is performing a cast (SQL `CAST` or string concatenation during extraction).
3. Check whether a string function is being applied to a numeric field.
4. Check whether date parsing (`Date#`) is absent.
5. Check whether `Dual()` is needed for boolean fields that carry text labels.
6. Apply the appropriate conversion function at load time (`Num#`, `Date#`, `Dual`) using the correct format string.

## Finding Type 5: Incremental Load Issues

Incremental loads are missing rows, double-loading rows, or failing to pick up changes.

1. Verify that the last-execution timestamp or delta marker is being persisted (see `incremental-load-patterns.md`).
2. Verify that the `WHERE` clause references the correct timestamp column and uses the right comparison operator (`>=` rather than just `>` — `>` excludes rows that arrived during the prior run's execution window).
3. Verify that the incremental source load uses the same key and field structure as the full reload.
4. Verify that the `CONCATENATE` into the persistent table is not paired with `NoConcatenate` (which would produce a separate table instead of appending).
5. Run a full reload to reset state, then re-test the incremental path.

## Cross-References

- SQL-construct rewrites: `sql-constructs.md` (sibling reference file)
- Synthetic key diagnosis: `qlik-data-modeling` → `references/anti-patterns.md`
- Diagnostic queries: `diagnostic-patterns.md` (sibling reference file — post-load validation templates)
- Incremental load patterns: `incremental-load-patterns.md` (sibling reference file)
- Null handling: `null-handling.md` (sibling reference file)
