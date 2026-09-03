# Scaffold Reference

**Snippet**: `workbook-skeleton.twb`
**Version**: `source-build='2025.1.10 (20251.25.1121.1650)'`

## Purpose

The smallest valid `.twb` that Tableau Desktop will open without errors. Use this as the starting skeleton for every generated workbook — datasources, worksheets, dashboards, and windows are all added into this structure.

## Top-Level Element Order (STRICT)

Elements **must** appear in this exact order inside `<workbook>`:

```
1. <document-format-change-manifest>
2. <preferences>
3. <datasources>
4. <actions>              ← optional, only if dashboard actions exist
5. <worksheets>
6. <dashboards>
7. <windows>
8. <thumbnails>
```

Deviating from this order causes Tableau to reject the file.

## Document Format Change Manifest

The manifest consists of empty self-closing tags that function as **feature flags**. The skeleton includes:

```xml
<document-format-change-manifest>
  <AccessibleZoneTabOrder />
  <AnimationOnByDefault />
  <AutoCreateAndUpdateDSDPhoneLayouts />
  <MarkAnimation />
  <ObjectModelEncapsulateLegacy />
  <ObjectModelTableType />
  <SchemaViewerObjectModel />
  <SetMembershipControl />
  <SheetIdentifierTracking />
  <WindowsPersistSimpleIdentifiers />
  <ZoneFriendlyName />
</document-format-change-manifest>
```

> **Gotcha**: Adding or removing tags in this section alters Tableau behavior. If in doubt, leave the skeleton's tag set unchanged.
> `<ZoneFriendlyName />` enables `friendly-name` attributes on dashboard layout zones — it must always be present.

## Internal ID Patterns

| ID Type | Format | Example |
|---------|--------|---------|
| Datasource name | `federated.` + 32-char hash | `federated.1hckotw0bte0i51b8k3sd1ffpnqc` |
| Named connection | `textscan.` + 32-char hash | `textscan.16xkalt18d1a7p1cjzge51xf66r6` |
| Object ID | `{filename}_{32-hex-GUID}` | `sales_orders.csv_09EB5EA8C4E1488681646EA8C7C1C3B0` |
| Simple ID (UUID) | `{GUID}` with braces | `{8ED4AD55-A43F-4C33-B8C1-A6484D0F1985}` |
| Zone IDs | Sequential integers | `3`, `4`, `5` |

> **Rule**: Every ID must be unique across the workbook. Always generate fresh GUIDs/hashes — never copy them from snippets.

## Column Definition Redundancy

Every column in a datasource must be declared in **four places** that must remain in sync. This requirement applies to **all datasource types** (single CSV, relationship, join):

| # | Location | What It Stores | Notes |
|---|----------|---------------|-------|
| 1 | `connection > relation > columns > column` | Physical schema (datatype, name, ordinal) | For multi-table: each `<relation type='table'>` has its own `<columns>` |
| 2 | `metadata-records > metadata-record` | Rich metadata (remote-type, local-type, aggregation, object-id) | Relationship model: object-id differs per table. Join model: all share one object-id |
| 3 | `object-graph > object > properties > relation > columns > column` | Physical schema (duplicate of #1) | Relationship: N objects. Join: 1 object containing the full join relation |
| 4 | `datasource > column` (direct children) | UI metadata (caption, role, type, semantic-role) | Same structure across all models |

Omitting any one of these locations causes silent corruption or load failures. Locations 1 and 3 must be byte-for-byte identical for each table.

## Remote-Type Codes (ODBC)

| Code | Type | Default Aggregation | Notes |
|------|------|---------------------|-------|
| `129` | string | Count | Has `width=1073741823` and `collation` |
| `133` | date | Year | — |
| `20` | integer | Sum | — |
| `5` | real/float | Sum | — |

## Table Name Convention

In the `table` attribute, CSV filenames have their `.` replaced by `#`:
- `sales_orders.csv` → `[sales_orders#csv]`

## Dashboard Coordinate System

Zones use a **100,000 × 100,000** virtual coordinate space:
- Root zone: `x=0 y=0 w=100000 h=100000`
- Inner zones offset by margins (e.g., `x=800 y=1000 w=98400 h=98000` = 800px margins)

## Semantic Values

Tableau detects the system locale automatically and stores it:
```xml
<semantic-value key='[Country].[Name]' value='&quot;Israel&quot;' />
```
This value is system-locale dependent — parameterize it when targeting multiple regions.

## Window Card Structure

The `<cards>` element in `<window>` follows a fixed layout:
- **Left edge**: pages → filters → marks
- **Top edge**: columns → rows → title

This order is mandatory.

## Window Attributes

Every `<window>` element must contain:

- **`<simple-id uuid='{GUID}' />`** — required on every window. These UUIDs serve as the cross-reference target for navigation buttons (`tabdoc:goto-sheet window-id="..."`). Format: `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}` (standard UUID with braces).
- **`hidden='true'`** — apply to worksheet windows that appear only when embedded in dashboards, not as standalone sheets. This hides them from the tab bar.
- **`maximized='true'`** — apply to the primary (first) dashboard window. Only one window should carry this attribute.

### Viewpoints

Every viewpoint inside a dashboard `<window>` element must include `<zoom type='entire-view' />`:
```xml
<viewpoint name='SheetName'>
  <zoom type='entire-view' />
</viewpoint>
```
Do not use a self-closing `<viewpoint name='...' />` without the zoom child — the default `'standard'` mode prevents sheets from filling their allocated space.

## Multi-Dashboard Workbooks

A workbook may contain multiple `<dashboard>` elements and multiple dashboard `<window>` elements. The structure is:

```
<workbook>
  <dashboards>
    <dashboard name='Overview' ...> ... </dashboard>
    <dashboard name='Detail' ...> ... </dashboard>
  </dashboards>
  <windows>
    <window class='dashboard' maximized='true' name='Overview'>
      <viewpoints> ... </viewpoints>
      <simple-id uuid='{...}' />
    </window>
    <window class='dashboard' name='Detail'>
      <viewpoints> ... </viewpoints>
      <simple-id uuid='{...}' />
    </window>
    <window class='worksheet' hidden='true' name='KPI Sheet'>
      ...
      <simple-id uuid='{...}' />
    </window>
  </windows>
</workbook>
```

Navigation buttons that move between dashboards reference target windows by their `simple-id uuid`.

## Live Connection vs Extract

**Always generate as a live connection** (no `<extract>` section). Reasons:
- Extracts roughly double the XML complexity (duplicate metadata-records, cols mappings, hyper file paths, refresh events)
- The `.twbx` format with embedded CSVs already delivers portability
- Users connect to live databases via `Data → Replace Data Source` anyway
- An extract can always be created later in Tableau Desktop with a single click (`Data → Extract Data`)

The `.twb` snippets in `scaffold/` and `data-model/` use live connections as the reference pattern. If a snippet contains an `<extract>` section, **disregard it** — do not include it in generated output.

## How to Use These Snippets

These snippets are **baselines, not templates**. The dashboard you generate will have different field names, additional fields, different chart combinations, and more elaborate layouts. Use the snippets to understand:
- The correct XML structure and required element ordering
- Which attributes are mandatory versus optional
- How internal IDs cross-reference one another
- The structural distinctions between patterns (e.g., relationship vs join)

Then **extrapolate** from these patterns to the specific dashboard requirements.

## Phone Device Layout

Auto-generated phone layouts use `sizing-mode='vscroll'` and `is-fixed='true'` zones. Tableau creates these automatically when `AutoCreateAndUpdateDSDPhoneLayouts` is present in the manifest.

## Examples Directory

The `examples/` directory holds additional workbook references. These are **not** the primary reference — `snippets/` is. Search the example workbooks in `examples/*.twb` only as a Tier 3 fallback when no snippet or pattern block addresses the requested feature. Do not treat them as authoritative templates; extract only the specific XML patterns needed.
