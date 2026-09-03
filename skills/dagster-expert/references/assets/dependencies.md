---
title: Asset Dependencies
triggers:
  - "asset dependencies, parameter-based deps, deps= external dependencies"
---

# Asset Dependencies

## Parameter-Based Dependencies

When an asset depends on another Dagster-managed asset, declare it as a function parameter. Dagster relies on an **IOManager** to load the upstream asset's output into memory and deliver it as a Python object.

```python
@dg.asset
def upstream_asset() -> dict:
    return {"data": [1, 2, 3]}

@dg.asset
def downstream_asset(upstream_asset: dict) -> list:
    # upstream_asset is loaded into memory via IOManager
    return upstream_asset["data"]
```

- The parameter name must match the upstream asset's function name (or asset key)
- Dagster automatically materializes the upstream first, then loads and passes its output
- Creates a visible dependency edge in the asset graph
- Use this approach when you want Dagster to handle data transfer between assets

## `deps=` Dependencies

Use `deps=` to express a data dependency **for lineage and scheduling purposes only**. The asset function does NOT receive the upstream data. The function itself handles data retrieval (e.g. querying a database directly), or an external process makes the data available.

```python
@dg.asset(deps=["external_table", "raw_file"])
def processed_data() -> None:
    # No upstream values passed in — read from sources directly
    pass
```

- Establishes ordering and lineage without coupling data transfer
- Use when the upstream asset produces no return value, is external, or data is managed outside Dagster's IOManager system
- The dependency still influences scheduling: Dagster recognizes that `processed_data` must run after `external_table`

## Mixed Dependencies

Combine both patterns when an asset has some IOManager-managed inputs alongside loose data dependencies:

```python
@dg.asset(deps=["raw_file"])
def enriched_data(reference_table: dict) -> dict:
    # reference_table: loaded via IOManager (parameter-based dep)
    # raw_file: declared dependency only, accessed manually
    return {"enriched": reference_table}
```
