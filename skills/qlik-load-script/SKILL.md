---
name: qlik-load-script
description: >-
  Script syntax reference, QVD optimization, incremental load patterns
  (insert-only, insert/update, insert/update/delete, dual-timestamp for SCD2),
  JOIN/KEEP prefixes, ApplyMap patterns, CROSSTABLE, master calendar generation,
  variable definitions, error handling, logging patterns, null handling
  patterns, diagnostic and validation patterns, subroutine integration, and
  platform gotchas (SET vs LET, dollar-sign expansion timing, SET variable comma
  limitation). Load when writing, reviewing, or debugging Qlik load scripts, QVD
  operations, STORE/LOAD syntax, preceding LOAD, NullAsValue, script
  organization, JOIN, KEEP, ApplyMap, CROSSTABLE, AutoNumber, composite keys, or
  data quality defensive coding.
metadata:
  upstream:
    user-invocable: false
  category: data
  source:
    repository: 'https://github.com/Pupfish-LLC/qlik-toolkit'
    path: skills/qlik-load-script
    license_path: LICENSE
    commit: 2060bc2f278b73751f55ad9f8d569c45c1b2a5ff
---

# Qlik Load Script

Qlik script resembles SQL on the surface but is a fundamentally distinct language. It executes inside the Qlik associative engine, not a relational database. The most important rule: **Qlik script is NOT SQL.** The most predictable failure mode for AI-generated scripts is SQL syntax appearing inside LOAD statements. Before authoring any LOAD statement, internalize Section 1 below. Before writing any variable function, internalize Section 3.

This skill addresses script mechanics, QVD operations, incremental loads, null handling, error handling, diagnostics, variable patterns, master calendar, and subroutine integration. It does NOT cover naming conventions (see `qlik-naming-conventions`), data model design (see `qlik-data-modeling`), expression syntax (see `qlik-expressions`), or optimization strategies (see `qlik-performance`).

## 1. Script Generation Constraints (CRITICAL)

These SQL constructs do NOT exist in Qlik LOAD statements. Using them causes reload errors or silent failures.

| SQL Syntax | Why It Fails | Qlik Alternative |
|---|---|---|
| `HAVING` | Not a keyword in Qlik script | Preceding LOAD with `WHERE` on aggregated field |
| `Count(*)` | No wildcard aggregation | `Count(field_name)` with explicit field |
| `SELECT DISTINCT` | SELECT is for SQL pass-through only | `LOAD DISTINCT` |
| `IS NULL` / `IS NOT NULL` | Operator syntax not supported | `IsNull(field)` / `NOT IsNull(field)` |
| `BETWEEN` | Not a keyword | `field >= low AND field <= high` |
| `IN (list)` | Not supported | `Match(field, v1, v2)` or `WildMatch()` |
| `CASE WHEN` | Not a keyword | `IF()`, `Pick()`, or `Match()` |
| `LIMIT` | Not a keyword | `FIRST n LOAD ...` prefix (works on any source); `WHERE RecNo() <= N` as a fallback |
| Table aliases (`FROM t1`) | Not supported in LOAD | Full table names in brackets |
| `WITH ... AS (...)` (CTE) | No CTE syntax in LOAD/RESIDENT | Sequential LOADs into named tables, then RESIDENT downstream; DROP the intermediates |
| `ROW_NUMBER() OVER (...)` | No window functions in LOAD/RESIDENT | `RowNo()` with `ORDER BY` in a RESIDENT load; or `AutoNumber()` over a `GROUP BY` partition key |
| `LAG()` / `LEAD()` | No window functions in LOAD/RESIDENT | `Previous(field)` for the prior row; `Peek(field, row, table)` for arbitrary offsets |
| `UNION` / `UNION ALL` | Not a keyword | `CONCATENATE([Target])` prefix; auto-concatenates when field sets fully match |
| `EXCEPT` / `INTERSECT` | Not keywords | `WHERE NOT EXISTS(aliased_key, source_key)` (except) / `WHERE EXISTS(...)` (intersect) with an aliased lookup table |
| `MERGE INTO` (SQL upsert) | Not LOAD/RESIDENT syntax; Qlik's `MERGE` prefix is for partial reloads only | `CONCATENATE` new rows + dedup with `WHERE NOT EXISTS`; or the `MERGE` partial-reload prefix (see `references/incremental-load-patterns.md`) |
| `LATERAL` / `CROSS APPLY` | No equivalent in LOAD/RESIDENT | Refactor at the `SQL SELECT` pass-through layer, or expand inline with `SubField` + `IterNo()` for row-multiplying delimited strings |

**Exception:** `SQL SELECT` pass-through statements targeting database connections CAN use native SQL syntax, including all constructs listed above. This restriction applies only to LOAD/RESIDENT operations.

**Dollar-sign expansion safety:** Every `$(variable(...))` call must be reviewed for commas in its arguments. Within `$()`, commas act as parameter delimiters, not expression argument separators. Refer to Section 3 for the complete rules and examples.

**Deeper reference:** see `references/sql-constructs.md` for each construct's full failure mode, worked-example rewrites of the SQL→Qlik conversion, the `SQL SELECT` pass-through exception with examples, and the five most common adjacent failure modes (`NoConcatenate`, `Count()` argument requirements, `QUALIFY` with prefixed fields, `DROP TABLE` discipline, `NullAsValue` scope).

### QUALIFY/UNQUALIFY

`QUALIFY` prepends field names with their table name to avoid unintended associations. Aliasing fields with `AS` directly in the LOAD statement is equally effective and usually easier to follow. `QUALIFY` is a stateful toggle that remains active across tabs until explicitly reset. Failure modes (double-prefix when combined with manual prefixing, missing UNQUALIFY creating data islands, persistent state polluting later tabs) and the "pick one prefixing discipline" rule are covered in `qlik-data-modeling` → `references/anti-patterns.md` #4. Syntax details with worked examples appear in `references/sql-constructs.md` Section 2.3.

## 2. SET vs LET

`SET` stores the right-hand side as literal text (a template that is re-evaluated each time it is referenced). `LET` evaluates the right-hand side once at script-load time and stores the resulting value.

**Rule:** Use `SET` for expression templates, variable functions with `$1` placeholders, and anything consumed in chart expressions. Use `LET` for values required as literals later in the script (row counts, FOR-loop bounds, incremental-load timestamps).

**Critical script gotcha:** `SET` does not evaluate function calls on its right side. `SET HidePrefix=Chr(37);` stores the literal string `Chr(37)`, not `%`. Use `LET HidePrefix=Chr(37);` (which evaluates to `%`) or `SET HidePrefix='%';` (direct literal). This applies to all function calls to the right of SET (`Chr()`, `Num()`, `Date()`, `Today()`, `Time()`, etc.).

See `qlik-expressions/references/variable-rules.md` Section 1 for the complete decision criteria, LET evaluation semantics, the dynamic-UI rule, and worked examples.

## 3. Dollar-Sign Expansion

Inside `$()`, commas serve as parameter delimiters — not as expression argument separators. Supplying a comma-containing expression (`ApplyMap`, `IF`, `PurgeChar`, `Concat`) as an argument to a variable function will break the call, because the engine splits on the inner commas. The rule: pass only simple field references or literals to variable functions; write comma-containing logic inline and annotate it with a comment.

See `qlik-expressions/references/variable-rules.md` Section 2 for full coverage — the comma-trap mechanism, the list of functions that commonly trigger it, a wrong/right worked example, and the rare `Chr(44)` workaround.

**Script-context null variable expansion:** When a `LET` assignment evaluates to null, the variable becomes empty. `IF $(emptyVar) >= 0 THEN` expands to `IF >= 0 THEN` — a syntax error. Defend against this at assignment time with a default: `LET vX = Alt(NoOfRows('MaybeGone'), -1);` or validate before expansion: `IF '$(vX)' <> '' AND $(vX) >= 0 THEN`. This applies to any function capable of returning null (`NoOfRows` on dropped or nonexistent tables, `Peek` past the end of a table, `FieldValue` out of range, etc.).

## 4. Preceding LOAD

Two LOAD statements that share a single source. The inner (bottom) LOAD runs first. The outer (top) LOAD reads its output and can reference any fields computed by the inner — meaning a complex expression only needs to be written once.

```qlik
[Customers]:
LOAD
    *,
    IF([Customer.TenureYears] < 1, 'New', 'Returning') AS [Customer.TenureBand]
;
LOAD
    customer_id AS [Customer.Key],
    customer_name AS [Customer.Name],
    registration_date,
    Floor((Today() - registration_date) / 365.25) AS [Customer.TenureYears]
FROM [lib://QVDs/Customers.qvd] (qvd);
```

The bottom LOAD reads from the QVD and calculates `[Age]`. The top LOAD processes those rows and uses `[Age]` to derive `[Age.Category]`. Only one table (`[Customers]`) is produced. This same pattern works with `RESIDENT`, `INLINE`, and `SQL SELECT` sources.

**When to use:** Avoid duplicating the same complex expression across nested IFs. Compute it once in the inner LOAD and reference the result in the outer. This is also the Qlik substitute for `HAVING`: aggregate in the inner LOAD, then filter on the aggregated field in the outer LOAD using `WHERE`.

## 5. Date/Number Interpretation

Qlik stores every value as a **dual**: a text representation and a numeric representation bundled together. Dates are held as serial numbers (days since 1899-12-30). Understanding this dual nature is essential for avoiding the most common date-related bugs.

**`Date#()` vs `Date()`:** `Date#(string, 'format')` parses a text string into its numeric serial value. `Date(serial, 'format')` formats a numeric serial into a display string. Mixing them up is the number-one date bug.

```qlik
// Interpreting a text date from source:
Date#(ship_date, 'MM/DD/YYYY') AS [Order.ShipDate]

// Formatting an already-numeric date for display:
Date(Floor(order_timestamp), 'YYYY-MM-DD') AS [Order.Date]
```

**SET DateFormat dependency:** `Date#()` called without a format argument falls back to the app's `SET DateFormat`. If source dates use a different format from the app default, you MUST supply the format string explicitly. Silent misinterpretation will produce incorrect dates without raising any error.

**Num#() and Num():** The same distinction applies. `Num#(string, 'format')` parses text to a number. `Num(number, 'format')` formats a number for display. For monetary values: `Num#(revenue, '#,##0.00')`.

## 6. Null Handling (Summary)

Three strategies exist, each addressing a distinct null shape:

| Field Type | Null Shape | Strategy |
|---|---|---|
| String dimensions from external sources | String-encoded (`"null"`, `"NaN"`, `"n/a"`) — `IsNull()` does NOT catch these | `vCleanNull` |
| Sparse dimensions for filter pane display | Genuine SQL NULL | `NullAsValue` (with reset) |
| Date/numeric calculations | Genuine NULL plus non-NULL sentinel dates (`1900-01-01`, epoch zero) | Explicit `IsNull` + range guards |
| Key fields | Any null | **Never mask** — surface as data quality issue |

`NullAsValue` is field-specific and stateful — it persists until explicitly reset with `NullAsNull *;` + `SET NullValue =;`. Never apply it to key fields (the substituted string creates phantom associations) or to measure fields (it breaks `Sum`/`Avg`).

For date arithmetic, the real danger is non-NULL sentinels (source systems substituting `1900-01-01` for "unknown"), not genuine NULLs — genuine NULLs propagate to NULL correctly. Guard against both cases: `IF(IsNull(d) OR d < MakeDate(1901,1,2) OR d > Today(), Null(), ...)`.

Full treatment — `Null()` / `IsNull()` / `NullCount()` constructors, the `vCleanNull` variable function with comma-trap workarounds, the `NullAsValue` scope-management pattern, the key-field NULL phantom-association risk, date-arithmetic sentinel guards, and the layered defensive-coding strategy — is in `references/null-handling.md`. For null handling in expressions (`Alt`, `Coalesce`, `RangeSum`, division guards), see `qlik-expressions` SKILL.md Section 9.

## 7. Data-Driven Patterns

**Range bucketing via mapping expansion (`ApplyMap`):** suitable for **static, enumerable, integer** buckets applied globally (age bands, score ranges, star ratings). Uses an inline table with `WHILE IterNo()` expansion plus `ApplyMap`. To change buckets, update the inline table.

```qlik
[_Def]: LOAD * INLINE [from, to, label, sort
0,  17, 0-17,  1
18, 24, 18-24, 2
65, 200, 65+,  7] (delimiter is ',');

_Map: MAPPING LOAD Num#(from) + IterNo() - 1, Dual(Trim(label), Num#(sort))
RESIDENT [_Def] WHILE Num#(from) + IterNo() - 1 <= Num#(to);
DROP TABLE [_Def];

ApplyMap('_Map', [Age], Dual('Unknown', 0)) AS [Age.Group]
```

**IntervalMatch prefix:** suited for **data-driven, per-entity, or time-varying** intervals — SCD2 effective-dating, DV2 satellite point-in-time, version history, per-line tier definitions. Available in one-key and N-key forms (up to 5 additional key fields); supports overlapping intervals; produces a `$Syn` by construction (resolve with `LEFT JOIN` + `DROP TABLE` of the IntervalMatch output). Quick decision guide: if the interval table changes per entity or over time, use `IntervalMatch`; if it is a static global reference list, use Range Bucketing. Full syntax, an SCD2 worked example with NULL upper-bound handling, performance notes, and three wrong-choice scenarios are in `references/interval-match.md`.

**Boolean fields via Dual:** `Dual('Active', 1)` makes a field support both text display and numeric aggregation (`Sum([Is.Active])` = count of active records). Encapsulate in a SET variable function for reuse. See `script-templates/clean-null-function.qvs` for vDualBool.

**Metadata-driven table loading:** Define an inline metadata table (TableName, SourceTable, PrimaryKey, Enabled) and iterate over it using FOR/Peek. To include a new table, simply add a metadata row.

```qlik
FOR i = 0 TO NoOfRows('_Metadata') - 1
    LET vTableName = Peek('TableName', $(i), '_Metadata');
    LET vEnabled   = Peek('Enabled', $(i), '_Metadata');
    IF '$(vEnabled)' = 'Y' THEN
        [$(vTableName)]:
        LOAD * FROM [lib://Connection/$(vTableName).qvd] (qvd);
    END IF
NEXT i
```

**Concat-and-Peek for UI-variable build:** Materialize a delimited string (typically `|`-separated tokens) once at reload and expose it via a variable. The common consumer is the Dashboard Bundle Variable Input control, whose Dynamic values mode parses a pipe-delimited string rather than enumerating a field — a bare field reference in that control collapses to one scalar.

```qlik
[_PipeBuild]:
LOAD Concat([Code] & '~' & [Label], '|') AS pipe RESIDENT [Menu];
LET vPipe = Peek('pipe', 0, '_PipeBuild');
DROP TABLE [_PipeBuild];
```

On the UI side, consume it via dollar-sign expansion (`='$(vPipe)'`). This technique extends beyond Variable Input — any UI control or set-analysis clause that requires a delimited string of distinct values can use this pattern. See `qlik-visualization` → `references/variable-input-control.md` for the full UI consumption walkthrough, including value-label form and chart-side double-dollar dereferencing.

## 8. JOIN/KEEP Prefixes (Summary)

JOIN and KEEP both combine two tables. **Critical difference from SQL:** Qlik joins on ALL fields whose names match across the two tables, not only the field you intended as a key. Unintended field-name overlaps silently produce wrong results — for example, a `Status` field present in both Customers and Orders will cause a LEFT JOIN to discard every order whose Status does not match its customer's Status, with no error raised.

**The rule:** Before any JOIN, enumerate the fields in both tables and alias every non-key field that has a shared name. Do not rely on Qlik to infer the intended join key.

**JOIN vs KEEP:** JOIN merges both tables into one; KEEP restricts both tables to matching rows but retains them as separate tables in the data model. **Row multiplication:** when the join key is not unique on both sides, rows multiply (a 1000-row fact table × a 3-per-key lookup = 3000 rows). **Decision:** use JOIN for small lookups with unique keys; use ApplyMap for large lookups or when a default value for unmatched keys is required (Section 9); let the associative engine handle dimension-to-fact relationships naturally. See `qlik-performance` for JOIN vs ApplyMap benchmarks.

Full reference: `references/join-keep-patterns.md` (silent-collision worked example with WRONG/RIGHT side-by-side, LEFT/INNER JOIN syntax with RESIDENT, JOIN vs KEEP semantics, row multiplication, decision framework).

## 9. ApplyMap Patterns

ApplyMap executes a key-value lookup against a mapping table. It is faster than JOIN for large datasets and safer (no row multiplication, and it provides a default value for unmatched keys).

```qlik
// Create mapping table (two-column: key, value):
[_RegionMap]: MAPPING LOAD [%Customer.Key], [Customer.Region]
RESIDENT [Customers];

// Apply in a LOAD statement:
ApplyMap('_RegionMap', [%Customer.Key], 'Unknown') AS [Customer.Region]
```

**Critical gotcha -- never alias the result with the same name as the lookup field:**

```qlik
// WRONG -- silently replaces the code with the mapped name:
LOAD
    OrderID,
    ApplyMap('_RegionMap', RegionCode, 'Unknown') AS RegionCode  // BUG
FROM ...;
// Result: RegionCode column now contains 'North America', 'Europe', etc.
// The original codes are permanently lost. Any downstream table or
// association that still expects codes in RegionCode is now broken.

// RIGHT -- alias the result to a distinct name:
LOAD
    OrderID,
    RegionCode,                                                    // keep the code
    ApplyMap('_RegionMap', RegionCode, 'Unknown') AS [Region.Name] // add the label
FROM ...;
```

The Qlik script engine does not raise an error for the broken form. Both the input field and the ApplyMap output resolve to the same name, and the ApplyMap result takes precedence — silently overwriting the raw code values. Always assign the ApplyMap output a distinct alias (typically using a `.Name` or `.Label` suffix) to preserve the original key field.

**MAP...USING vs ApplyMap:** `MAP...USING` automatically applies a mapping to every subsequent LOAD of the named field. `ApplyMap` is explicit and per-expression. Prefer ApplyMap for clarity; reserve MAP...USING for global, uniform field translations (e.g., converting a country code to a country name everywhere). See `qlik-performance` for ApplyMap optimization guidance on large datasets.

## 10. QVD Operations (Summary)

Three principles to absorb before writing QVD reads:

1. **STORE writes one table per statement:** `STORE * FROM [TableName] INTO [lib://Connection/file.qvd] (qvd);`. There is no append mode — for incremental output, see `references/incremental-load-patterns.md`.
2. **Optimized read** is preserved by `LOAD *`, field subsetting, `AS` renaming, `LOAD DISTINCT`, `CONCATENATE`, and single-parameter `EXISTS(field)` **only when `field` exactly matches a field name stored in the QVD**. It falls back to standard mode for any field transform, derived fields, two-parameter `EXISTS(field, expression)`, WHERE clauses other than single-parameter EXISTS, single-parameter EXISTS where the field name does not match the QVD's stored name (e.g., the current load has aliased it), or `MAP ... USING`. Common misconception: field renaming and reordering do NOT break optimized read.
3. **Read each QVD from disk exactly once.** Load to a temporary table, serve all downstream maps and tables from RESIDENT, then DROP the temporary table.

`binary [app];` is a separate mechanism for duplicating an entire data model — it must be the first statement in the script, only one is permitted per script, and it loads data and section access only.

Full reference: `references/qvd-operations.md` (STORE, optimized vs standard rules with worked examples, NoConcatenate around QVD loads, multi-QVD concatenation, file-list patterns, partial reload prefixes, binary load). Decision guidance — when to optimize, when to layer, when to adopt a generator/consumer architecture — is in `qlik-performance`.

## 11. Incremental Load Patterns (Summary)

| Source Pattern | Strategy | Key Requirement |
|---|---|---|
| Append-only transactions | Insert-only (by timestamp/key) | Monotonic key or reliable timestamp |
| Mutable dimension (SCD1) | Insert/update (by ModifiedDate) | Reliable modification timestamp |
| Full-refresh staging | Full replace each cycle | None |
| SCD Type 2 dimension | **Dual-timestamp** (effective_from + effective_to) | Both timestamps tracked |
| Mutable with deletes | Insert/update/delete | Change detection + deletion flag or full-key comparison |

**Critical:** The dual-timestamp SCD Type 2 pattern must capture BOTH newly created records AND records whose effective_to has changed (previously current records that have now been closed). Omitting the closure condition results in silent data loss. See `references/incremental-load-patterns.md` for complete working code and `script-templates/dual-timestamp-incremental.qvs` for the ready-to-use template.

## 12. Master Calendar

A master calendar supplies a continuous date dimension enriched with custom periods (fiscal year, relative date flags). Date ranges must be derived from the loaded data — never hard-coded. Custom period labels (quarter, fiscal quarter, year-month, year-week) must be wrapped in `Dual()` so they sort chronologically while still displaying as readable text.

**Dual() for chronological sort — when it is and is not needed:**

`Month()`, `MonthName()`, and `WeekDay()` **already return Dual values** per help.qlik.com — the text component is the month/day name and the numeric component is the underlying integer (or, for `MonthName()`, the serial number of the month start). They sort numerically in charts despite appearing as text. Wrapping them in `Dual(..., Num(...))` is redundant and inflates the symbol table by storing each text/number pair as a new dual instead of reusing the engine's built-in dual.

References:
- Month: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/DateAndTimeFunctions/month.htm
- MonthName: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/DateAndTimeFunctions/monthname.htm
- WeekDay: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/DateAndTimeFunctions/weekday.htm

```qlik
// CORRECT -- Month() is already Dual; sorts as 1-12, displays as "Jan", "Feb":
Month([Order.Date])     AS [Calendar.Month]

// REDUNDANT -- wrapping a built-in Dual in Dual() wastes symbol-table memory:
Dual(Month([Order.Date]), Num(Month([Order.Date])))   AS [Calendar.Month]
```

`Dual()` IS required for **derived labels** built by string concatenation, because the concatenation result is plain text with no underlying numeric component. Add the numeric sort key explicitly:

```qlik
// Quarter label -- 'Q' & ... is plain text, needs Dual for numeric sort:
Dual('Q' & Ceil(Month([Order.Date])/3), Ceil(Month([Order.Date])/3))   AS [Calendar.Quarter]

// Year-month label -- the formatted text sorts lexically; pair with a numeric key:
Dual(Date(MonthStart([Order.Date]), 'YYYY-MM'),
     Year([Order.Date]) * 100 + Month([Order.Date]))   AS [Calendar.YearMonth]

// Fiscal quarter label -- hand-built text with no numeric component:
Dual('FY' & vFY & '-Q' & vFQ, vFY * 10 + vFQ)   AS [Calendar.FiscalYearQuarter]
```

The rule: when a value comes directly from `Month()`, `MonthName()`, or `WeekDay()`, leave it as-is. When a value is assembled using `&`, `Date(..., 'format')`, or any other string-producing expression, wrap it in `Dual(text, numeric_sort_key)`.

**Fiscal year configuration:** Set `vFiscalYearStartMonth` (e.g., 7 for a July start). The template calculates the year offset automatically: FY2026 spans Jul 2025 - Jun 2026 when start=7.

**Multiple date fields:** When the model includes Order.Date, Ship.Date, and Invoice.Date, select one primary date as the calendar key. Filter on other dates via set analysis. Alternatively, build separate calendar tables with prefixed fields (OrderCal.Year, ShipCal.Year) to support direct filtering on any date dimension.

**Relative date flags:** The template provides IsCurrentMonth, IsCurrentYear, IsPriorYear, IsYTD, IsPriorYTD, IsRolling12, and IsToday. These flags enable period-over-period comparisons without requiring set analysis.

See `script-templates/master-calendar.qvs` for the production-ready template.

## 13. Error Handling and Logging

Use `TRACE` for milestone logging, `ScriptError` vs `ScriptErrorCount` for error tracking, and `ErrorMode` for halt-vs-continue behavior. The most critical pitfall is confusing `ScriptError` (resets after every successful statement; reflects only the most recent statement) with `ScriptErrorCount` (cumulative across the entire reload) — to guard against errors spanning multiple operations, snapshot `ScriptErrorCount` before the operation and compare it afterwards. The second most common surprise: a bare `;` inside an unquoted TRACE message terminates the statement prematurely — use periods or dashes as in-text separators, or enclose the entire message in quotes.

Full reference: `references/error-handling.md` (TRACE semicolon trap, ScriptError vs ScriptErrorCount snapshot pattern, ErrorMode 0/1/2 semantics, file-existence guards via FileTime, field-value inspection patterns, and the relationship between the `error-handling.qvs` framework and `references/diagnostic-patterns.md`).

## 14. NoConcatenate and Auto-Concatenation

Two distinct outcomes arise when a new LOAD shares field names with an existing table:

- **Full match (identical names AND identical field count) → silent auto-concatenation.** The new rows are appended into the existing table and the new table name is never registered: `NoOfRows('NewTable')` returns NULL and `DROP TABLE [NewTable]` fails. This behavior also applies to `LOAD * INLINE` blocks with matching columns and to RESIDENT loads that mirror their source.
- **Partial overlap (some shared names but a different field count) → NOT auto-concatenated.** Qlik keeps the tables separate and issues a "tables ... cannot be concatenated implicitly" warning. The shared field names then form unintended associations: a single shared field links the tables (often catching the developer off guard), and two or more shared fields produce a `$Syn` synthetic key. See `qlik-data-modeling` `references/anti-patterns.md` #5 (Multiple Shared Fields Between Two Tables) for the synthetic-key resolution triggered by this field-count mismatch.

The fundamental NoConcatenate pattern, the INLINE auto-concat trap, the explicit `CONCATENATE([TargetTable])` prefix (which forces concatenation regardless of differing field sets), and the QVD-specific application are covered in `references/sql-constructs.md` Section 2.1 and `references/qvd-operations.md` (NoConcatenate Around QVD Loads, Multi-QVD Concatenation).

Reference: help.qlik.com Cloud — [Concatenate](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptPrefixes/Concatenate.htm) and [NoConcatenate](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptPrefixes/NoConcatenate.htm).

**Mapping LOAD tables persist until script end and are invisible to meta-functions.** Tables created via `Mapping LOAD` stay in memory for the full duration of the script run — they are NOT automatically dropped when `ApplyMap()` consumes them. To release a mapping table before the script ends, use `DROP MAPPING TABLE [MappingTableName];` (the `MAPPING` keyword is mandatory; plain `DROP TABLE` does not work on mapping tables). See help.qlik.com — [Drop Table](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptRegularStatements/Drop_Table.htm). While active, mapping tables are invisible to the associative engine's data model: `NoOfRows('MappingTableName')`, `FieldValueCount()`, `FieldName()`, and all other table/field meta-functions return null or -1 for mapping tables. Validate indirectly by inspecting the row count of the downstream table that consumes the mapping (e.g., if the target table loads 0 rows, the mapping was likely empty or misconfigured).

## 15. EXISTS Symbol Space Behavior

`EXISTS(field, value)` evaluates against the **entire symbol space** (every table containing that field name), not a single table. This includes values loaded during the current statement.

**Cross-table contamination:** If `[Dimension]`, `[_TempA]`, and `[_TempB]` all contain `key_field`, then `WHERE NOT EXISTS(key_field)` checks all three simultaneously. This leads to unexpected zero-row results.

**Self-referencing dedup (documented gotcha):** The one-parameter form `WHERE NOT EXISTS(field)` checks values already loaded **within the current LOAD statement**, not only previously loaded tables. The symbol table is updated row by row as the load runs. As soon as a value loads, it becomes "existing." The next row carrying the same value is treated as already existing and is skipped. Result: only the **first occurrence** of each value is loaded. This is deliberate Qlik behavior but is frequently unintentional for the developer.

```qlik
// Only loads ONE row per customer_id, even if source has duplicates:
LOAD * FROM [lib://QVDs/Orders.qvd] (qvd)
WHERE NOT EXISTS(customer_id);

// To load ALL rows for non-existing keys, alias the lookup field
// so the current load's values don't pollute the check:
[_Existing]:
LOAD DISTINCT customer_id AS _existing_cust RESIDENT [Customers];

LOAD * FROM [lib://QVDs/Orders.qvd] (qvd)
WHERE NOT EXISTS(_existing_cust, customer_id);

DROP TABLE [_Existing];
```

**Workaround for both issues:** Load the lookup field into a dedicated table using a different alias, then apply the two-parameter form: `WHERE NOT EXISTS(aliased_field, source_field)`. This eliminates both self-referencing dedup and cross-table contamination. Note that the two-parameter form forces standard (non-optimized) QVD read mode.

## 16. CROSSTABLE Prefix

CROSSTABLE transposes columnar data into normalized rows. It is commonly used when loading Excel pivot tables or wide-format source data.

```qlik
// Source has: Product, Jan, Feb, Mar (with sales values in month columns)
// Result: Product, Month, Sales (one row per product-month combination)
CROSSTABLE(Month, Sales, 1)
LOAD * FROM [lib://Data/SalesPivot.xlsx] (ooxml, embedded labels, table is Sheet1);
```

**Syntax:** `CROSSTABLE(AttributeField, DataField, NoOfQualifyingFields)`. The third parameter defines how many left-side columns to retain unchanged (the qualifying columns). All remaining columns are converted into attribute-value pairs. For a source with `Region, Product, Jan, Feb, Mar`, use `NoOfQualifyingFields = 2` to keep Region and Product as row identifiers.

## 17. AutoNumber and Composite Keys

**Composite key pattern:** Concatenate multiple fields using a delimiter to form a synthetic key. Choose a delimiter that cannot appear in the data values.

```qlik
[%Region.Product.Key]: [Region] & '|' & [Product] AS [%Region.Product.Key]
```

**AutoNumber:** Substitutes a field's values with sequential integers to reduce memory usage. This shrinks RAM consumption by removing long string keys from the symbol table.

```qlik
AutoNumber([%Region.Product.Key], '%Region.Product.Key');
```

**Critical warning:** AutoNumber assignment depends on load order. Per help.qlik.com: "You can only connect autonumber keys that have been generated in the same data load, as the integer is generated according to the order the table is read." Consequences:
- The same business value will receive a different integer if the load order changes (added/removed source rows, changed sort order, different reload sequence).
- AutoNumber values are NOT stable across apps or between reloads. Never use them as persistent identifiers, foreign keys to other apps, or in inter-app data exchange.
- When stable keys are required across reloads or apps, use `Hash128`/`Hash160`/`Hash256` on the business key instead — Qlik help explicitly recommends this approach.

**Community best practice:** Apply AutoNumber only in the final app-level model load, never in the QVD extraction layer. The rationale is twofold: (1) extracted QVDs may be read by multiple downstream apps, each of which would assign its own unrelated integers to the same business values, breaking associations; and (2) AutoNumber inside a LOAD FROM QVD forces standard (non-optimized) read mode, undermining the purpose of the extraction layer. This is well-established expert guidance (Rob Wunderlich, Henric Cronström) rather than a Tier-1 documented rule, but the underlying mechanisms are both documented.

## 18. Subroutine Integration

`$(Must_Include=lib://Connection/path/file.qvs);` causes the reload to fail if the file is missing; `$(Include=...)` silently skips it. `CALL SubName(param1, param2);` invokes the subroutine after the include.

**Critical scoping rule:** `LET`/`SET` statements inside a SUB create GLOBAL variables that outlive the subroutine — they will overwrite any caller variables with the same name. Only the SUB's formal parameter list is locally scoped. A bare `LET` inside a SUB leaks state back to the caller. Pass anything that must not leak through the parameter list; use naming prefixes (`vSub_MySub_Counter`) for variables that are intentionally global.

Two distinct behaviors govern formal parameters (per help.qlik.com Sub..End Sub): (1) **Extra formal parameters that have no matching actual argument** are initialized to NULL at SUB entry and are truly local — their value is discarded at `END SUB`. Use these as pure local working variables. (2) **Formal parameters whose corresponding actual argument is a variable name** follow **copy-out semantics** — the parameter's value at `END SUB` is written back to the caller's variable. This allows a SUB to return computed results to the caller via its parameter list; in this case, the parameter is NOT purely local.

Full reference: `references/subroutine-patterns.md` (Must_Include vs Include, CALL syntax, variable scoping rules with worked example, FOR EACH file/value iteration with Cloud wildcard caveat, phantom field detection after subroutine return, composite key concatenate-before/split-after workaround).

## 19. Synthetic Keys

Synthetic key concepts (what they are, how Qlik detects them, prevention mechanisms, common triggers, and worked fix examples) along with the QUALIFY failure modes are covered in `qlik-data-modeling` → `references/anti-patterns.md` #1 and #4. Script-level resolution: rename overlapping non-key fields using `AS` aliases at load time, use `DROP FIELDS` to remove unwanted metadata fields before storing QVDs, or apply QUALIFY/UNQUALIFY (Section 1) to un-prefixed wildcard loads.

## 20. LIB CONNECT TO

`LIB CONNECT TO [ConnectionName];` directs subsequent `SQL SELECT` statements to a specific data connection. Without this statement, SQL targets whichever connection was last active.

```qlik
LIB CONNECT TO [lib://SourceDB];
SQL SELECT * FROM customers;
```

**lib:// path format:** All file and connection references in Qlik Sense/Cloud require the `lib://` prefix. Use `FROM [lib://DataFiles/data.csv]` for files. The connection name in brackets must match the data connection name exactly (case-sensitive in Cloud).

**Cloud space-aware prefix:** In Qlik Cloud shared or managed spaces, the **space name precedes the colon** and the **connection name follows it**:

```qlik
// Correct Qlik Cloud space-aware syntax:
LOAD * FROM [lib://SalesSpace:DataFiles/orders.csv] (txt, delimiter is ',', embedded labels);
LIB CONNECT TO 'SalesSpace:OperationalDB';
```

The format is `lib://<SpaceName>:<ConnectionName>/...`. Reversing the order (e.g., `lib://DataFiles:SalesSpace/...`) causes the connection to fail resolution at reload. Personal spaces do not require a prefix; this syntax applies only to shared and managed spaces.

## 21. Script Organization

| Approach | When to Use |
|---|---|
| Tabs (in-app sections) | Simple single-app projects, all code visible in one editor |
| Include files (.qvs) | Multi-app projects, shared code, version control |
| Numeric prefix | `01_Config.qvs`, `02_Extract_SourceA.qvs`, `03_Transform.qvs` |

**Split when** a single tab exceeds approximately 500 lines. Divide by logical function (config, extract per source, transform, model load, calendar, diagnostics).

**Script execution manifest:** A reference file documenting each script file, its purpose, its dependencies, and the required run order.

## 22. Cross-Layer Field Rename Mechanics

Three approaches exist for renaming fields in scripts, ranging from targeted to systematic:

- **Aliasing in LOAD:** `source_field AS [UI.Field.Name]` — use this for per-field transforms during extraction or model load.
- **RENAME FIELD:** `RENAME FIELD old_name TO [New.Name];` — use this for individual post-load renames. **Collision warning:** RENAME FIELD operates on ALL tables that contain the specified field name. If `region` exists in both `[Customers]` and `[Products]`, `RENAME FIELD region TO [Customer.Region]` renames it in both. Use Mapping RENAME or LOAD-time aliasing when table-specific renames are needed.
- **Mapping LOAD + RENAME FIELDS USING** (shorthand: "Mapping RENAME"): Performs bulk renames from a mapping table — two statements working in tandem: a `Mapping LOAD` that constructs the lookup table, and `RENAME FIELDS USING <MapName>;` that applies it. Use for systematic cross-layer renaming (e.g., converting all raw extract names to model-layer names in a single operation). Exhibits the same cross-table behavior as RENAME FIELD, so confirm that source field names are unique across tables before applying.

```qlik
[_RenameMap]: MAPPING LOAD old_name, new_name INLINE [
old_name, new_name
acct_status, Customer.Status
ship_addr_line1, Customer.ShipAddress
] (delimiter is ',');
RENAME FIELDS USING [_RenameMap];
```

Refer to `qlik-naming-conventions` for the naming strategy (which names to apply at each layer).

## 23. Placeholder Logic for Blocked Dependencies

When a source table is unavailable, emit a documented empty table with the expected schema so the pipeline can continue. Every placeholder must document: what it replaces, the expected source, the resolution condition, and a TRACE warning.

```qlik
// PLACEHOLDER: Product loyalty data not yet available
// Source: loyalty_program.product_affinity (via lib://LoyaltyDB)
// Resolves when: Loyalty team delivers API access (ETA: Q2 2026)
TRACE [WARNING] Using placeholder for Product.Loyalty -- source not available;
[ProductLoyalty]:
LOAD * INLINE [
    Product.Key, Loyalty.Tier, Loyalty.Points
] (delimiter is ',');
```

## 24. String Functions

**PurgeChar** removes multiple characters in a single call. It always requires two arguments:
```qlik
// WRONG -- missing second argument:
PurgeChar(my_field)
// RIGHT:
PurgeChar(my_field, '[]{}' & Chr(34))
```

**SubField + IterNo** for array expansion:
```qlik
LOAD key_field,
    Trim(SubField(clean_list, ',', IterNo())) AS [Expanded.Value]
RESIDENT [Source]
WHILE Len(Trim(SubField(clean_list, ',', IterNo()))) > 0;
```

Use PurgeChar to clean delimiters before expanding the array.

## Supporting Files

- `references/sql-constructs.md` -- SQL constructs not valid in Qlik LOAD/RESIDENT, the SQL SELECT pass-through exception, and the five most common adjacent failure modes (NoConcatenate, Count() argument requirements, QUALIFY with prefixed fields, DROP TABLE discipline, NullAsValue scope)
- `references/qvd-operations.md` -- STORE syntax, optimized vs standard read rules, NoConcatenate around QVD loads, multi-QVD concatenation, file-list patterns, partial reload prefixes, binary load
- `references/join-keep-patterns.md` -- JOIN/KEEP silent-collision worked example, LEFT/INNER JOIN syntax with RESIDENT, JOIN vs KEEP semantics, row multiplication, decision framework
- `references/null-handling.md` -- canonical script-layer null handling (Null/IsNull/NullCount, vCleanNull, NullAsValue, key-field NULL, date sentinel guards, decision framework)
- `references/error-handling.md` -- TRACE semicolon trap, ScriptError vs ScriptErrorCount snapshot pattern, ErrorMode 0/1/2, file-existence guards, field-value inspection, framework-vs-standalone selection
- `references/subroutine-patterns.md` -- Must_Include vs Include, CALL syntax, SUB variable scoping rules, FOR EACH iteration with Cloud wildcard caveat, phantom field detection, composite key workaround
- `references/incremental-load-patterns.md` -- Complete incremental load patterns with working code
- `references/interval-match.md` -- IntervalMatch prefix (one-key + N-key syntax), synthetic-key resolution via LEFT JOIN + DROP TABLE, SCD2 effective-dating worked example, performance notes, IntervalMatch vs Range Bucketing decision block with three wrong-choice scenarios
- `references/diagnostic-patterns.md` -- TRACE templates, row count logging, validation queries
- `script-templates/master-calendar.qvs` -- Production-ready master calendar
- `script-templates/error-handling.qvs` -- Error handling and logging framework
- `script-templates/clean-null-function.qvs` -- Null-cleaning variable functions
- `script-templates/dual-timestamp-incremental.qvs` -- SCD Type 2 incremental load
