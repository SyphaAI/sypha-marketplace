---
title: Asset Definition Properties
triggers:
  - "asset metadata, tags, owners, groups, key_prefix, code_version, AssetSpec properties"
---

# Asset Definition Properties

## Decorator Parameters

Set once at asset definition time:

```python
@dg.asset(
    description="Detailed description for the UI",
    group_name="analytics",
    key_prefix=["warehouse", "staging"],
    owners=["team:data-engineering", "user@example.com"],
    tags={"priority": "high", "pii": "true", "domain": "sales"},
    code_version="1.2.0",
)
def my_asset() -> None:
    pass
```

- **owners** — identify a team (`team:name`) or individuals responsible for the asset
- **tags** — the primary organizational tool; use freely for filtering and grouping (also consumed by asset selection and automation conditions)
- **code_version** — record when asset logic changes to support lineage and debugging
- **description** — describe what the asset represents and its business purpose (a docstring works too)
- **group_name** — visual grouping in the UI; use for data layers or domains
- **key_prefix** — builds the asset key as `AssetKey([*prefix, fn_name])`, e.g. `key_prefix=["warehouse", "raw"]` on a function named `orders` yields `AssetKey(["warehouse", "raw", "orders"])`. Use the `name` argument to override the function name portion (helpful in factory patterns that produce many assets from one function).

## Setting Properties on AssetSpec

For `@multi_asset`, apply the same properties to each `AssetSpec`:

```python nocheckundefined
@dg.multi_asset(
    specs=[
        dg.AssetSpec(
            "users",
            group_name="raw_data",
            owners=["team:data-engineering"],
            tags={"priority": "high"},
            description="Raw user records from API",
        ),
        dg.AssetSpec(
            "orders",
            group_name="raw_data",
            deps=["users"],
        ),
    ],
)
def load_data():
    ...
```

`AssetSpec` supports the same metadata parameters as `@dg.asset`: `description`, `group_name`, `owners`, `tags`, `kinds`, `deps`, `code_version`, `automation_condition`, `key_prefix`, and more.
