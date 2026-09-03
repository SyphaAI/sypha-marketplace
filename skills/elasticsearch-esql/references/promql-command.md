# ES|QL PROMQL Command

Run queries against time series indices using **Prometheus Query Language (PromQL)** as a source command within ES|QL. The `PROMQL`
command serves as the entry point for users already familiar with PromQL or those migrating Prometheus dashboards and alerts to an
Elasticsearch backend, while still allowing them to post-process results using standard ES|QL pipes.

> **Version:** `PROMQL` is a **preview** feature introduced in Elastic Stack **9.4** and available on Elastic Cloud Serverless.
> Treat it as preview — syntax, options, and supported PromQL functions are subject to change in future releases. See
> [esql-version-history.md](esql-version-history.md) for version availability.

## Table of Contents

- [When to Use PROMQL](#when-to-use-promql)
- [Syntax](#syntax)
- [Options](#options)
- [Output Columns](#output-columns)
- [Implicit Range Selectors](#implicit-range-selectors)
- [Examples](#examples)
- [Post-Processing with ES|QL](#post-processing-with-esql)
- [PROMQL vs TS](#promql-vs-ts)
- [Limitations](#limitations)
- [Kibana Time Filtering](#kibana-time-filtering)
- [Guidelines](#guidelines)
- [References](#references)

---

## When to Use PROMQL

Choose `PROMQL` when **any** of the following conditions apply:

- The user explicitly requests a PromQL query, references Prometheus syntax (`sum by (instance) (...)`, label matchers
  like `{cluster="prod"}`, etc), or is porting a Prometheus dashboard or alert. If the user explicitly requests
  PromQL but the query is not yet supported (check [Limitations](#limitations) below), describe the limitation.
- Interoperability with Prometheus tooling is required (Grafana panels, alerting rules, scripts that already use PromQL).

Choose the [`TS` command](time-series-queries.md) when:

- The user wrote ES|QL (or is phrasing requests in natural language without PromQL terminology) and the query is more naturally written using
  the inner/outer aggregation paradigm (`SUM(RATE(...))`, `AVG(AVG_OVER_TIME(...))`).
- The query combines time series with non-time-series data sources or relies on ES|QL features like `LOOKUP JOIN`,
  `CHANGE_POINT`, or `INLINE STATS` _before_ the metrics aggregation.

Both `PROMQL` and `TS` target the same TSDS indices — select the command whose syntax best fits the user's intent.

---

## Syntax

```esql
PROMQL [ <option> ... ] [ <result_name> = ] ( <PromQL expression> )
```

- Any number of space-separated `key=value` options (zero or more).
- A PromQL expression, optionally enclosed in parentheses and assigned a `<result_name>`.
- The expression must follow standard
  [Prometheus query language](https://prometheus.io/docs/prometheus/latest/querying/basics/) syntax (label matchers,
  range selectors, aggregations, binary operations) subject to the [Limitations](#limitations) listed below.

### Minimal example

```esql
PROMQL sum by (instance) (rate(http_requests_total))
```

### Named result

```esql
PROMQL http_rate = (sum by (instance) (rate(http_requests_total)))
```

When a `<result_name>` is specified, the metric column takes that name rather than the raw PromQL expression text. In
the example above, the column is named `http_rate`.

---

## Options

These options correspond to the Prometheus [HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/#range-queries)
with additional ES|QL-specific parameters.

| Option            | Default     | Description                                                                                                           |
| ----------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `index`           | `metrics-*` | Indices, data streams, or aliases. Supports wildcards and date math.                                                  |
| `step`            | inferred    | Query resolution step width. Auto-derived from `buckets` and the time range when omitted.                             |
| `buckets`         | `100`       | Target bucket count for auto-step derivation. Mutually exclusive with `step`. Requires a known time range.            |
| `start`           | inferred    | Inclusive start of the time range. Falls back to Kibana's date picker, or unrestricted if missing.                    |
| `end`             | inferred    | Inclusive end of the time range. Falls back to Kibana's date picker, or unrestricted if missing.                      |
| `scrape_interval` | `1m`        | Expected metric collection interval. Used as the implicit range selector window: `max(step, scrape_interval)`.        |
| `<result_name>=`  | _none_      | Optional name for the metric output column. Defaults to the PromQL expression text. Wrap the expression in `( ... )`. |

**Time format for `start` / `end`:** ISO-8601 strings (e.g., `"2026-04-01T00:00:00Z"`). Any format accepted by
`TRANGE` is also valid here.

**`step` vs `buckets`:** Provide exactly one. `step` sets a fixed resolution (`step=5m`); `buckets` instructs the engine to choose a
step that yields approximately N buckets across the time range (`buckets=50`).

---

## Output Columns

The result table has these columns:

| Column                                                  | Type      | Description                                                     |
| ------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| The PromQL expression (or `<result_name>` if specified) | `double`  | The computed metric value                                       |
| `step`                                                  | `date`    | Timestamp for each evaluation step                              |
| Grouping labels (when `by (...)` or `without (...)`)    | `keyword` | One column per grouping label                                   |
| `_timeseries`                                           | `keyword` | JSON-encoded labels when there is no `by`/`without` aggregation |

When the PromQL expression contains a cross-series aggregation such as `sum by (instance) (...)`, each grouping label
becomes a separate column (`instance:keyword`). Without a cross-series aggregation, all labels are collapsed into a single
`_timeseries` column encoded as a JSON string.

---

## Implicit Range Selectors

In standard PromQL, range vector functions require an explicit range selector: `rate(http_requests_total[5m])`. The
`PROMQL` command **permits omitting the range selector** entirely:

```esql
PROMQL scrape_interval=15s sum(rate(http_requests_total))
```

When no range selector is provided, the window is derived automatically as `max(step, scrape_interval)`. This is
especially convenient for Kibana dashboards where `step` is driven by the date picker and the range vector should
scale accordingly.

An explicit range selector can still be provided when a fixed window is needed: `rate(http_requests_total[5m])`.

---

## Examples

### Fully adaptive query (recommended for Kibana)

Allow Kibana's date picker to control the time range while `step` and the range selector are derived automatically:

```esql
PROMQL index=metrics-* sum by (instance) (rate(http_requests_total))
```

The query reacts to the date picker, adjusts step size to match the selected range, and sizes the implicit range
selector window to match. This is the recommended approach for dashboard panels.

### Range query with explicit parameters

```esql
PROMQL index=k8s step=5m start="2024-05-10T00:20:00.000Z" end="2024-05-10T00:25:00.000Z" (
  sum(avg_over_time(network.cost[5m]))
)
```

| sum(avg_over_time(network.cost[5m])):double | step:date                |
| ------------------------------------------- | ------------------------ |
| 50.25                                       | 2024-05-10T00:20:00.000Z |

### Cross-series aggregation by label

```esql
PROMQL index=k8s step=1h result=(sum by (cluster) (network.cost))
| SORT result
```

| result:double | step:datetime            | cluster:keyword |
| ------------- | ------------------------ | --------------- |
| 15.875        | 2024-05-10T00:00:00.000Z | staging         |
| 18.625        | 2024-05-10T00:00:00.000Z | prod            |
| 26.5          | 2024-05-10T00:00:00.000Z | qa              |

### Label filtering with named result

```esql
PROMQL index=k8s step=1h cost=(max by (cluster) (network.total_bytes_in{cluster!="prod"}))
| SORT cluster
```

| cost:double | step:datetime            | cluster:keyword |
| ----------- | ------------------------ | --------------- |
| 10797.0     | 2024-05-10T00:00:00.000Z | qa              |
| 7403.0      | 2024-05-10T00:00:00.000Z | staging         |

### Ad-hoc query with inferred step

For queries run outside Kibana, provide `start` and `end` explicitly. The step and range selector window are still derived from
the time range and the default `buckets` value:

```esql
PROMQL index=metrics-*
  start="2026-04-01T00:00:00Z"
  end="2026-04-01T01:00:00Z"
  sum by (instance) (rate(http_requests_total))
```

### Bucket count instead of fixed step

```esql
PROMQL index=metrics-*
  buckets=50
  start="2026-04-01T00:00:00Z"
  end="2026-04-01T01:00:00Z"
  sum(rate(http_requests_total))
```

---

## Post-Processing with ES|QL

Since `PROMQL` is a source command, its output feeds directly into the remaining pipeline stages. ES|QL commands following the
PROMQL stage can perform additional aggregation, filtering, ordering, and enrichment:

```esql
PROMQL index=k8s step=1h bytes=(max by (cluster) (network.bytes_in))
| STATS max_bytes = MAX(bytes) BY cluster
| SORT cluster
```

| max_bytes:double | cluster:keyword |
| ---------------- | --------------- |
| 931.0            | prod            |
| 972.0            | qa              |
| 238.0            | staging         |

### Enrich with LOOKUP JOIN

Combine PromQL results with a lookup index by using a grouping label as the join key:

```esql
PROMQL index=metrics-*
  http_rate=(sum by (instance) (rate(http_requests_total)))
| LOOKUP JOIN instance_metadata ON instance
```

This approach combines PromQL's ability to express time series calculations with ES|QL's strengths for joining external metadata,
applying filters, and shaping the output.

---

## PROMQL vs TS

| Aspect              | `PROMQL`                                    | `TS`                                               |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| Syntax              | Prometheus Query Language                   | ES\|QL inner/outer aggregation                     |
| Default index       | `metrics-*`                                 | None — caller must specify                         |
| Time filtering      | `start`/`end` options or Kibana date picker | `WHERE TRANGE(...)` or `WHERE @timestamp ...`      |
| Bucketing           | `step` / `buckets` options                  | `BY TBUCKET(interval)`                             |
| Range vector window | Implicit (`max(step, scrape_interval)`)     | Bucket interval, or sliding window arg (9.3+)      |
| Counter aggregation | `sum(rate(metric))`                         | `STATS SUM(RATE(metric)) BY TBUCKET(...)`          |
| Gauge aggregation   | `avg_over_time(metric[5m])`                 | `STATS AVG(AVG_OVER_TIME(metric)) BY TBUCKET(...)` |
| Label filtering     | `metric{cluster="prod"}`                    | `WHERE cluster == "prod"`                          |
| Available since     | 9.4 (preview)                               | 9.2 (preview)                                      |

Both commands operate on TSDS indices and support the same set of downstream ES|QL processing commands (`WHERE`, `EVAL`,
`STATS`, `SORT`, `LIMIT`, `LOOKUP JOIN`, etc.).

---

## Limitations

In the 9.4 preview, `PROMQL` carries the following limitations:

- **Group modifiers are not supported.** Constructs such as `on(chip) group_left(chip_name)` will fail. Use `LOOKUP JOIN`
  in ES|QL after the PROMQL stage to attach additional labels.
- **Set operators are not supported.** `or`, `and`, and `unless` between PromQL expressions are unavailable. Encode set
  logic in ES|QL after the PROMQL stage instead.
- **Some PromQL functions are unavailable.** In particular, `histogram_quantile`, `predict_linear`, and `label_join` are not
  supported. Use `TS` with `PERCENTILE_OVER_TIME` for percentile-style metrics, or compute the equivalent in ES|QL.
- **Time bucket alignment differs.** Buckets align to fixed calendar boundaries rather than the query start time, which
  may introduce small discrepancies compared to native Prometheus, especially for short ranges or large step sizes.
- **Index defaults to `metrics-*`.** If your TSDS data resides elsewhere, always set `index` explicitly to avoid scanning
  unrelated indices.
- **Preview status.** Behavior, supported PromQL surface, and option names may evolve before general availability.

When a request requires a feature in this list, fall back to the [`TS` command](time-series-queries.md) and express the
equivalent computation using ES|QL.

---

## Kibana Time Filtering

When authoring `PROMQL` queries for Kibana (Discover, dashboards, alerts), **do not set `start` and `end` manually**.
Kibana automatically injects the date picker's range and the engine derives `step` from it. Providing `start`/`end`
explicitly overrides the date picker.

```esql
// Kibana — let the date picker drive start/end and step
PROMQL index=metrics-* sum by (instance) (rate(http_requests_total))
```

For ad-hoc queries run outside Kibana (HTTP API, `node scripts/esql.js raw "..."`), specify `start` and `end` explicitly.

---

## Guidelines

- **Reserve `PROMQL` for users who are explicitly reasoning in PromQL** or migrating a Prometheus query or dashboard.
  In all other cases, prefer `TS` — it integrates more naturally with the broader ES|QL syntax and is GA in 9.4.
- **Always specify `index`** in production queries rather than relying on the `metrics-*` default — narrowing the index pattern reduces
  scan volume and prevents unintended matches against unrelated indices.
- **Use named results** (`http_rate=(...)`) when piping into additional ES|QL commands. Named columns are simpler to reference
  than the raw PromQL expression text.
- **Drop range selectors for adaptive dashboards.** Implicit range selectors (`rate(http_requests_total)` without
  `[5m]`) let the query automatically scale with the date picker.
- **Choose either `step` or `buckets`, not both.** Use `buckets` when targeting a specific panel resolution; use `step` when
  a fixed grain is required (for example, to align with a downstream aggregation).
- **Fall back to `TS` for unsupported features.** Histograms (`histogram_quantile`), set logic (`or`/`and`/`unless`),
  group modifiers, and `label_join` are unavailable — express the equivalent computation using ES|QL primitives instead.
- **Do not combine `WHERE @timestamp` filters with `start`/`end`.** Time filtering should be handled through PROMQL options or
  Kibana's date picker; standard ES|QL `WHERE` clauses execute _after_ the PromQL stage and do not constrain the metric scan.

---

## References

- [ES|QL PROMQL command](https://www.elastic.co/docs/reference/query-languages/esql/commands/promql) — official
  documentation
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/) — PromQL fundamentals
- [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/#range-queries) — origin of the option
  semantics
- [Time series data streams (TSDS)](https://www.elastic.co/docs/manage-data/data-store/data-streams/time-series-data-stream-tsds)
- [time-series-queries.md](time-series-queries.md) — `TS` command and ES|QL native time series functions
- [esql-version-history.md](esql-version-history.md) — feature availability by Elasticsearch version
