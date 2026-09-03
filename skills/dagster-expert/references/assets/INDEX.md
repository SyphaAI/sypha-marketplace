---
title: Asset Patterns
type: index
triggers:
  - "defining assets, dependencies, metadata, partitions, or multi-asset definitions"
---

# Asset Patterns

## When to Use Each Pattern

- **Basic `@dg.asset`** — straightforward one-to-one transformation
- **Parameter-based dependency** — asset depends on another managed asset, with data loaded via IOManager
- **`deps=` dependency** — asset depends on an external or non-Python asset, expressing a data dependency only
- **`@multi_asset`** — a single operation yields multiple related assets
- **`@graph_asset`** — multiple op steps are required to produce a single asset
- **`@graph_multi_asset`** — complex pipeline producing multiple assets from composed ops
- **Asset factory** — programmatically generate many similar assets

## Quick Notes on Basic Patterns

**Basic `@dg.asset`:** The function name becomes the asset key. The docstring becomes the description shown in the UI. A return type annotation is optional but encouraged.

**Asset groups:** Apply `group_name=` on the decorator to visually organize assets in the UI. Typical groupings include data layer (`raw`, `staging`, `analytics`), domain (`sales`, `marketing`), or source (`postgres`, `api`).

**Key prefixes:** Use `key_prefix=["warehouse", "raw"]` to give asset keys a hierarchical namespace (e.g. `warehouse/raw/orders`). This is helpful for multi-tenant or layered architectures.

**Configuration:** Subclass `dg.Config` with typed fields and add it as a parameter to your asset function. Those fields become configurable at launch time.

**Execution context:** Pass `context: dg.AssetExecutionContext` as a parameter to gain access to `context.log`, `context.asset_key`, `context.partition_key` (when partitioned), and `context.run_id`.

**Return types:** Assets may return data directly (delivered to downstream assets via IOManager) or `dg.MaterializeResult` (for metadata, or `dg.MaterializeResult[T]` for data plus metadata). `MaterializeResult[T]` is preferred over `dg.Output[T]` in new code.

## Common Anti-Patterns

- **Verb-based names** like `load_customers` — use nouns that describe the output: `customers`
- **Giant asset doing everything** — break it into focused, composable assets
- **No type annotations** — include a return type: `-> dict`, `-> None`
- **No docstring** — provide a description via docstring or `description=`
- **Ignoring `MaterializeResult`** — emit metadata to improve observability

## Reference Files

<!-- BEGIN GENERATED INDEX -->

- [Advanced Asset Patterns](./advanced-patterns.md) — @multi_asset, @graph_asset, @graph_multi_asset, or asset factories; MaterializeResult, dynamic metadata, MetadataValue types
- [Asset Definition Properties](./definition-metadata.md) — asset metadata, tags, owners, groups, key_prefix, code_version, AssetSpec properties
- [Asset Dependencies](./dependencies.md) — asset dependencies, parameter-based deps, deps= external dependencies
<!-- END GENERATED INDEX -->
