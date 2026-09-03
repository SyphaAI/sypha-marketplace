# Data Model Reference

**Snippets**: `single-csv.twb`, `multi-csv-relationship.twb`, `multi-csv-join.twb`

## Decision Criteria

| Scenario | Use | Snippet |
|----------|-----|---------|
| One CSV file | Single datasource | `single-csv.twb` |
| Multiple CSVs, independent queries per table | Relationship model | `multi-csv-relationship.twb` |
| Multiple CSVs, pre-joined flat result | Join model | `multi-csv-join.twb` |

> **Rule**: Relationships and joins represent a **structural fork** — they cannot be combined. The choice you make fundamentally changes the shape of the `<relation>`, `<object-graph>`, and `<extract>` elements.

## Single CSV Pattern

The most straightforward datasource type. A single `<relation type='table'>` element points to one CSV file:

```xml
<relation connection='textscan.HASH' name='sales_orders.csv'
          table='[sales_orders#csv]' type='table'>
  <columns>
    <column datatype='string' name='order_id' ordinal='0' />
    ...
  </columns>
</relation>
```

- One object in `<object-graph>`
- One capability `<metadata-record>`
- No `<cols>` mapping block is required
- No `<extract>` section

## Relationship Model (`type='collection'`)

Apply this model when connecting multiple tables through Tableau's relationship model (the newer data model). The join logic resides in `<object-graph>`, NOT in the `<relation>` tree.

### Key structure:

```xml
<relation type='collection'>
  <relation type='table' ... />  <!-- table 1 -->
  <relation type='table' ... />  <!-- table 2 -->
</relation>
```

### Object graph stores the relationship:

```xml
<object-graph>
  <objects>
    <object id='table1_GUID' ...> ... </object>
    <object id='table2_GUID' ...> ... </object>
  </objects>
  <relationships>
    <relationship>
      <expression op='='>
        <expression op='[field_name]' />
        <expression op='[field_name (table2.csv)]' />
      </expression>
      <first-end-point object-id='table1_GUID' />
      <second-end-point object-id='table2_GUID' />
    </relationship>
  </relationships>
</object-graph>
```

### Characteristics:

- **Two objects** in object-graph (one per table), each assigned a unique GUID
- **`<cols>` mapping block** is required — it maps logical field names to `[table].[field]` references
- **Duplicate field names** receive a `(tablename.csv)` suffix: `[customer_name (customer_segments.csv)]`
- **Two capability metadata-records** (one per CSV file)
- **Two `__tableau_internal_object_id__` columns** (one per table)
- **Datasource caption** carries a `+` suffix (e.g., `sales_orders+`)
- **Extract** (if present): stores each table separately in the hyper file as `<relation type='collection'>`

## Join Model (`type='join'`)

Used for legacy-style pre-joined flat table output. The join clause is embedded directly in the `<relation>` tree.

### Key structure:

```xml
<relation join='inner' type='join'>
  <clause type='join'>
    <expression op='='>
      <expression op='[sales_orders.csv].[customer_name]' />
      <expression op='[customer_segments.csv].[customer_name]' />
    </expression>
  </clause>
  <relation type='table' ... />  <!-- left table -->
  <relation type='table' ... />  <!-- right table -->
</relation>
```

### Characteristics:

- **One object** in object-graph (the joined result takes the primary table's GUID)
- **No `<relationships>` element** present in object-graph
- **Supported join types**: `inner`, `left`, `right`, `full`
- **Join expressions** use `[tablename].[fieldname]` syntax in `op` attributes
- **One `__tableau_internal_object_id__` column** (representing the joined result)
- **Extract** (if present): produces a single flat `[Extract].[Extract]` table
  - Duplicate field names receive numeric suffixes in the extract: `customer_name` → `customer_name1`
  - All `parent-name` values are set to `[Extract]`
- **Datasource caption** also carries the `+` suffix

## Field Reference Format

Fields placed on shelves use the fully-qualified format:
```
[datasource_name].[column_instance_name]
```

Example:
```
[federated.1hckotw0bte0i51b8k3sd1ffpnqc].[sum:profit:qk]
```

### Nested dimensions on shelves

Multiple dimensions may be grouped together using the `/` operator:
```xml
<rows>([datasource].[none:segment:nk] / [datasource].[none:product_category:nk])</rows>
```
Parentheses around the grouping expression are mandatory.

## Column-Instance Naming Convention

Format: `[derivation:field_name:type_suffix]`

| Derivation | Meaning | Example |
|------------|---------|---------|
| `none` | No aggregation (dimension) | `[none:region:nk]` |
| `sum` | SUM aggregation | `[sum:profit:qk]` |
| `tmn` | Month truncation | `[tmn:order_date:qk]` |
| `twk` | Week truncation | `[twk:order_date:qk]` |
| `tyr` | Year truncation | `[tyr:order_date:qk]` |
| `tqr` | Quarter truncation | `[tqr:order_date:qk]` |
| `tdy` | Day truncation | `[tdy:order_date:qk]` |

| Type Suffix | Meaning |
|-------------|---------|
| `nk` | Nominal key (discrete dimension) |
| `qk` | Quantitative key (continuous measure) |
| `ok` | Ordinal key (ordered dimension) |

## Live Connection Only

**Always output as a live connection** — do not include `<extract>` sections. The multi-table snippet files may contain extract blocks that Tableau Desktop inserted automatically; **disregard them**. The live connection pattern (no `<extract>`) is the correct baseline. See `SCAFFOLD.md` → "Live Connection vs Extract" for the rationale.

## How to Use These Snippets

These snippets illustrate the **minimum viable data model** for each pattern. Real dashboards will require:
- More columns per table — add additional `<column>` entries in all 4 redundancy locations (see `SCAFFOLD.md`)
- More tables in relationships or joins — add more `<relation type='table'>` children along with their corresponding objects and metadata
- Different CSV filenames — update all filename references consistently throughout the datasource

Use the snippets to grasp the structural pattern, then extend it to fit the actual data.

## Gotchas

1. **Quadruple-redundancy**: Every column must be declared in (1) `relation > columns`, (2) `metadata-records`, (3) `object-graph > properties > relation > columns`, AND (4) as direct `datasource > column` children. All four locations must stay in sync. See `SCAFFOLD.md` for the full details.
2. **ID consistency**: The named-connection `name` must be referenced verbatim in every `relation connection=` attribute. Object-ID GUIDs must be identical across metadata-records and object-graph.
3. **`#csv` table names**: The `table` attribute encodes the filename by replacing `.` with `#` (e.g., `[sales_orders#csv]`).
4. **Relationship vs Join is irreversible**: Once you pick one, the entire datasource structure is shaped by that choice. Converting between them requires a full rebuild.
5. **Multi-table metadata differences**: In the relationship model, each table's columns carry distinct `object-id` values. In the join model, every column shares a single `object-id`. Mixing these up silently breaks the datasource.
