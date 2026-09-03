# Worksheets Reference

**Snippets**: `bar-chart.twb`, `line-chart.twb`, `text-table.twb`, `area-chart.twb`, `pie-chart.twb`, `scatter-plot.twb`, `dual-axis.twb`, `map-chart.twb`, `stacked-bar-chart.twb`, `combo-chart.twb`, `histogram.twb`, `bar-chart-styled.twb`, `bar-chart-filtered.twb`, `bar-chart-sorted.twb`, `custom-tooltip.twb`

## How to Use These Snippets

Each snippet shows the **simplest valid example** of a chart type (typically 1 dimension + 1 measure). Real dashboards require more fields. The patterns extend as follows:
- **Multiple dimensions**: Add additional `<column>` + `<column-instance>` entries in `<datasource-dependencies>`, then append fields to `<rows>` or `<cols>` separated by ` / ` for nesting, or as distinct shelf entries
- **Multiple measures**: Add more `<column-instance>` entries; on shelves, join them with ` + ` for a dual axis or use `[:Measure Names]` / `[:Measure Values]` for side-by-side placement
- **Additional encodings**: Any chart type can incorporate `<color>`, `<size>`, `<lod>` (Detail), or `<text>` (Label) encodings — they are not restricted to the chart types demonstrated here
- **Calculated fields on shelves**: Use the identical column-instance pattern but reference `[Calculation_ID]` as the column (see `FEATURES.md`)

## Chart Type Quick Reference

The snippets illustrate the minimum required configuration. Real charts typically use additional fields.

| Chart Type | Mark Class | Columns | Rows | Key Encodings | Panes |
|------------|-----------|---------|------|---------------|-------|
| Bar | `Automatic` | 1+ discrete dim | 1+ measure | — | 1 |
| Line | `Automatic` | 1 continuous date | 1+ measure | — | 1 |
| Text Table | `Automatic` | 1+ discrete dim | 1+ discrete dim | `<text>` = measure | 1 |
| Area | `Area` | 1 continuous date | 1+ measure | — | 1 |
| Pie | `Pie` | *empty* | *empty* | `<color>`, `<wedge-size>`, `<size>`, `<text>` | 1 |
| Scatter | `Automatic` | 1 measure | 1 measure | `<lod>` = dimension (Detail) | 1 |
| Dual Axis | `Automatic` | 1 continuous date | 2 measures (`+`) | `<color>` = `[:Measure Names]` | 3 |
| Map | `Automatic` | `[Longitude (generated)]` | `[Latitude (generated)]` | `<lod>`, `<color>`, `<geometry>` | 1 |
| Stacked Bar | `Automatic` | 1+ discrete dim | 1+ measure | `<color>` = stacking dim | 1 |
| Combo (Bar+Line) | `Bar` + `Line` (per-pane) | 1 continuous date | 2 measures (`+`) | `<color>` = `[:Measure Names]` | 3 |
| Histogram | `Automatic` | 1 bin dim (ordinal) | `CNT` or `SUM` measure | — | 1 |

## Mark Class Rules

- `Automatic`: Tableau derives the mark type from the shelf configuration. Applies to bar, line, scatter, dual-axis, stacked bar, histogram, and map charts.
- `Area`: Must be set explicitly — Tableau defaults to Line without it.
- `Pie`: Must be set explicitly — all data flows through encodings rather than shelves.
- `Bar` + `Line` (per-pane): In combo charts, the mark class is overridden individually per pane. See the Combo Chart section below.

## What Makes Each Chart Type Unique

### Bar Chart
The most straightforward pattern. A discrete dimension sits on one axis and an aggregated measure on the other. No encodings block is required.

### Line Chart
Structurally identical to the bar chart, except the dimension is a **continuous date** with a truncation derivation (e.g., `tmn` = Month-Trunc). Placing a continuous date on Columns triggers the line mark.

### Text Table
Both axes carry **discrete dimensions**. The measure appears exclusively as a `<text>` encoding inside `<pane>`:
```xml
<encodings>
  <text column='[datasource].[sum:revenue:qk]' />
</encodings>
```
Requires a mark-level style rule for labels:
```xml
<style-rule element='mark'>
  <format attr='mark-labels-show' value='true' />
  <format attr='mark-labels-cull' value='true' />
</style-rule>
```

### Area Chart
Structurally identical to a line chart, except `<mark class='Area' />` is declared explicitly. The date truncation level can be anything.

### Pie Chart
The most encoding-intensive chart — **Rows and Cols are left empty**. All data flows through encodings:
```xml
<encodings>
  <color column='[datasource].[none:product_category:nk]' />
  <wedge-size column='[datasource].[sum:cost:qk]' />
  <size column='[datasource].[sum:cost:qk]' />
  <text column='[datasource].[sum:cost:qk]' />
</encodings>
```
- `<wedge-size>` is specific to pie charts — it controls each slice's angle
- Right-edge legend cards (color + size) in `<windows>` are required
- The viewpoint must include `<zoom type='entire-view' />`

### Scatter Plot
Both axes use **continuous measures** — this configuration triggers the circle/shape mark:
```xml
<cols>[datasource].[sum:profit:qk]</cols>
<rows>[datasource].[sum:cost:qk]</rows>
```
The `<lod>` encoding provides the Detail shelf, which disaggregates marks:
```xml
<encodings>
  <lod column='[datasource].[none:product_name:nk]' />
</encodings>
```

### Dual Axis
The most structurally involved worksheet type. Two measures are combined with `+` on Rows:
```xml
<rows>([datasource].[sum:profit:qk] + [datasource].[sum:revenue:qk])</rows>
```

Creates **3 panes**:
- Pane 0: Shared/default — `<color column='[:Measure Names]' />`
- Pane 1: `y-axis-name='[sum:profit:qk]'` — first axis
- Pane 2: `y-axis-name='[sum:revenue:qk]'` — second axis

Axes are synchronized through style rules:
```xml
<style-rule element='axis'>
  <encoding attr='space' class='0' field='[sum:revenue:qk]' synchronized='true' type='space' />
  <format attr='display' class='0' field='[sum:revenue:qk]' scope='rows' value='false' />
</style-rule>
```
- `synchronized='true'` = axes are synced
- `display='false'` = second axis labels are hidden

A right-edge color legend card for `[:Measure Names]` is required.

### Map Chart
Relies on **Tableau-generated fields** that do not appear in `<datasource-dependencies>`:
```xml
<cols>[datasource].[Longitude (generated)]</cols>
<rows>[datasource].[Latitude (generated)]</rows>
```

Encodings:
```xml
<encodings>
  <lod column='[datasource].[none:country:nk]' />
  <color column='[datasource].[sum:profit:qk]' />
  <geometry column='[datasource].[Geometry (generated)]' />
</encodings>
```

Requirements:
- `<mapsources>` must appear at **both** workbook level and inside `<view>`
- `<style-rule element='map'>` with the `washout` attribute is required
- The geographic dimension must carry a `semantic-role` attribute (e.g., `[Country].[ISO3166_2]`)
- A right-edge color legend card is needed

### Stacked Bar Chart
Follows the same structure as a basic bar chart, with the addition of a **`<color>` encoding** on a second dimension. The color dimension produces stacked segments within each bar:
```xml
<encodings>
  <color column='[datasource].[none:region:nk]' />
</encodings>
```
- A `<column>` + `<column-instance>` entry for the color dimension in `<datasource-dependencies>` is required
- A right-edge color legend card in `<windows>` is required
- The mark class remains `Automatic` — Tableau stacks bars automatically when a color encoding is applied

### Combo Chart (Bar + Line)
Combines **distinct mark types within each pane** across a dual axis. Structurally close to `dual-axis.twb`, but with per-pane mark class overrides applied:
```xml
<!-- Pane 0: shared — color encoding for Measure Names -->
<pane selection-relaxation-option='selection-relaxation-allow'>
  <mark class='Automatic' />
  <encodings>
    <color column='[:Measure Names]' />
  </encodings>
</pane>
<!-- Pane 1: Bar marks for first measure -->
<pane selection-relaxation-option='selection-relaxation-allow'
     y-axis-name='[sum:revenue:qk]'>
  <mark class='Bar' />
</pane>
<!-- Pane 2: Line marks for second measure -->
<pane selection-relaxation-option='selection-relaxation-allow'
     y-axis-name='[sum:profit:qk]'>
  <mark class='Line' />
</pane>
```
- Uses the same `([measure1] + [measure2])` shelf pattern as the dual-axis chart
- The **key distinction** from `dual-axis.twb`: each pane explicitly declares `<mark class='Bar' />` or `<mark class='Line' />` instead of relying on `Automatic`
- Pane 1 may also include `<mark-sizing>` to control bar width
- A right-edge color legend card for `[:Measure Names]` is required

### Histogram
Built on a **bin-based calculated field** declared at the datasource level with `class='bin'`:
```xml
<column caption='Revenue (bin)' datatype='real'
        name='[Revenue (bin)]' role='dimension' type='ordinal'>
  <calculation class='bin' decimals='2' formula='[revenue]' peg='0' size='500' />
</column>
```
- `class='bin'` (not `class='tableau'`) — `formula` points to the source measure, `size` sets the bin width, and `peg` defines the starting value
- The bin column-instance must use **ordinal** type (`:ok` suffix), not nominal (`:nk`):
  ```xml
  <column-instance column='[Revenue (bin)]' derivation='None'
                   name='[none:Revenue (bin):ok]' pivot='key' type='ordinal' />
  ```
- Rows typically rely on a count aggregation (`CNT` or `SUM` of a "Number of Records" calculated field)
- A `<show-full-range>` element can be added to display all bin ranges, including empty ones

## KPI Worksheets

KPI cards rely on specialized worksheet patterns. Each KPI card in a dashboard typically comprises 2–3 separate worksheets (a value sheet plus delta sheets).

### KPI Value Worksheet (Big Number)
- **Mark class**: `Automatic`
- **Rows/Cols**: Both empty (`<rows />` `<cols />`)
- **Tooltip**: `<tooltip-style tooltip-mode='none' />` — tooltips are fully suppressed
- **Encoding**: A single `<text>` encoding carrying the measure
- **`customized-label`** controls the big-number display:
  ```xml
  <customized-label>
    <formatted-text>
      <run bold='true' fontcolor='#181d27' fontname='Tableau Medium' fontsize='22'><![CDATA[<[datasource].[sum:measure:qk]>]]></run>
    </formatted-text>
  </customized-label>
  ```
- **Pane style**: `mark-labels-show='true'`, `mark-labels-cull='true'`, with `text-align` and `vertical-align` for positioning

### KPI Delta Worksheet (MoM/YoY Change)
- Shares the same base structure as the KPI Value worksheet, with an added **color encoding** for directional indicators
- **Number formatting** with arrow unicode:
  ```xml
  <format attr='text-format' field='...' value='*&#9650; 0.0%;&#9660; -0.0%;&#9668; 0.0%' />
  ```
  Where: ▲ (`&#9650;`) = positive, ▼ (`&#9660;`) = negative, ◄ (`&#9668;`) = zero
- **Color palette** maps a calculated field ("Good"/"Bad"/"zero") to colors:
  ```xml
  <encoding attr='color' field='[none:ColorCalc:nk]' type='palette'>
    <map to='#079455'><bucket>&quot;Good&quot;</bucket></map>
    <map to='#717680'><bucket>&quot;zero&quot;</bucket></map>
    <map to='#d92d20'><bucket>&quot;Bad&quot;</bucket></map>
  </encoding>
  ```
- **Parenthesized label** (for secondary indicators like YoY):
  ```xml
  <customized-label>
    <formatted-text>
      <run fontname='Tableau Medium'>(</run>
      <run fontname='Tableau Medium'><![CDATA[<[datasource].[usr:Calculation_ID:qk]>]]></run>
      <run fontname='Tableau Medium'>)</run>
    </formatted-text>
  </customized-label>
  ```

### Toggle Worksheets (for DZV)
Single-cell worksheets that serve as visual toggle buttons:
- **Mark class**: `Automatic`, rows/cols left empty
- One `<text>` encoding referencing a calculated field label (CDATA)
- **Background color** set via `<style-rule element='table'><format attr='background-color' value='#7f56d9' /></style-rule>` for the active state, or a neutral color for the inactive state
- `tooltip-mode='none'`

## Number Formatting

The `<format attr='text-format' field='...' value='...' />` attribute governs how numbers display in cells. It belongs inside `<style-rule element='cell'>` within the pane's `<style>` block:

| Pattern | Display | Use For |
|---------|---------|---------|
| `'*#,##0'` | 1,234 | Integers with commas |
| `'0.0%'` | 12.3% | One decimal percent |
| `'$#,##0.00'` | $1,234.56 | Currency |
| `'*&#9650; 0.0%;&#9660; -0.0%;&#9668; 0.0%'` | ▲ 5.2% / ▼ -3.1% / ◄ 0.0% | Delta indicators with arrows |

## Encoding Elements Catalog

| Element | Purpose | Used By |
|---------|---------|---------|
| `<color>` | Color shelf — dimension creates discrete colors, measure creates gradient | Pie, Dual Axis, Map, Stacked Bar, Combo |
| `<text>` | Label/Text shelf — displayed value on marks | Text Table, Pie |
| `<size>` | Size shelf — scales mark size by measure | Pie |
| `<lod>` | Detail shelf — disaggregates marks without visual encoding | Scatter, Map |
| `<wedge-size>` | Pie-specific — determines slice angle | Pie only |
| `<geometry>` | Map-specific — geographic geometry for polygons | Map only |

## Datasource-Dependencies Block

Every worksheet declares its required fields through `<datasource-dependencies>`:
```xml
<datasource-dependencies datasource='federated.HASH'>
  <column caption='Profit' datatype='real' name='[profit]' role='measure' type='quantitative' />
  <column-instance column='[profit]' derivation='Sum' name='[sum:profit:qk]' pivot='key' type='quantitative' />
</datasource-dependencies>
```

- `<column>`: defines the field (name, datatype, role, type)
- `<column-instance>`: the aggregated or derived reference consumed by shelves and encodings

## Windows Right-Edge Legends

Charts that use color or size encodings require legend cards in the `<window>` section:
```xml
<edge name='right'>
  <strip size='160'>
    <card type='color' />
    <card type='size' />
  </strip>
</edge>
```

This is required for: Pie, Dual Axis, Map, and any chart that uses `<color>` or `<size>` encodings.

## Date Truncation Prefixes

| Prefix | Truncation | Example Instance Name |
|--------|-----------|----------------------|
| `tyr` | Year | `[tyr:order_date:qk]` |
| `tqr` | Quarter | `[tqr:order_date:qk]` |
| `tmn` | Month | `[tmn:order_date:qk]` |
| `twk` | Week | `[twk:order_date:qk]` |
| `tdy` | Day | `[tdy:order_date:qk]` |

The corresponding derivation attribute values are: `Year-Trunc`, `Quarter-Trunc`, `Month-Trunc`, `Week-Trunc`, `Day-Trunc`.

## Scaling to Multiple Fields

### Multiple Dimensions on One Axis

Declare each dimension with its own `<column>` + `<column-instance>` in `<datasource-dependencies>`, then list them on the shelf separated by ` / ` to create hierarchical nesting:
```xml
<rows>([datasource].[none:region:nk] / [datasource].[none:product_category:nk])</rows>
```
Parentheses are mandatory. Each dimension still requires its own entry in `<datasource-dependencies>`.

### Multiple Measures (Non-Dual-Axis)

For side-by-side measures (e.g., a grouped bar chart), use the built-in `[:Measure Names]` and `[:Measure Values]` fields:
```xml
<cols>([datasource].[none:region:nk] / [datasource].[none::Measure Names:])</cols>
<rows>[datasource].[sum::Measure Values:]</rows>
```
Each individual measure still requires its own `<column-instance>` in `<datasource-dependencies>`.

### Color by Dimension

Any chart type supports a color encoding — add the dimension to `<datasource-dependencies>` and reference it in encodings:
```xml
<encodings>
  <color column='[datasource].[none:segment:nk]' />
</encodings>
```
Depending on the chart type, this produces a stacked bar, multi-line chart, and so on. Always add a right-edge color legend card in `<windows>`.

### Tooltip Customization

See the "Custom Tooltips" section below for the full `<customized-tooltip>` pattern. For default tooltips, any field placed on the `<lod>` (Detail) shelf is available in the tooltip without affecting visual encoding.

## Legend Styling

Legend font and sizing are controlled via `<style-rule element='legend'>` in the worksheet's `<style>` block:
```xml
<style-rule element='legend'>
  <format attr='col-width' field='{{COLOR_FIELD}}' value='70' />
  <format attr='font-size' value='12' />
  <format attr='font-family' value='Tableau Medium' />
</style-rule>
```

This affects the appearance of dashboard-level legend zones (see DASHBOARD.md § Legend Zones).

## Style Rule Ordering

Style rules inside `<style>` blocks **must appear in alphabetical order** by `element` attribute. Tableau Desktop enforces this ordering:

```xml
<style>
  <style-rule element='axis'> ... </style-rule>
  <style-rule element='cell'> ... </style-rule>
  <style-rule element='gridline'> ... </style-rule>
  <style-rule element='legend'> ... </style-rule>
  <style-rule element='mark'> ... </style-rule>
  <style-rule element='table'> ... </style-rule>
  <style-rule element='worksheet'> ... </style-rule>
</style>
```

For KPI and text worksheets, add cell alignment rules:
```xml
<style-rule element='cell'>
  <format attr='text-align' value='center' />
  <format attr='vertical-align' value='center' />
</style-rule>
```

## Styling & Design Tokens (`bar-chart-styled.twb`)

### Worksheet Title

Declared inside `<worksheet>` > `<layout-options>` > `<title>` (must appear BEFORE `<table>`):
```xml
<layout-options>
  <title>
    <formatted-text>
      <run fontcolor='#7f56d9' fontname='Microsoft Sans Serif' fontsize='14'>&lt;Sheet Name&gt;</run>
    </formatted-text>
  </title>
</layout-options>
```
- `&lt;Sheet Name&gt;` is Tableau's built-in placeholder that resolves to the worksheet name at render time
- `fontcolor`, `fontname`, and `fontsize` are inline attributes on the `<run>` element

### Worksheet-Wide Font

Configured through `<style-rule element='worksheet'>` inside `<table>` > `<style>`:
```xml
<style-rule element='worksheet'>
  <format attr='font-family' value='Open Sans' />
</style-rule>
```
This setting cascades to all text in the worksheet — axis labels, tick marks, tooltips — unless a more specific rule overrides it.

### Custom Axis Titles

Set via `<style-rule element='axis'>`:
```xml
<style-rule element='axis'>
  <format attr='title' class='0' field='[datasource].[sum:profit:qk]' scope='rows' value='Profit per region' />
</style-rule>
```
- `scope='rows'` addresses the Y-axis; `scope='cols'` addresses the X-axis
- `field` identifies the specific axis to customize (the measure or dimension assigned to that shelf)

### Design Token Application Pattern

To apply a complete design token set to a worksheet:

| Token | XML Location | Attribute |
|-------|-------------|-----------|
| Title font/color/size | `layout-options > title > formatted-text > run` | `fontname`, `fontcolor`, `fontsize` |
| Body font | `style > style-rule element='worksheet' > format` | `attr='font-family'` |
| Axis title text | `style > style-rule element='axis' > format` | `attr='title'`, `scope`, `field` |
| Mark colors | `pane > encodings > color` | `column` (dimension for discrete, measure for gradient) |

## Filters (`bar-chart-filtered.twb`)

Filters are placed inside `<worksheet>` > `<table>` > `<view>`, after `<datasource-dependencies>` and before `<slices>`.

### Categorical Filter (Dimension)

```xml
<filter class='categorical' column='[datasource].[none:region:nk]'>
  <groupfilter function='member' level='[none:region:nk]' member='&quot;Europe&quot;'
               user:ui-domain='database' user:ui-enumeration='inclusive' user:ui-marker='enumerate' />
</filter>
```

For **multiple values**, wrap the members in `function='union'`:
```xml
<filter class='categorical' column='[datasource].[none:region:nk]'>
  <groupfilter function='union' user:ui-domain='database' user:ui-enumeration='inclusive' user:ui-marker='enumerate'>
    <groupfilter function='member' level='[none:region:nk]' member='&quot;Europe&quot;' />
    <groupfilter function='member' level='[none:region:nk]' member='&quot;Asia&quot;' />
  </groupfilter>
</filter>
```

### Quantitative Filter (Date Range)

```xml
<filter class='quantitative' column='[datasource].[none:order_date:qk]' included-values='in-range'>
  <min>#2025-03-03#</min>
  <max>#2025-04-22#</max>
</filter>
```
- Date literals are delimited by `#`: `#2025-03-03#`
- `included-values='in-range'` defines a between-min-and-max range

### Context Filters

To promote a filter to a context filter, add `context='true'`:
```xml
<filter class='categorical' column='[datasource].[none:region:nk]' context='true'>
  ...
</filter>
```
Context filters run **before** FIXED LOD calculations and all other filter types. See `FEATURES.md` → "Context Filters and FIXED LOD" for the complete order of operations.

### The `<slices>` Element

After all filters, include a `<slices>` block that lists every filtered column:
```xml
<slices>
  <column>[datasource].[none:region:nk]</column>
  <column>[datasource].[none:order_date:qk]</column>
</slices>
```
Every field with a `<filter>` entry must also be listed in `<slices>`.

### Showing Filter Cards on Dashboard

Filters are active by default but not shown to users. To expose a filter control card, add the following to `<window>` > `<cards>`:
```xml
<card column='[datasource].[none:region:nk]' type='filter' />
```

## Sorting (`bar-chart-sorted.twb`)

### Computed Sort (by Measure)

Add `<computed-sort>` inside `<view>`, positioned after `<datasource-dependencies>` and before `<aggregation>`:
```xml
<computed-sort column='[datasource].[none:product_category:nk]' direction='DESC'
               using='[datasource].[sum:profit:qk]' />
```
- `column` = the dimension to be sorted
- `direction` = `DESC` (highest first) or `ASC` (lowest first)
- `using` = the measure used to determine sort order

### Manual Sort (Explicit Order)

For a user-defined order, use `<sort>` with a `<dictionary>`:
```xml
<sort column='[datasource].[none:product_category:nk]' direction='ASC'>
  <dictionary>
    <bucket>&quot;Electronics&quot;</bucket>
    <bucket>&quot;Furniture&quot;</bucket>
    <bucket>&quot;Office Supplies&quot;</bucket>
  </dictionary>
</sort>
```

### Manifest Addition

Workbooks that include sorts must add `<SortTagCleanup />` to `<document-format-change-manifest>`.

## Custom Tooltips (`custom-tooltip.twb`)

Custom tooltips depend on a **three-part chain** — all three must stay in sync:

1. `<datasource-dependencies>` > `<column-instance>` — declares the field
2. `<pane>` > `<encodings>` > `<tooltip column='...' />` — registers the field for tooltip use
3. `<pane>` > `<customized-tooltip>` > `<formatted-text>` — defines the visual template

### Tooltip Template Structure

```xml
<customized-tooltip>
  <formatted-text>
    <!-- Label (gray, bold) -->
    <run bold='true' fontcolor='#757575' fontname='Open Sans' fontsize='12'>Product Category:</run>
    <!-- Line break -->
    <run fontcolor='#757575' fontname='Open Sans' fontsize='12'>&#198;&#9;</run>
    <!-- Value (bold, default color, field reference in CDATA) -->
    <run bold='true' fontname='Open Sans' fontsize='12'><![CDATA[<[datasource].[none:product_category:nk]>]]></run>
  </formatted-text>
</customized-tooltip>
```

### Field References in `<run>` Elements

Fields are embedded using **CDATA with angle brackets** — this applies to tooltips, customized labels, KPI values, and any `<run>` element that contains a field reference:
```xml
<run><![CDATA[<[datasource_name].[column_instance_name]>]]></run>
```
The `< >` surrounding the field reference is Tableau's substitution syntax. The CDATA wrapper prevents XML parsing errors.

> **Critical**: Never encode field references using XML entities (`&lt;...&gt;`) — Tableau will render them as literal text rather than resolving the field value. Always use CDATA.

### Line Breaks

Use `&#198;&#9;` (AE ligature + tab), which is Tableau's internal line break encoding. **Never** use `\n` or `<br/>`.

### `<run>` Style Attributes

| Attribute | Values | Notes |
|-----------|--------|-------|
| `bold` | `'true'` | Omit entirely for non-bold (no `bold='false'`) |
| `fontcolor` | `'#hex'` | Omit for default black |
| `fontname` | Font family string | e.g., `'Open Sans'` |
| `fontsize` | Point size | e.g., `'12'` |

### Tooltip Encoding Registration

Every field referenced in the tooltip template must also be registered in `<encodings>`:
```xml
<encodings>
  <tooltip column='[datasource].[sum:profit:qk]' />
  <tooltip column='[datasource].[attr:product_category:nk]' />
</encodings>
```

## Element Order Inside `<view>` (Canonical)

Derived from all snippets, the mandatory order inside `<worksheet>` > `<table>` > `<view>` is:

```
1. <datasources>
2. <datasource-dependencies>
3. <reference-line> elements (zero or more — see FEATURES.md)
4. <filter> elements (zero or more)
5. <computed-sort> / <sort> elements (zero or more)
6. <slices> (only if filters exist)
7. <aggregation value='true' />
```

The complete `<worksheet>` structure is:
```
1. <layout-options>  (optional — title styling)
2. <table>
   ├── <view>        (fields, filters, sorts, aggregation)
   ├── <style>       (style-rules for axis, worksheet, marks)
   ├── <panes>       (mark type, encodings, customized-tooltip)
   ├── <rows>        (shelf assignments)
   └── <cols>        (shelf assignments)
3. <simple-id>
```
