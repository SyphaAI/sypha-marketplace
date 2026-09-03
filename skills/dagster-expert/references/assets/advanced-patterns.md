---
title: Advanced Asset Patterns
triggers:
  - "@multi_asset, @graph_asset, @graph_multi_asset, or asset factories"
  - "MaterializeResult, dynamic metadata, MetadataValue types"
---

# Advanced Asset Patterns

## @multi_asset

Use this when one computation produces multiple assets. Specify outputs with `specs=[...]` using `AssetSpec`, and yield `MaterializeResult` for each asset.

```python nocheckundefined
@dg.multi_asset(
    specs=[dg.AssetSpec("users"), dg.AssetSpec("orders", deps=["users"])],
)
def load_data():
    users_df = fetch_users()
    yield dg.MaterializeResult(asset_key="users", metadata={"row_count": len(users_df)})

    # orders depend on user data for enrichment
    orders_df = fetch_orders(users_df)
    yield dg.MaterializeResult(asset_key="orders", metadata={"row_count": len(orders_df)})
```

When to use:

- A single computation yields multiple related assets
- Assets share costly setup or have computational dependencies between them

**Subsettability:** By default, every asset in a `@multi_asset` is materialized together. To enable partial materialization, set `can_subset=True` on the decorator and `skippable=True` on individual `AssetSpec`s. Inspect `context.op_execution_context.selected_asset_keys` to determine which assets were requested.

**Static metadata on specs:** `AssetSpec` accepts the same metadata parameters as `@dg.asset` — `description`, `group_name`, `owners`, `tags`, `kinds`, `deps`, `code_version`, `automation_condition`, etc. See [Asset Definition Properties](./definition-metadata.md) for details on each parameter.

## MaterializeResult

`MaterializeResult` captures dynamic metadata each time an asset materializes. Use it as the return type of `@dg.asset` or yield it inside `@multi_asset`.

```python
@dg.asset
def my_asset() -> dg.MaterializeResult:
    data = [...]
    return dg.MaterializeResult(
        metadata={
            "row_count": dg.MetadataValue.int(len(data)),
            "last_updated": dg.MetadataValue.text(str(datetime.now())),
            "sample_data": dg.MetadataValue.json(data[:5]),
        }
    )
```

`MaterializeResult[T]` can also carry a value (analogous to `Output[T]`), making it the preferred return type for new code:

```python
@dg.asset
def my_asset() -> dg.MaterializeResult[dict]:
    data = {"key": "value"}
    return dg.MaterializeResult(value=data, metadata={"size": len(data)})
```

### MetadataValue Types

- `MetadataValue.int(n)` — integer values (row counts)
- `MetadataValue.float(n)` — float values (percentages)
- `MetadataValue.text(s)` — short text values
- `MetadataValue.json(obj)` — JSON-serializable objects
- `MetadataValue.md(s)` — markdown text
- `MetadataValue.url(s)` — clickable URLs
- `MetadataValue.path(s)` — file paths
- `MetadataValue.table(records)` — tabular data

## @graph_asset

Wire multiple `@op`s together into a single asset. Each op can be retried independently — if a later step fails, earlier steps do not need to re-run.

```python
@dg.op
def fetch_data() -> dict:
    return {"raw": [1, 2, 3]}

@dg.op
def transform_data(data: dict) -> dict:
    return {"processed": [x * 2 for x in data["raw"]]}

@dg.graph_asset
def complex_asset():
    raw = fetch_data()
    return transform_data(raw)
```

When to use:

- A single asset requires several distinct processing steps
- You need independent retry capability for each step
- Steps are reusable across multiple assets

## @graph_multi_asset

Merges `@graph_asset` and `@multi_asset` — ops are composed into a pipeline that emits multiple assets.

```python nocheckundefined
@dg.graph_multi_asset(
    outs={
        "users": dg.AssetOut(),
        "orders": dg.AssetOut(),
    }
)
def etl_pipeline():
    raw_data = extract_from_api()
    cleaned = clean_data(raw_data)
    return {"users": extract_users(cleaned), "orders": extract_orders(cleaned)}
```

When to use:

- Multiple assets share complex multi-step logic
- Those steps are costly and should not be duplicated
- Stronger encapsulation is needed compared to separate assets using `deps=`
