---
title: "dbt: Dependencies"
triggers:
  - "understanding or defining upstream dependencies for dbt models"
---

# Dependencies

## How Dependencies Work

Dagster reads the dependency graph already encoded in your dbt project:

- dbt `ref()` calls establish dependencies between models
- dbt `source()` calls establish dependencies on upstream assets

## Defining Upstream Dagster Assets

Declare a Dagster asset as a dbt source in `sources.yml`:

```yaml
sources:
  - name: dagster
    tables:
      - name: my_upstream_asset
```

Then refer to it in your dbt model:

```sql
select * from {{ source('dagster', 'my_upstream_asset') }}
```

This establishes a data dependency where the dbt model reads from the Dagster asset.

## Adding Dependencies via Jinja Comments

To introduce dependencies that are not captured in dbt's data lineage (e.g., scheduling constraints without actual data
reading), add a Jinja comment in your model:

```sql
-- depends_on: {{ source('dagster', 'upstream') }}

SELECT ...
```

When dbt compiles the project, it processes this Jinja template and appends the source to the model's
dependency list in the manifest. Dagster then reads the manifest and creates the corresponding dependency edge. This
establishes a scheduling dependency without requiring the model to SELECT from that source.
