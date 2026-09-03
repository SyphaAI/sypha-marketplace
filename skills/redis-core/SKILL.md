---
name: redis-core
description: >-
  Essential Redis modeling guidance — pick the appropriate data structure
  (String, Hash, List, Set, Sorted Set, JSON, Stream, Vector Set) and apply
  consistent colon-separated key names. Apply when designing a Redis data
  model, caching objects, choosing between Hash and JSON, implementing
  counters, leaderboards, membership sets, or session stores, or when
  reviewing/cleaning up Redis key naming.
metadata:
  author: 'Redis, Inc.'
  version: 0.1.0
  category: data
  source:
    repository: 'https://github.com/redis/agent-skills'
    path: skills/redis-core
    license_path: LICENSE
    commit: 3d6f25505ea2adff4dd62d5a0e7f4a5b076fa047
---

# Redis Core

Core guidance for modeling data in Redis. Addresses selecting data types and naming keys — the two decisions with the most direct impact on memory, performance, and maintainability.

## When to apply

- Caching objects, sessions, or state kept per user.
- Counters, leaderboards, lists of recent items, sets of unique members.
- Refactoring or reviewing Redis key names.
- Choosing whether an entity should be a Redis Hash or a JSON document.

## 1. Choose the right data structure

Select the type based on the *access pattern*, not merely the shape of the data.

| Use case | Recommended type | Why |
|---|---|---|
| Counters, simple values | String | Atomic `INCR`/`DECR`, `SET`/`GET` |
| Object whose fields update independently | Hash | Reads/writes per field, no rewriting the whole object |
| Queue, most-recent-N items | List | Push/pop at either end in O(1) |
| Unique items, checking membership | Set | O(1) `SADD`/`SISMEMBER`/`SCARD` |
| Rankings, ranges by score | Sorted Set | Ordered by score; `ZADD`/`ZRANGE`/`ZRANK` |
| Hierarchical / nested data | JSON | Updates at the path level, nested arrays, RQE indexing |
| Event log, fan-out messaging | Stream | Persistent, with consumer groups |
| Vector similarity | Vector Set | Vector storage built in, with HNSW |

**Common anti-pattern:** cramming a flat object into a serialized string. Changing a single field requires fetch + parse + mutate + rewrite. Use a Hash instead.

For the full rationale plus Python/Java examples, see [references/choose-data-structure.md](references/choose-data-structure.md).

## 2. Use consistent key names

Build keys from `colon-separated` segments in a stable hierarchy:

```
{entity}:{id}:{attribute}
user:1001:profile
user:1001:settings
order:2024:items
session:abc123
article:987:likes
game:space-invaders:leaderboard
```

General guidelines:

- **Colon-separated and lowercase.** Avoid spaces and mixed casing (`User_1001_Profile` is bad).
- **Keep keys readable but short** — keys reside in memory and show up in every command.
- **Don't make full URLs or long strings your keys.** Pull out a short identifier, or use a hash digest of the URL.
- **Add a prefix for multi-tenancy** (`tenant:42:user:7:cart`) so scans and ACLs can cleanly target a tenant.
- **Stay consistent.** Choose one convention per service and use it for every key.

For cleanup examples and edge cases, see [references/key-naming.md](references/key-naming.md).

## References

- [Redis: Choosing the right data type](https://redis.io/docs/latest/develop/data-types/compare-data-types/)
- [Redis: Keys](https://redis.io/docs/latest/develop/use/keyspace/)
