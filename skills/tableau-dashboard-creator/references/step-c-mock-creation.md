# Step C: HTML Mock Creation

**Identity**: You are a Tableau developer producing an interactive HTML mock that stakeholders can review in a browser. The mock must accurately reflect Tableau's layout constraints and the customer's design system as captured in `design-tokens.md`.

## Process

1. **Read the approved DASHBOARD-PLAN.md**
2. **Read design-tokens.md** (produced in Step 0) for all styling values
3. **Ask the user for their target screen size** — present these options:
   - **Standard Laptop** (1100×800): Standard laptop resolution — suitable for dashboards viewed primarily on portable devices
   - **Home Screen** (2100×1000): Larger home or desktop monitor — suited to dashboards displayed on wide external screens
   - **Custom**: Allow the user to supply their own width × height
   - If the user skips or does not respond, default to **Standard Laptop** (1100×800)
4. **Select the matching template layout** based on the layout recommended in the dashboard plan
5. **Build the HTML mock** in accordance with Tableau constraints, using the chosen screen dimensions as the dashboard frame
6. **Save to** `mock-version/v_N/mock.html`

## Entry Requirements

Before Step C begins, confirm:
- `DASHBOARD-PLAN.md` is approved
- `design-tokens.md` is approved
- every chart in the plan has an assigned slot or layout position
- any fallback-driven design decisions are visible in the approved root docs

If the approved plan does not fit cleanly within the minimum dashboard frame, do not force it onto a single page. Revise the layout or split the experience instead.

## Technical Requirements

### HTML Structure
- A single self-contained HTML file with inline CSS and JS
- Use Chart.js via CDN for interactive charts: `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js`
- Load the font family from design-tokens.md (default: Open Sans via Google Fonts)
- Responsive within the sizing range defined in design-tokens.md
- Dashboard frame dimensions are determined by the user's screen-size selection (see Process step 3):
  - **Standard Laptop**: minimum height `800px`, minimum width `1100px`
  - **Home Screen**: minimum height `1000px`, minimum width `2100px`
  - **Custom**: dimensions supplied by the user
  - If the user skipped the prompt, default to Standard Laptop (1100×800)
  - No fixed maximum — the layout must scale proportionally beyond the minimum frame

### Tableau Fidelity Rules

**CRITICAL - these constraints must be followed:**

1. **No rounded corners** anywhere unless the user explicitly accepts a non-Tableau-faithful mock
   - `border-radius: 0` on all elements
2. **Container hierarchy** must mirror Tableau's zone model:
   - Outer: `layout-basic` (absolute positioning root)
   - Inner: `layout-flow` containers (vertical or horizontal flexbox)
   - Fixed-size containers use explicit pixel heights
   - Flex containers fill the remaining space
3. **No box shadows** unless explicitly requested (Tableau has no native shadow support)
4. **Border-style: none** on all containers (the logo zone is the exception, using a background-blending border)
5. **Fixed-size elements**: Apply explicit `min-height` / `min-width` CSS values to structural elements (title bars, KPI rows, filter bars, accent bars, icons, logo) to prevent compression on smaller screens. Only chart areas and main content should flex.
6. **Tableau-native terminology**: Use Tableau spacing terms (`margin`, `padding`) in design documentation — avoid CSS-specific terms like `gap`, which have no Tableau equivalent.
7. **No out-of-bounds rendering**: Titles, legends, labels, canvases, and controls must remain inside their card boundaries at the minimum dashboard frame size.
8. **Avoid empty-space-heavy layouts**: If a row or card leaves large dead areas, rebalance the layout or select a denser template. Do not leave charts visibly undersized relative to their containers.

### Layout Sizing Contract

The mock must be visually disciplined, not merely approximate. Apply these rules:
- Use an explicit root dashboard frame sized to the minimum height and width the user selected in the screen-size prompt (defaults to `800px` height and `1100px` width for Standard Laptop)
- Apply consistent outer padding and internal row/column spacing drawn from the design tokens
- Assign each chart card a defined slot and expected size from `DASHBOARD-PLAN.md`
- KPI cards within a row should share equal widths
- Multi-chart rows should divide space evenly unless the approved plan explicitly designates a dominant chart
- Each chart's plot area should occupy roughly `70%` or more of its card after accounting for title bars, separators, legends, and padding
- If a right-side legend would compress the plot area excessively, move it to the bottom or simplify the chart
- If labels, legends, or filter controls overflow at the minimum frame size, revise the layout rather than stretching it

### Chart.js Canvas Sizing

Chart.js requires a container with non-zero height to render. Flex layouts that use `min-height: 0` can collapse chart containers to zero pixels, resulting in blank canvases (sad face icon). Follow these rules:

1. **Canvas wrapper min-height**: Every `.chart-body` (or equivalent canvas wrapper) must specify `min-height: 140px` (or a suitable value for the layout). Never set `min-height: 0` on a chart container.
2. **Do not force canvas dimensions**: Avoid applying `width: 100% !important` or `height: 100% !important` to `<canvas>` elements. Chart.js controls its own canvas sizing when `responsive: true` and `maintainAspectRatio: false` are configured. Forcing these dimensions overrides Chart.js internals and can break rendering.
3. **Canvas display block**: Set `canvas { display: block; }` to eliminate the inline-element gap that introduces unexpected whitespace beneath the canvas.
4. **DZV overlay containers**: Overlay panels that contain their own `<canvas>` elements (e.g., drill-down panels) require the same `min-height` treatment on their body containers.
5. **Side panels**: Collapsible side panels (e.g., credit detail panels) should invoke `chart.resize()` after the CSS transition finishes (~300ms) to force Chart.js to recalculate dimensions for the newly visible container.

### Design Token Application

Apply every value from `design-tokens.md`. Map the tokens to CSS as follows:

```css
/* Map these from design-tokens.md — values shown are examples */
body {
    font-family: /* from design-tokens: Typography > Font family */;
    background-color: /* from design-tokens: Colors > Dashboard background */;
    margin: 0;
    font-size: /* from design-tokens: Typography > Worksheet default font size */;
}

.dashboard-title {
    font-size: /* from design-tokens: Typography > Dashboard title size */;
    font-weight: /* from design-tokens: Typography > Dashboard title weight */;
    color: /* from design-tokens: Colors > Text > Dark */;
    background-color: /* from design-tokens: Colors > Top banner area */;
    padding: 4px;
    padding-bottom: 0;
    margin-bottom: 1px;
}

.chart-title {
    font-size: /* from design-tokens: Typography > Chart title size */;
    color: /* from design-tokens: Colors > Text > Dark */;
    margin: 4px;
    margin-left: 10px;
}

.filter-label {
    font-size: /* from design-tokens: Typography > Filter labels size */;
    font-weight: bold;
    color: /* from design-tokens: Colors > Text > Medium */;
}

.chart-card {
    background-color: /* from design-tokens: Colors > Chart card background */;
    padding: 8px;
    border: none;
    border-radius: 0;  /* CRITICAL */
}

.kpi-accent-bar {
    height: 3px;
    margin: 0;
    /* background-color: from design-tokens: Colors > Accent Colors */
}

.separator-line {
    height: 3px;
    background-color: /* from design-tokens: Colors > Separator line */;
    margin: 0 10px;
}

/* Inner padding for all worksheet/sheet zones — space between zone border and content */
.sheet-zone {
    padding: 8px;
}

/* Flexible spacer — every flow container should include one to prevent layout collapse */
.spacer {
    flex: 1;
}

/* Chart.js canvas container — must have a concrete min-height */
.chart-body {
    flex: 1;
    position: relative;
    min-height: 140px;  /* CRITICAL — prevents flex collapse */
}

.chart-body canvas {
    display: block;  /* removes inline gap */
    /* Do NOT add width/height 100% !important — Chart.js manages its own sizing */
}
```

### Container Layout Pattern

Use the following HTML structure, which mirrors Tableau's zone hierarchy (adapt it to the container hierarchy in design-tokens.md):

```html
<div class="dashboard-root">                    <!-- layout-basic -->
  <div class="content-wrapper">                 <!-- Content (vert flow) -->
    <div class="top-banner">                    <!-- Logo, Info, Last update -->
      <div class="logo-area">...</div>
      <div class="spacer"></div>                <!-- Flexible spacer -->
      <div class="update-info">...</div>
    </div>
    <div class="dashboard-title">Title</div>    <!-- Dashboard Title -->
    <div class="filter-bar">                    <!-- Top Filters -->
      <span class="filter-label">Filters</span>
      <div class="filter-controls">...</div>
      <div class="spacer"></div>                <!-- Flexible spacer -->
    </div>
    <div class="main-content">                  <!-- Charts & Hidden Filters -->
      <div class="charts-area">                 <!-- KPI & Charts -->
        <div class="kpi-row">...</div>          <!-- Main KPI (if applicable) -->
        <div class="chart-row">...</div>        <!-- Chart rows -->
        <div class="spacer"></div>              <!-- Flexible spacer -->
      </div>
      <div class="hidden-filters">...</div>     <!-- Hidden Filters panel -->
    </div>
  </div>
</div>
```

### Logo Integration

If a logo file was specified in design-tokens.md:
- Place the logo in the top-banner area
- For SVG: inline the SVG element or use `<img>` with a relative path
- For PNG: use `<img>` with a relative path, or base64-encode it for a self-contained file
- Honor the dimensions and padding defined in the design tokens

### Icon Integration

Chart title bars should display a small icon for visual enrichment:
- If `branding/icons/` contains SVG files, use the appropriate icon for each chart (filenames should match the icon names suggested in DASHBOARD-PLAN.md, e.g., `bar-chart.svg`, `trend.svg`)
- If no icons are available, generate simple monochrome 40x40 inline SVG icons using the brand primary color, shaped to match the chart type (e.g., a bar-chart icon for bar charts, a line icon for trend charts)
- Icons are positioned in the chart title bar at 40x40 pixels, preceding the chart title text

### DOM Security Rules

- **Never use `innerHTML`** to set content — even for hardcoded data. Security checks treat it as an XSS risk.
- Use `textContent` for plain text (labels, KPI values, titles).
- When building HTML elements dynamically, use safe DOM methods (`createElement`, `appendChild`, `setAttribute`).
- For Chart.js tooltips and callbacks, rely on the Chart.js API (which renders safely) rather than injecting raw HTML.

### Chart Implementation

Use Chart.js with placeholder data that reflects the expected data shape:
- Match the chart types specified in DASHBOARD-PLAN.md
- Use realistic placeholder values and labels
- Apply chart series colors from design-tokens.md
- Apply accent colors from design-tokens.md to KPI cards
- Include tooltips that display the metric name and value
- Keep chart proportions consistent with their assigned slots — a full-width chart should visibly outscale a half-width chart
- Prioritize readable axes and labels over fitting in additional marks or decorations

### Interactive Elements

Implement the following where applicable:
- **Filter dropdowns**: HTML `<select>` elements that filter chart data through JS
- **Dashboard action filters**: Click handlers on charts that highlight or filter other charts
- **Collapsible hidden filters panel**: Toggle button behavior (DZV pattern)
- **KPI cards**: Display metric values with optional comparison indicators

## Output

Save to `mock-version/v_N/mock.html` where N is the current version number (begin at 1).

Present the mock to the user (direct them to open the HTML file in a browser) and **wait for approval** before proceeding to Step D. If the user requests changes, overwrite `mock.html` in the current `v_N` directory (do NOT create a new version directory — version increments occur only at Steps D or E).

When the user approves the mock, check whether it diverged from the current `DASHBOARD-PLAN.md` or `design-tokens.md` (e.g., KPIs were added or removed, chart types changed, layout was adjusted, new colors introduced). If it did, update those root-level files to reflect the approved mock before moving on to Step D.

When presenting the mock, attach a brief review checklist:
- the layout fits cleanly within the minimum dashboard frame
- no chart or control is clipped or extends out of bounds
- chart proportions look deliberate, with no oversized empty areas
- any fallback-driven design choices are stated explicitly
- any interaction that is illustrative rather than Tableau-exact is identified explicitly

> **Important — this is an iterative process.** The HTML mock is unlikely to be correct on the first attempt. Multiple revision cycles are expected and normal. Encourage the user to share the mock with stakeholders before approving. A thoroughly validated mock prevents significant rework in later steps (D and E). Invest time here — it is easier to iterate on the mock than to rebuild the implementation spec or workbook.
