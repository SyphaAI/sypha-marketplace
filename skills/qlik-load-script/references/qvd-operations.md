# QVD Operations

Authoritative syntax and mechanics for Qlik QVD files: STORE, LOAD FROM (qvd), optimized vs standard read, NoConcatenate around QVD loads, multi-QVD concatenation, file-list iteration, partial reload prefixes, binary load.

For decision framing — when to use optimized read, when to layer QVDs, when to split a generator/consumer architecture — see `qlik-performance` SKILL.md. This file covers the mechanics; that file covers the decisions.

---

## STORE Syntax

Writes the contents of an in-memory table to a QVD file.

```qlik
// Write all fields, one table per STORE:
STORE * FROM [TableName] INTO [lib://Connection/path/file.qvd] (qvd);

// Write a subset of fields by name:
STORE Field1, Field2 FROM [TableName] INTO [lib://Connection/file.qvd] (qvd);

// CSV is also supported by the same syntax — file extension and format spec change:
STORE * FROM [TableName] INTO [lib://Connection/file.csv] (txt, delimiter is ',');
```

Rules:
- One table per STORE. Writing two tables requires two STORE statements.
- The `(qvd)` format specifier is mandatory for QVD output.
- The target connection (`lib://...`) must be writable from the reload context.
- When the file already exists, STORE overwrites it. There is no append mode; for append-style incremental output, refer to the patterns in `incremental-load-patterns.md` (sibling reference file).
- **Concurrent-write hazard.** Per the Qlik knowledge base, STORE opens its target file exclusively, blocking both read and write access by other tasks while it runs. Two reload tasks scheduled to STORE to the same QVD path at overlapping times will conflict — one acquires the exclusive lock and the other fails. A reload that reads the QVD while another task is writing it can also fail. The script does not retry on its own. Schedule generator reloads so that writes to the same QVD path never overlap, or stage each generator's output to a per-task path and promote to the canonical name only after all writers have finished. Reference: Qlik Community KB — "Concurrent Read and Write from/to a QVD file may result in one of the tasks failing." https://community.qlik.com/t5/Knowledge-Base/Concurrent-Read-and-Write-from-to-a-QVD-file-may-result-in-one/ta-p/1711386

Reference: help.qlik.com Cloud — Store statement.

---

## LOAD FROM (qvd) Syntax

Reads a QVD file back into an in-memory table.

```qlik
// Full load — all fields:
[Customers]:
LOAD * FROM [lib://QVDs/Customers.qvd] (qvd);

// Field-list load — only the named fields:
[Customers]:
LOAD customer_id AS [Customer.Key],
     customer_name AS [Customer.Name]
FROM [lib://QVDs/Customers.qvd] (qvd);
```

The `(qvd)` format specifier instructs Qlik to treat the source as a QVD; without it the engine falls back to file-extension detection, which is unreliable when the path is variable-driven.

Reference: help.qlik.com Cloud — LOAD statement, QVD format.

---

## Optimized vs Standard Read Modes

QVDs support two read modes. **Optimized read** copies pre-serialized symbol tables and bit-stuffed pointers directly into memory. **Standard read** unpacks every value before applying LOAD logic. Optimized read is approximately an order of magnitude faster than standard QVD read, which is itself roughly an order of magnitude faster than re-querying a database. (Exact ratios are practitioner estimates; Qlik does not publish them.)

### What preserves optimized read

Per Qlik help, only specific operations disable optimized read. Any operation absent from the disable list remains optimized.

- `LOAD *`
- Field subsetting (loading only a subset of the QVD's fields by name)
- Field renaming with `AS` (e.g., `source_col AS [New.Name]`)
- Field reordering relative to the QVD's stored order
- `LOAD DISTINCT` — the QVD read itself remains optimized; DISTINCT processing occurs after the fast read
- `CONCATENATE` prefix
- Single-parameter `EXISTS(field)` / `NOT EXISTS(field)` in a WHERE clause — the standard incremental-filter pattern — **only when `field` exactly matches a field name in the QVD being loaded**. If the QVD stores the field under one name (e.g., `customer_id`) but this LOAD aliases it to a different name (e.g., `[Customer.Key]`), an `EXISTS([Customer.Key])` check forces standard read because the engine cannot match the EXISTS name to a stored symbol prior to unpacking. Either reference the stored QVD name in EXISTS, or alias upstream so that the symbol space already contains the target name
- A preceding LOAD above the QVD LOAD — the inner QVD read remains optimized; the outer transformation runs in-memory afterward

### What forces standard read

- Any function or expression applied to a loaded field — `Upper(name)`, `Date#(date_field)`, `Num(id_field)`, etc.
- Derived fields built from multiple source fields — `field1 & '-' & field2 AS CompositeKey`
- Two-parameter `EXISTS(field, expression)` — the expression form
- WHERE clauses that aren't a single-parameter `EXISTS(field)` — e.g., `WHERE amount > 0`
- `MAP ... USING` applied to a field being loaded

```qlik
// Optimized — field rename, subset, single-parameter NOT EXISTS:
LOAD customer_id AS [Customer.Key], name AS [Customer.Name]
FROM [lib://QVDs/Customers.qvd] (qvd)
WHERE NOT EXISTS([Order.Key]);

// Standard — transformation breaks it:
LOAD Upper(name) AS [Customer.Name]
FROM [lib://QVDs/Customers.qvd] (qvd);

// Standard — two-parameter EXISTS forces unpack:
LOAD * FROM [lib://QVDs/Customers.qvd] (qvd)
WHERE NOT EXISTS([Existing.Key], [Order.Key]);
```

**Folklore correction:** Field renaming via `AS` and field reordering relative to the QVD's stored order do NOT disable optimized load. Earlier QlikView-era guidance suggesting otherwise is incorrect for current Sense/Cloud behavior.

**Preceding LOAD for transformations:** When transformations are required, load to a temp table via an inner optimized LOAD, then apply the transform in the outer preceding LOAD:

```qlik
[Dimension.Customer]:
LOAD *, Upper([Customer.Name]) AS [Customer.Name];   // outer — in-memory transform
LOAD * FROM [lib://QVDs/Customer.qvd] (qvd);         // inner — optimized read
```

The inner read stays optimized. The outer LOAD processes the in-memory rows and applies the transform.

Reference: help.qlik.com Cloud — Working with QVD files (`work-with-QVD-files.htm`); Exists() (`InterRecordFunctions/Exists.htm`).

---

## EXISTS Against a QVD Load

The single-parameter `EXISTS(field)` form is the standard pattern for filtering a QVD load while preserving optimized read. It checks the named field's symbol space — all previously loaded values across every table containing that field.

```qlik
// Step 1 — load the set of allowed keys into a prior table.
[AllowedCustomers]:
LOAD customer_id FROM [lib://QVDs/AllowedKeys.qvd] (qvd);

// Step 2 — optimized load that filters by membership.
[Fact.Orders]:
LOAD *
FROM [lib://QVDs/Orders.qvd] (qvd)
WHERE EXISTS(customer_id);
```

**Self-referencing dedup behavior:** Single-parameter `EXISTS(field)` also evaluates values loaded *during the current statement*. The symbol table is updated row-by-row as the load progresses, so the second occurrence of a value sees the first as already present. This is documented Qlik behavior — generally useful for incremental patterns (it skips QVD rows whose keys were already loaded from the source), but it means `WHERE NOT EXISTS(field)` on a fresh load returns only the first occurrence of each value.

To avoid both the self-reference issue and cross-table contamination (where another table that also contains `field` pollutes the check), alias the lookup field and use the two-parameter form — at the cost of forcing standard read mode:

```qlik
[_Existing]:
LOAD DISTINCT customer_id AS _existing_cust RESIDENT [Customers];

LOAD * FROM [lib://QVDs/Orders.qvd] (qvd)
WHERE NOT EXISTS(_existing_cust, customer_id);   // standard read

DROP TABLE [_Existing];
```

Reference: help.qlik.com Cloud — Exists() (`InterRecordFunctions/Exists.htm`); see SKILL.md Section 15 for the full symbol-space discussion.

---

## NoConcatenate Around QVD Loads

When a new LOAD produces a field set identical to an existing table's (same names AND same count), Qlik silently appends the rows into the existing table. The new table name is never registered.

This trap arises frequently in QVD-based patterns because two QVDs in the same processing layer often share the same column structure (e.g., two raw extracts of the same shape, or a temp table that mirrors the QVD it was loaded from).

```qlik
[Customers]:
LOAD * FROM [lib://QVDs/Customers.qvd] (qvd);

// WITHOUT NoConcatenate, this silently merges into [Customers]:
[CustomersBackup]:
NoConcatenate
LOAD * RESIDENT [Customers];
```

Apply `NoConcatenate` defensively to any temp table that deduplicates, filters, or pivots data with the same shape as its source. Full treatment is in `references/sql-constructs.md` Section 2.1.

**Explicit CONCATENATE prefix:** `CONCATENATE([TargetTable])` enforces concatenation even when field sets differ. Fields missing from the source receive NULL in the target. Use this when intentionally merging tables with partially overlapping schemas — a common scenario in multi-source extracts that union into a single fact table.

---

## Multi-QVD Concatenation

Two common patterns exist for loading multiple QVDs into a single table.

### Pattern 1: Explicit CONCATENATE per file

```qlik
[Sales]:
LOAD * FROM [lib://QVDs/Sales_2024.qvd] (qvd);

CONCATENATE([Sales])
LOAD * FROM [lib://QVDs/Sales_2025.qvd] (qvd);

CONCATENATE([Sales])
LOAD * FROM [lib://QVDs/Sales_2026.qvd] (qvd);
```

Each CONCATENATE load remains optimized (CONCATENATE preserves it). Use this pattern when the file list is short and known at script time.

### Pattern 2: FOR EACH over FileList

```qlik
[Sales]:
LOAD * FROM [lib://QVDs/Sales_2024.qvd] (qvd);   // seed the target

FOR EACH vFile IN FileList('lib://QVDs/Sales_*.qvd')
    IF '$(vFile)' <> 'lib://QVDs/Sales_2024.qvd' THEN
        CONCATENATE([Sales])
        LOAD * FROM [$(vFile)] (qvd);
    END IF
NEXT vFile
```

Use when the file list is dynamic. Notes:
- The first load creates the target table; subsequent loads must use `CONCATENATE([Sales])`. Without it, the auto-concatenation rule will still merge identically structured QVDs — but only when the field set matches exactly. Explicit CONCATENATE is the safer choice.
- `FileList('lib://Path/*.qvd')` wildcards may not function for all Qlik Cloud connection types. If the wildcard fails, switch to an explicit file list or a directory listing.
- The seed-then-loop pattern shown above prevents the seed file from being loaded twice.

### Pattern 3: Auto-concatenation in a loop

When every QVD in the list has an identical field set, the auto-concatenation rule handles the merging automatically — no `CONCATENATE` prefix is needed:

```qlik
FOR EACH vFile IN FileList('lib://QVDs/Sales_*.qvd')
    [Sales]:
    LOAD * FROM [$(vFile)] (qvd);
NEXT vFile
```

Each iteration's `[Sales]:` is silently merged into the running `[Sales]` table because the field sets match. This approach is concise but brittle — a single unexpected column in any QVD breaks the merge. Prefer explicit CONCATENATE in production scripts.

---

## Load Once, Map Many

Never read the same QVD from disk more than once. Each disk read is the costly operation; once the data is resident in memory, subsequent operations are comparatively free.

```qlik
// WRONG — two disk reads:
[Map_ProductName]:
MAPPING LOAD product_id, product_name FROM [lib://QVDs/Product.qvd] (qvd);
[Map_ProductCategory]:
MAPPING LOAD product_id, product_category FROM [lib://QVDs/Product.qvd] (qvd);

// RIGHT — one disk read, multiple maps from resident:
[_ProductTemp]:
LOAD * FROM [lib://QVDs/Product.qvd] (qvd);

[Map_ProductName]:
MAPPING LOAD product_id, product_name RESIDENT [_ProductTemp];
[Map_ProductCategory]:
MAPPING LOAD product_id, product_category RESIDENT [_ProductTemp];

DROP TABLE [_ProductTemp];
```

Rule: each QVD should be read from disk exactly once per reload. If a downstream step needs the same QVD, load it into a temp table and serve all consumers from resident.

---

## Narrow Before STORE

When writing intermediate or output QVDs, include only the fields that downstream consumers actually need. Storing fields that nothing reads wastes disk space, increases QVD read time, and inflates downstream memory usage.

```qlik
// WRONG — store all 20 fields of the working table:
STORE [_AllOrderData] INTO [lib://QVDs/orders.qvd] (qvd);

// RIGHT — narrow to a downstream-only table, then store:
[_OrdersSubset]:
LOAD order_id, order_date, customer_id, amount, region
RESIDENT [_AllOrderData];

STORE [_OrdersSubset] INTO [lib://QVDs/orders.qvd] (qvd);
DROP TABLE [_OrdersSubset];
```

This is particularly valuable in QVD generator/consumer architectures: a narrow generator output reduces load time for every downstream consumer.

---

## Partial Reload and QVD Loads

Partial reload executes only the LOAD/SELECT statements marked with `ADD`, `REPLACE`, or `MERGE` prefixes — all other statements are skipped. This behavior affects QVD operations as follows:

| Prefix | Behavior on partial reload | Behavior on full reload |
|---|---|---|
| `ADD` | Runs; rows append to existing table (or new table is created) | Runs |
| `REPLACE` | Runs; existing table is dropped before the load | Runs |
| `MERGE` | Runs; uses operation markers to insert/update/delete rows | Runs |
| (no prefix) | Skipped | Runs |

The implication for QVDs: a script that builds QVDs from sources and is intended to support partial reload must use `ADD LOAD` / `ADD CONCATENATE LOAD` throughout the source-to-table-to-STORE chain; otherwise partial reload skips the chain entirely and no data is written.

```qlik
// Partial-reload-friendly extract:
[Sales]:
ADD CONCATENATE LOAD * FROM [lib://QVDs/Sales.qvd] (qvd);          // load existing

ADD CONCATENATE SQL SELECT * FROM sales WHERE modified > '$(vLast)'; // append new

ADD STORE * FROM [Sales] INTO [lib://QVDs/Sales.qvd] (qvd);          // overwrite QVD
```

`MERGE LOAD` specifically reads a change-log-style table where each row carries an operation marker (insert / update / delete) and applies the corresponding action to the target. This is useful when the source provides change events; it is less applicable when the source delivers a full snapshot.

Reference: help.qlik.com Cloud — Partial reload; ADD, REPLACE, and MERGE load prefixes.

---

## Binary Load

`binary [app];` copies the complete data model (and section access) from another app. Rules:

- Must be the **first statement** in the script — placed before any SET statements.
- Only one binary statement is permitted per script.
- Copies data tables and section access only. Does NOT copy variables, sheets, master items, or visualizations.
- Does NOT chain reloads — the consumer reflects a snapshot of the generator's last-saved state at the time the consumer reloads.

Syntax varies by platform:

```qlik
// Qlik Cloud — app GUID:
binary [a1b2c3d4-5e6f-7890-abcd-ef1234567890];

// Client-managed — .qvf via folder data connection:
binary [lib://Apps/Generator.qvf];
```

For guidance on when binary load is the appropriate choice versus a generator/consumer pattern with QVDs, see `qlik-data-modeling` → `references/multi-app-architecture.md`.

Reference: help.qlik.com Cloud — Binary statement.

---

## Cross-References

- **`incremental-load-patterns.md`** (sibling reference file) — full working code for insert-only, insert/update, insert/update/delete, and dual-timestamp SCD2 patterns; all use the QVD mechanics described here.
- **`references/sql-constructs.md` Section 2.1** — NoConcatenate failure modes including the INLINE auto-concatenation trap.
- **`qlik-performance` SKILL.md** — decision framing for optimized load, redundant-disk-read elimination, narrow-before-STORE rationale, memory-aware QVD layer design.
- **`qlik-data-modeling` → `references/multi-app-architecture.md`** — when to split a single app into generator/consumer (or further), reload chaining between apps, binary load tradeoffs.
- **`SKILL.md` Section 15** — EXISTS symbol-space behavior (cross-table contamination, self-referencing dedup) with worked examples.

---

## Tier-1 References

- help.qlik.com Cloud — Working with QVD files: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/work-with-QVD-files.htm
- help.qlik.com Cloud — Exists() function: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/InterRecordFunctions/Exists.htm
- help.qlik.com Cloud — Store, LOAD, Binary statements and ADD/REPLACE/MERGE load prefixes (Script statements and keywords section).
