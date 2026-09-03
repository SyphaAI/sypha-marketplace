# Features Reference

**Snippets**: `calculated-field.twb`, `parameter-control.twb`, `lod-expression.twb`, `tablea-calculation.twb`, `reference-line.twb`

## Calculated Fields (`calculated-field.twb`)

### Definition (at datasource level)

```xml
<column caption='Total Price' datatype='real'
        name='[Calculation_2394226201205592064]'
        role='measure' type='quantitative'>
  <calculation class='tableau' formula='[quantity] * [unit_price]' />
</column>
```

### Naming Convention

- `name` uses `[Calculation_<18-digit-numeric-id>]` format
- `caption` is the display name visible to the user
- `formula` uses bracket-notation field references: `[field_name]`

### Usage in Worksheets

The calculated field is referenced inside `<datasource-dependencies>` through both a `<column>` (which carries the formula) and a `<column-instance>` (which specifies the aggregation):

```xml
<column-instance column='[Calculation_2394226201205592064]'
                 derivation='Sum'
                 name='[sum:Calculation_2394226201205592064:qk]'
                 pivot='key' type='quantitative' />
```

On shelves, the standard format is used:
```xml
<rows>[datasource].[sum:Calculation_2394226201205592064:qk]</rows>
```

### Common Formula Patterns

| Pattern | Example |
|---------|---------|
| Arithmetic | `[quantity] * [unit_price]` |
| String | `[first_name] + " " + [last_name]` |
| Conditional | `IF [profit] > 0 THEN "Positive" ELSE "Negative" END` |
| Date | `DATEDIFF('month', [order_date], TODAY())` |
| Boolean | `[Parameters].[Parameter 1] = 1` |

## Parameters

### Definition (in Parameters pseudo-datasource)

Parameters reside in a dedicated datasource where `hasconnection='false'`:

```xml
<datasource hasconnection='false' inline='true' name='Parameters' version='18.1'>
  <column caption='Chart-Type' datatype='integer'
          name='[Parameter 1]' param-domain-type='list'
          role='measure' type='quantitative' value='2'>
    <calculation class='tableau' formula='2' />
    <members>
      <member value='1' />
      <member value='2' />
    </members>
  </column>
</datasource>
```

### Parameter Types

| `param-domain-type` | Description | Structure |
|---------------------|-------------|-----------|
| `list` | Fixed list of allowable values | `<members>` with `<member value=...>` |
| `range` | Numeric range with step | `<range>` with `min`, `max`, `step` attributes |
| `all` | Any value (free-form input) | No domain restriction |

### Data Types

| `datatype` | `type` | Value format in XML |
|------------|--------|---------------------|
| `string` | `nominal` | `value='&quot;text&quot;'` (XML-escaped quotes) |
| `integer` | `quantitative` | `value='2'` |
| `real` | `quantitative` | `value='3.14'` |
| `boolean` | `nominal` | `value='true'` |
| `date` | `quantitative` | `value='#2024-01-01#'` |

> **Note**: In parameter XML, string values must always be wrapped in XML-escaped double quotes: `&quot;value&quot;`

### String Parameter Example (from `parameter-action.twb`)

```xml
<column caption='chart-type-parameter' datatype='string'
        datatype-customized='true' name='[Parameter 1]'
        param-domain-type='list' role='measure' type='nominal'
        value='&quot;BarChart&quot;'>
  <calculation class='tableau' formula='&quot;BarChart&quot;' />
  <members>
    <member value='&quot;BarChart&quot;' />
    <member value='&quot;LineChart&quot;' />
  </members>
</column>
```

### Parameter Control in Dashboard

Refer to `DASHBOARD.md` → Parameter Control Zone for instructions on displaying the parameter widget.

## Using Parameters in Calculated Fields

To reference a parameter, use `[Parameters].[Parameter N]`:

```xml
<column caption='BarChartType' datatype='boolean'
        name='[Calculation_1875186344151875584]'
        role='dimension' type='nominal'>
  <calculation class='tableau' formula='[Parameters].[Parameter 1] = 1' />
</column>
```

This pattern enables dynamic visibility — the boolean result determines which sheet is shown or hidden.

## LOD Expressions (`lod-expression.twb`)

### Definition

LOD expressions follow the same `<column>` + `<calculation>` pattern as standard calculated fields:

```xml
<column caption='LOD Revenue' datatype='real'
        name='[Calculation_2394226201205592064]'
        role='measure' type='quantitative'>
  <calculation class='tableau' formula='{FIXED [region]: SUM([revenue])}' />
</column>
```

### LOD Types

| Type | Syntax | Behavior |
|------|--------|----------|
| `FIXED` | `{FIXED [dim]: AGG([measure])}` | Compute at specified dimension level, ignoring viz LOD |
| `INCLUDE` | `{INCLUDE [dim]: AGG([measure])}` | Add dimension to the viz LOD |
| `EXCLUDE` | `{EXCLUDE [dim]: AGG([measure])}` | Remove dimension from the viz LOD |

### Re-Aggregation

LOD expressions operate at the row level. When placed on a shelf, Tableau **re-aggregates** them:
```xml
<column-instance column='[Calculation_ID]'
                 derivation='Sum'
                 name='[sum:Calculation_ID:qk]' ... />
```

Even though `{FIXED [region]: SUM([revenue])}` already includes `SUM`, Tableau adds another `SUM` at the viz level. This is expected behavior.

### Multiple Dimensions in LOD

```
{FIXED [region], [segment]: SUM([revenue])}
```

Multiple dimensions are separated by commas inside the curly braces.

### Context Filters and FIXED LOD

**Critical interaction**: `FIXED` LOD expressions ordinarily disregard all filters on the view — they compute at their declared granularity regardless of the dimensions or filters applied to the worksheet. **Context filters are the sole exception**.

When a filter is configured as **"Add to Context"** in Tableau, it runs *before* FIXED LOD calculations. As a result:
- A context filter on `[region] = 'West'` causes `{FIXED [product]: SUM([revenue])}` to compute only against West region data
- Without that context filter, the same FIXED LOD computes over ALL regions regardless of any regular region filter on the view

In TWB XML, a context filter adds `context='true'` to the filter element:
```xml
<filter class='categorical' column='[datasource].[none:region:nk]' context='true'>
  <groupfilter function='member' level='[none:region:nk]' member='&quot;West&quot;' />
</filter>
```

**Order of operations**: Context filters → FIXED LOD → Dimension filters → INCLUDE/EXCLUDE LOD → Measure filters → Table calculations

**When to use**: If the dashboard requirement is "show product revenue only for the filtered region" and a FIXED LOD is in use, the region filter must be promoted to a context filter. Without this, the FIXED LOD returns the global value — a frequent source of confusion.

## Table Calculations (`tablea-calculation.twb`)

Table calculations are **view-level computations** — they do not produce new datasource columns. Instead, the `<table-calculation>` element is embedded within a `<column-instance>` inside `<datasource-dependencies>`.

### Definition (inside datasource-dependencies)

```xml
<column-instance column='[revenue]' derivation='Sum'
                 name='[cum:sum:revenue:qk]' pivot='key' type='quantitative'>
  <table-calc aggregation='Sum' ordering-type='Rows' type='CumTotal' />
</column-instance>
```

- `<table-calc>` is a **child** of `<column-instance>`, not a top-level element
- The `name` prefix on the instance varies depending on the calculation type (e.g., `cum:` for cumulative)
- No `<column>` or `<calculation>` is required at the datasource level — this logic lives entirely at the view level

### Table Calculation Types

| `type` | Name Prefix | Description |
|--------|-------------|-------------|
| `CumTotal` | `cum:sum:` | Running/cumulative total |
| `CumAvg` | `cum:avg:` | Running average |
| `PctTotal` | `pct:sum:` | Percent of total |
| `Diff` | `diff:sum:` | Difference from previous |
| `PctDiff` | `pctdiff:sum:` | Percent difference from previous |
| `Rank` | `rank:sum:` | Rank |

### Ordering

- `ordering-type='Rows'` — computation runs along the table (left to right, top to bottom)
- `ordering-type='Columns'` — computation runs across columns
- For advanced addressing or partitioning, use `<order-spec>` child elements

### On Shelves

Table calculations are placed on shelves the same way as standard aggregated fields:
```xml
<rows>[datasource].[cum:sum:revenue:qk]</rows>
```

### Key Difference from Calculated Fields

| | Calculated Fields | Table Calculations |
|--|---|---|
| Where defined | Datasource-level `<column>` with `<calculation>` | View-level `<table-calc>` inside `<column-instance>` |
| Creates a new column | Yes | No |
| Aggregation | Standard (`Sum`, `Avg`, etc.) | Post-aggregation (runs after all other computations) |
| Name format | `[Calculation_XXXX]` | Uses source field name with type prefix |

## Reference Lines (`reference-line.twb`)

Reference lines place constant or computed lines on an axis. The `<reference-line>` element belongs inside `<view>`, positioned after `<datasource-dependencies>`.

### Definition

```xml
<reference-line axis-column='[sum:profit:qk]'
                enable-instant-analytics='true'
                formula='average'
                id='refline0'
                label='<Computation>: <Value>'
                label-type='custom'
                probability='95'
                scope='per-table'
                tooltip-type='none'
                value-column='[sum:profit:qk]'
                z-order='1' />
```

### Key Attributes

| Attribute | Values | Notes |
|-----------|--------|-------|
| `formula` | `'average'`, `'median'`, `'total'`, `'custom'` | Computation type |
| `scope` | `'per-table'`, `'per-pane'`, `'per-cell'` | How the line is computed |
| `label-type` | `'automatic'`, `'none'`, `'value'`, `'computation'`, `'custom'` | What label appears |
| `label` | Template string | Only used when `label-type='custom'`. Placeholders: `<Computation>`, `<Value>` |
| `z-order` | `'0'` (behind marks) or `'1'` (in front) | Drawing order |
| `axis-column` | Column-instance name | Which axis the line is drawn on |
| `value-column` | Column-instance name | Which measure to compute (usually same as `axis-column`) |

### Visual Styling

The visual appearance of a reference line is governed by `<style-rule element='refline'>` in the worksheet's `<style>` block:
```xml
<style-rule element='refline'>
  <format attr='fill-above' id='refline0' value='#00000000' />
  <format attr='fill-below' id='refline0' value='#00000000' />
</style-rule>
```

Supported format attributes include: `line-pattern` (`'solid'`, `'dashed'`, `'dotted'`), `line-color`, `line-visibility` (`'on'`/`'off'`), `fill-above`, and `fill-below` (hex with alpha channel for shading).

### Element Order

`<reference-line>` appears inside `<view>`, after `<datasource-dependencies>` and before `<aggregation>`:
```
1. <datasources>
2. <datasource-dependencies>
3. <reference-line> elements (zero or more)
4. <filter> elements (zero or more)
5. <slices>
6. <aggregation value='true' />
```

## Zone Visibility (Dynamic Zone Visibility)

Works in conjunction with parameters to show or hide dashboard zones. Requires:

1. A boolean calculated field referencing the parameter
2. `hidden-by-user='true'` attribute on the zone
3. `<dashboard-zone-visibility-node>` elements in the `<windows>` section:

```xml
<dashboard-zone-visibility-node dashboard-identifier='{UUID}'
    node-guid='GUID' visibility-input-guid='GUID' zone-id='12' />
```

## DZV Toggle Workflow

A self-contained toggle system for switching between views or modes within a dashboard. This is an advanced pattern — implement it only when DASHBOARD-PLAN.md explicitly calls for toggle-based filtering. In all other cases, prefer simple `checkdropdown` filters.

### Components

1. **Toggle worksheets**: Active/InActive worksheet pairs for each toggle option. Each is a single-cell worksheet that uses a calculated field as its text label (see WORKSHEETS.md § Toggle Worksheets):
   - **Active state**: Distinctive background color (e.g., brand purple `#7f56d9`), white text
   - **InActive state**: Neutral background, dark text

2. **String parameter**: `[Parameter 1]` stores the currently selected toggle value (e.g., "Buyer", "Dealer", "All").

3. **Parameter actions**: Each InActive toggle worksheet triggers an `<edit-parameter-action>` that sets the parameter:
   ```xml
   <edit-parameter-action caption='Set to Option A' name='[Action1_GUID]'>
     <activation type='on-select' />
     <source dashboard='DashboardName' type='sheet' worksheet='OptionA InActive' />
     <agg-type type='attr' />
     <clear-option type='do-nothing' value='s:LROOT:' />
     <params>
       <param name='source-field' value='[datasource].[none:CalcField:nk]' />
       <param name='target-parameter' value='[Parameters].[Parameter 1]' />
     </params>
   </edit-parameter-action>
   ```
   `clear-option type='do-nothing'` keeps the value intact after a user deselects.

4. **Boolean calculated fields**: One per toggleable zone, e.g., `[Parameter 1] = "Buyer"`. These fields control zone visibility.

5. **Unhighlight filter actions**: Auto-clearing filter actions that use the `tsc:tsl-filter` command to map a FALSE calc to a TRUE calc on the InActive toggle worksheets:
   ```xml
   <action caption='Unhighlight OptionA' name='[Action_GUID]'>
     <activation auto-clear='true' type='on-select' />
     <source dashboard='DashboardName' type='sheet' worksheet='OptionA InActive' />
     <command command='tsc:tsl-filter'>
       <param name='target' value='OptionA InActive' />
     </command>
   </action>
   ```
   This produces the visual deselection effect.

6. **Zone visibility**: Zones under toggle control use `hidden-by-user='true'` combined with a `<dashboard-zone-visibility-node>` that references the boolean calc.

### Assembly Order

1. Define the string parameter in `<datasource name='Parameters'>`
2. Create boolean calc fields at the datasource level
3. Create Active/InActive worksheet pairs
4. Place toggle worksheets in a horizontal flow (see DASHBOARD.md § Toggle Button Bar)
5. Add parameter actions + unhighlight filter actions at `<workbook>` level
6. Set `hidden-by-user='true'` on controlled zones
7. Add `<dashboard-zone-visibility-node>` elements in `<windows>`
