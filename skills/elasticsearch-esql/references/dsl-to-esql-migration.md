# Query DSL to ES|QL Migration Guide

Use this guide to transition your Elasticsearch Query DSL (JSON-based queries) over to ES|QL (the piped query language).

## Table of Contents

- [Overview: Key Differences](#overview-key-differences)
- [Basic Query Structure](#basic-query-structure)
- [Match All Query](#match-all-query)
- [Term Query (Exact Match)](#term-query-exact-match)
- [Match Query (Full-Text Search)](#match-query-full-text-search)
- [Match Phrase Query](#match-phrase-query)
- [Multi-Match Query](#multi-match-query)
- [Query String Query](#query-string-query)
- [Range Query](#range-query)
- [Bool Query](#bool-query)
- [Exists Query](#exists-query)
- [Wildcard / Prefix Query](#wildcard--prefix-query)
- [Regexp Query](#regexp-query)
- [Aggregations](#aggregations)
- [Sorting](#sorting)
- [Field Selection (\_source)](#field-selection-_source)
- [Pagination](#pagination)
- [Script Fields](#script-fields)
- [LOOKUP JOIN (Replaces Enrichment Patterns)](#lookup-join-replaces-enrichment-patterns)
- [Filters Aggregation (Per-Aggregation WHERE)](#filters-aggregation-per-aggregation-where)
- [Pipeline Aggregations (Chained STATS)](#pipeline-aggregations-chained-stats)
- [Highlighting](#highlighting)
- [ES|QL Limitations (vs Query DSL)](#esql-limitations-vs-query-dsl)
- [Migration Checklist](#migration-checklist)
- [Performance Considerations](#performance-considerations)
- [Quick Reference Table](#quick-reference-table)

## Overview: Key Differences

| Aspect           | Query DSL               | ES\|QL                          |
| ---------------- | ----------------------- | ------------------------------- |
| Format           | JSON                    | Piped text                      |
| Execution        | Translated to Lucene    | Native execution engine         |
| Default results  | 10                      | 1,000                           |
| Max results      | 10,000 (configurable)   | 10,000 (configurable)           |
| Aggregations     | Nested JSON structure   | `STATS ... BY` command          |
| Full-text search | `match`, `query_string` | `MATCH()`, `QSTR()`, `KQL()`    |
| Scoring          | Automatic with queries  | Explicit with `METADATA _score` |

### When to Use ES|QL vs Query DSL

**Use ES|QL when:**

- Exploring logs or performing ad-hoc analysis
- Working with time-series data
- Running simple to moderately complex aggregations
- Building data transformation pipelines
- Troubleshooting interactively

**Use Query DSL when:**

- Aggregations are deeply nested
- Advanced scoring or boosting is required
- Queries target nested or parent-child documents
- You need capabilities not yet available in ES|QL (see Limitations)

---

## Basic Query Structure

### Query DSL

```json
POST /my-index/_search
{
  "query": { ... },
  "aggs": { ... },
  "sort": [ ... ],
  "size": 100,
  "_source": ["field1", "field2"]
}
```

### ES|QL

```esql
FROM my-index
| WHERE <conditions>
| STATS <aggregations> BY <groupings>
| SORT <field> DESC
| KEEP field1, field2
| LIMIT 100
```

---

## Match All Query

### Query DSL

```json
{
  "query": {
    "match_all": {}
  },
  "size": 100
}
```

### ES|QL

```esql
FROM my-index
| LIMIT 100
```

---

## Term Query (Exact Match)

### Query DSL

```json
{
  "query": {
    "term": {
      "status": "published"
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE status == "published"
```

### Multiple Terms (terms query)

#### Query DSL

```json
{
  "query": {
    "terms": {
      "status": ["published", "draft"]
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| WHERE status IN ("published", "draft")
```

---

## Match Query (Full-Text Search)

### Query DSL

```json
{
  "query": {
    "match": {
      "title": "elasticsearch guide"
    }
  }
}
```

### ES|QL (8.17+)

```esql
FROM my-index
| WHERE MATCH(title, "elasticsearch guide")
```

Alternatively, use the match operator:

```esql
FROM my-index
| WHERE title : "elasticsearch guide"
```

### With Relevance Scoring

```esql
FROM my-index METADATA _score
| WHERE MATCH(title, "elasticsearch guide")
| SORT _score DESC
| LIMIT 10
```

---

## Match Phrase Query

### Query DSL

```json
{
  "query": {
    "match_phrase": {
      "title": "quick brown fox"
    }
  }
}
```

### ES|QL (8.19+)

```esql
FROM my-index
| WHERE MATCH_PHRASE(title, "quick brown fox")
```

---

## Multi-Match Query

### Query DSL

```json
{
  "query": {
    "multi_match": {
      "query": "elasticsearch",
      "fields": ["title", "content", "tags"]
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE MATCH(title, "elasticsearch")
    OR MATCH(content, "elasticsearch")
    OR MATCH(tags, "elasticsearch")
```

For more flexibility, use QSTR:

```esql
FROM my-index
| WHERE QSTR("title:elasticsearch OR content:elasticsearch OR tags:elasticsearch")
```

---

## Query String Query

### Query DSL

```json
{
  "query": {
    "query_string": {
      "query": "status:active AND (type:blog OR type:article)"
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE QSTR("status:active AND (type:blog OR type:article)")
```

---

## Range Query

### Query DSL

```json
{
  "query": {
    "range": {
      "price": {
        "gte": 10,
        "lte": 100
      }
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE price >= 10 AND price <= 100
```

### Date Range

#### Query DSL

```json
{
  "query": {
    "range": {
      "@timestamp": {
        "gte": "now-24h",
        "lte": "now"
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| WHERE @timestamp >= NOW() - 24 hours AND @timestamp <= NOW()
```

Or more concisely:

```esql
FROM my-index
| WHERE @timestamp > NOW() - 24 hours
```

---

## Bool Query

The bool query is among the most involved DSL structures to convert.

### Query DSL

```json
{
  "query": {
    "bool": {
      "must": [{ "match": { "title": "elasticsearch" } }],
      "filter": [{ "term": { "status": "published" } }, { "range": { "date": { "gte": "2024-01-01" } } }],
      "should": [{ "term": { "featured": true } }],
      "must_not": [{ "term": { "draft": true } }]
    }
  }
}
```

### ES|QL

**Note:** ES|QL maps `must`, `filter`, and `must_not` to WHERE conditions directly. The `should` clause (optional boosting) has no direct counterpart — ES|QL does not support conditional score boosting.

```esql
FROM my-index METADATA _score
| WHERE MATCH(title, "elasticsearch")           // must
    AND status == "published"                   // filter
    AND date >= "2024-01-01"                    // filter
    AND (draft != true OR draft IS NULL)        // must_not
| EVAL featured_boost = CASE(featured == true, 100.0, 0.0)
| EVAL combined_score = _score + featured_boost // approximate should boost
| SORT combined_score DESC
```

> **Three-valued logic warning:** `draft != true` on its own filters out rows where `draft` is NULL. In Query DSL, `must_not: { term: { draft: true } }` retains documents where `draft` is absent. To reproduce that behavior in ES|QL, append `OR draft IS NULL`.
>
> **Should clause:** ES|QL cannot natively reproduce DSL `should` boosting. The `EVAL` approach shown above is only a rough approximation. When precise relevance scoring is essential, Query DSL remains the better choice.

---

## Exists Query

### Query DSL

```json
{
  "query": {
    "exists": {
      "field": "user"
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE user IS NOT NULL
```

### Does Not Exist

#### Query DSL

```json
{
  "query": {
    "bool": {
      "must_not": {
        "exists": { "field": "user" }
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| WHERE user IS NULL
```

---

## Wildcard / Prefix Query

### Query DSL

```json
{
  "query": {
    "wildcard": {
      "name": "john*"
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE name LIKE "john*"
```

Alternatively, using STARTS_WITH:

```esql
FROM my-index
| WHERE STARTS_WITH(name, "john")
```

---

## Regexp Query

### Query DSL

```json
{
  "query": {
    "regexp": {
      "name": "joh?n.*"
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| WHERE name RLIKE "joh.n.*"
```

**Note:** ES|QL applies standard regex syntax rather than Lucene regex.

---

## Aggregations

### Terms Aggregation (Group By Count)

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "status_counts": {
      "terms": {
        "field": "status",
        "size": 10
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS count = COUNT(*) BY status
| SORT count DESC
| LIMIT 10
```

### Date Histogram Aggregation

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "events_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "calendar_interval": "day"
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS count = COUNT(*) BY day = DATE_TRUNC(1 day, @timestamp)
| SORT day
```

### Date Histogram with Sub-Aggregation

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "events_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "calendar_interval": "hour"
      },
      "aggs": {
        "avg_response": {
          "avg": { "field": "response_time" }
        }
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS
    count = COUNT(*),
    avg_response = AVG(response_time)
  BY hour = DATE_TRUNC(1 hour, @timestamp)
| SORT hour
```

### Multiple Metric Aggregations

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "price_stats": {
      "stats": { "field": "price" }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS
    count = COUNT(price),
    min_price = MIN(price),
    max_price = MAX(price),
    avg_price = AVG(price),
    sum_price = SUM(price)
```

### Percentiles Aggregation

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "response_percentiles": {
      "percentiles": {
        "field": "response_time",
        "percents": [50, 95, 99]
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS
    p50 = PERCENTILE(response_time, 50),
    p95 = PERCENTILE(response_time, 95),
    p99 = PERCENTILE(response_time, 99)
```

### Cardinality Aggregation (Distinct Count)

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "unique_users": {
      "cardinality": { "field": "user_id" }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS unique_users = COUNT_DISTINCT(user_id)
```

### Filter Aggregation

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "errors": {
      "filter": { "term": { "level": "error" } },
      "aggs": {
        "count": { "value_count": { "field": "_id" } }
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| WHERE level == "error"
| STATS count = COUNT(*)
```

To retrieve both the total and the filtered count in a single query using `CASE`:

```esql
FROM my-index
| STATS
    total = COUNT(*),
    errors = COUNT(CASE(level == "error", 1, null))
```

Using per-aggregation `WHERE` (8.16+) simplifies this further:

```esql
FROM my-index
| STATS
    total = COUNT(*),
    errors = COUNT(*) WHERE level == "error"
```

### Nested Aggregations (Multiple Group By)

#### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "by_country": {
      "terms": { "field": "country" },
      "aggs": {
        "by_city": {
          "terms": { "field": "city" }
        }
      }
    }
  }
}
```

#### ES|QL

```esql
FROM my-index
| STATS count = COUNT(*) BY country, city
| SORT country, count DESC
```

---

## Sorting

### Query DSL

```json
{
  "sort": [{ "@timestamp": { "order": "desc" } }, { "name": { "order": "asc" } }]
}
```

### ES|QL

```esql
FROM my-index
| SORT @timestamp DESC, name ASC
```

---

## Field Selection (\_source)

### Query DSL

```json
{
  "_source": ["title", "author", "date"]
}
```

### ES|QL

```esql
FROM my-index
| KEEP title, author, date
```

### Exclude Fields

#### Query DSL

```json
{
  "_source": {
    "excludes": ["internal_*", "temp"]
  }
}
```

#### ES|QL

```esql
FROM my-index
| DROP internal_*, temp
```

---

## Pagination

### Query DSL

```json
{
  "from": 20,
  "size": 10
}
```

### ES|QL

ES|QL has no direct equivalent to `from`. Instead, use filtering or time-based pagination:

```esql
FROM my-index
| SORT @timestamp DESC
| LIMIT 10
```

For subsequent pages, filter using the last observed value:

```esql
FROM my-index
| WHERE @timestamp < "2024-01-15T10:30:00Z"
| SORT @timestamp DESC
| LIMIT 10
```

---

## Script Fields

### Query DSL

```json
{
  "script_fields": {
    "price_with_tax": {
      "script": {
        "source": "doc['price'].value * 1.1"
      }
    }
  }
}
```

### ES|QL

```esql
FROM my-index
| EVAL price_with_tax = price * 1.1
```

---

## LOOKUP JOIN (Replaces Enrichment Patterns)

### Query DSL

```json
{
  "query": { "match_all": {} },
  "runtime_mappings": {
    "region_name": {
      "type": "keyword",
      "script": "/* typically handled via enrich processor or application-side join */"
    }
  }
}
```

### ES|QL

To join against a lookup index, use `LOOKUP JOIN` (8.18/9.0+):

```esql
FROM orders
| LOOKUP JOIN customers_lookup ON customer_id
| KEEP order_id, customer_id, name, email, total
```

> **Note:** The lookup index must be configured with `index.mode: lookup` and is restricted to a single shard. For new queries, prefer `LOOKUP JOIN` over `ENRICH`.

---

## Filters Aggregation (Per-Aggregation WHERE)

### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "messages": {
      "filters": {
        "filters": {
          "errors": { "match": { "level": "error" } },
          "warnings": { "match": { "level": "warning" } }
        }
      }
    }
  }
}
```

### ES|QL

Using per-aggregation `WHERE` (8.16+):

```esql
FROM logs
| STATS
    errors = COUNT(*) WHERE level == "error",
    warnings = COUNT(*) WHERE level == "warning",
    total = COUNT(*)
```

---

## Pipeline Aggregations (Chained STATS)

### Query DSL

```json
{
  "size": 0,
  "aggs": {
    "sales_per_month": {
      "date_histogram": { "field": "date", "calendar_interval": "month" },
      "aggs": {
        "total_sales": { "sum": { "field": "amount" } },
        "cumulative_sales": { "cumulative_sum": { "buckets_path": "total_sales" } }
      }
    }
  }
}
```

### ES|QL

ES|QL has no direct support for pipeline aggregations. Use chained `STATS` or `INLINE STATS` (9.2+) to calculate derived aggregations:

```esql
FROM sales
| STATS monthly_total = SUM(amount) BY month = DATE_TRUNC(1 month, date)
| SORT month
```

To attach aggregated values back to individual rows without collapsing them (similar to a window function), use `INLINE STATS`:

```esql
FROM sales
| INLINE STATS avg_amount = AVG(amount) BY category
| EVAL diff_from_avg = amount - avg_amount
```

---

## Highlighting

### Query DSL

```json
{
  "query": { "match": { "content": "elasticsearch" } },
  "highlight": {
    "fields": { "content": {} }
  }
}
```

### ES|QL

**Not supported.** ES|QL does not provide highlighting. Use Query DSL when this feature is needed.

---

## ES|QL Limitations (vs Query DSL)

The following features are absent from ES|QL as of version 9.3:

| Feature                      | Query DSL | ES\|QL                                    |
| ---------------------------- | --------- | ----------------------------------------- |
| Highlighting                 | ✅        | ❌                                        |
| Nested queries               | ✅        | ❌                                        |
| Parent-child queries         | ✅        | ❌                                        |
| Scroll/pagination beyond 10k | ✅        | ❌                                        |
| Percolate queries            | ✅        | ❌                                        |
| Complex boosting             | ✅        | Limited                                   |
| Geo distance sorting         | ✅        | ❌                                        |
| Runtime fields               | ✅        | Use EVAL                                  |
| Suggest API                  | ✅        | ❌                                        |
| Collapse (field collapsing)  | ✅        | ❌                                        |
| Inner hits                   | ✅        | ❌                                        |
| Timezone support             | ✅        | ✅ `SET time_zone` (Serverless GA)        |
| JOIN (non-lookup)            | N/A       | ❌ (only LEFT JOIN on lookup index)       |
| Subqueries / UNION ALL       | N/A       | ✅ `FROM` subqueries (Serverless preview) |

### Unsupported Field Types in ES|QL

- `nested`
- `binary`
- `completion`
- `flattened` (use `METADATA _source` + `JSON_EXTRACT` to access sub-keys)
- Range types (`date_range`, `integer_range`, etc.)
- `rank_feature`, `rank_features`
- `search_as_you_type`

---

## Migration Checklist

Follow these steps when converting queries from Query DSL to ES|QL:

1. **Check field type support** - Confirm that all fields use types supported by ES|QL
2. **Review aggregation complexity** - Deeply nested aggregations may require restructuring
3. **Handle scoring requirements** - Include `METADATA _score` when relevance-based sorting is needed
4. **Adjust result limits** - ES|QL returns 1000 rows by default, with a maximum of 10000
5. **Test full-text search** - Apply the `MATCH()`, `QSTR()`, or `KQL()` functions as appropriate
6. **Validate time ranges** - ES|QL time syntax is different from DSL
7. **Check for unsupported features** - Confirm whether highlighting, nested documents, or other DSL-only features are required

---

## Performance Considerations

| Aspect           | Query DSL               | ES\|QL                 |
| ---------------- | ----------------------- | ---------------------- |
| Caching          | Filter context cached   | No equivalent caching  |
| Query planning   | Based on Lucene         | Dedicated query engine |
| Aggregations     | Can be memory-intensive | Block-based processing |
| Full-text search | Native Lucene           | Uses same analyzers    |

**ES|QL advantages:**

- Concurrent and parallel processing
- Block-based execution, which is more efficient for large scans
- No overhead from query-to-DSL translation

**Query DSL advantages:**

- More mature and established caching
- Better suited to complex scoring scenarios
- Broader feature coverage

---

## Quick Reference Table

| Query DSL                  | ES\|QL Equivalent                          |
| -------------------------- | ------------------------------------------ |
| `match_all`                | `FROM index`                               |
| `term`                     | `WHERE field == value`                     |
| `terms`                    | `WHERE field IN (...)`                     |
| `match`                    | `WHERE MATCH(field, query)`                |
| `match_phrase`             | `WHERE MATCH_PHRASE(field, query)`         |
| `query_string`             | `WHERE QSTR("...")`                        |
| `range`                    | `WHERE field >= x AND field <= y`          |
| `bool.must`                | `WHERE cond1 AND cond2`                    |
| `bool.should`              | `WHERE cond1 OR cond2`                     |
| `bool.must_not`            | `WHERE (field != val OR field IS NULL)` \* |
| `bool.filter`              | `WHERE cond` (no scoring)                  |
| `exists`                   | `WHERE field IS NOT NULL`                  |
| `wildcard`                 | `WHERE field LIKE "pattern*"`              |
| `regexp`                   | `WHERE field RLIKE "pattern"`              |
| `prefix`                   | `WHERE STARTS_WITH(field, "prefix")`       |
| `terms` agg                | `STATS count = COUNT(*) BY field`          |
| `date_histogram`           | `STATS ... BY DATE_TRUNC(interval, field)` |
| `avg`, `sum`, `min`, `max` | `STATS AVG(f), SUM(f), MIN(f), MAX(f)`     |
| `cardinality`              | `STATS COUNT_DISTINCT(field)`              |
| `percentiles`              | `STATS PERCENTILE(field, p)`               |
| `filter` agg               | `COUNT(*) WHERE cond` (8.16+)              |
| `top_hits`                 | `SORT field \| LIMIT n`                    |
| `_source`                  | `KEEP field1, field2`                      |
| `sort`                     | `SORT field DESC`                          |
| `size`                     | `LIMIT n`                                  |

\* ES|QL uses three-valued logic. `field != value` excludes NULL rows, whereas DSL `must_not` retains documents where the field is absent. Append `OR field IS NULL` to reproduce DSL behavior.
