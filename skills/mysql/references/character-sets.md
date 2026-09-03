---
title: Character Sets and Collations
description: Charset config guide
tags: mysql, character-sets, utf8mb4, collation, encoding
---

# Character Sets and Collations

## Always Use utf8mb4
MySQL's `utf8` is actually `utf8mb3` (3-byte only, no emoji or many CJK characters). Always use `utf8mb4`.

```sql
CREATE DATABASE myapp DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

## Collation Quick Reference
| Collation | Behavior | Use for |
|---|---|---|
| `utf8mb4_0900_ai_ci` | Case-insensitive, accent-insensitive | Default |
| `utf8mb4_0900_as_cs` | Case/accent sensitive | Exact matching |
| `utf8mb4_bin` | Byte-by-byte comparison | Tokens, hashes |

`_0900_` targets Unicode 9.0 and is preferred over the older `_unicode_` variants.

## Collation Behavior

Collations govern string comparisons, sort order (`ORDER BY`), and pattern matching (`LIKE`):

- **Case-insensitive (`_ci`)**: `'A' = 'a'` is true; `LIKE 'a%'` matches 'Apple'
- **Case-sensitive (`_cs`)**: `'A' = 'a'` is false; `LIKE 'a%'` matches only lowercase values
- **Accent-insensitive (`_ai`)**: `'e' = 'é'` is true
- **Accent-sensitive (`_as`)**: `'e' = 'é'` is false
- **Binary (`_bin`)**: strict byte-by-byte comparison (the most restrictive option)

Collation can be overridden at the query level:

```sql
SELECT * FROM users
WHERE name COLLATE utf8mb4_0900_as_cs = 'José';
```

## Migrating from utf8/utf8mb3

```sql
-- Find columns still using utf8
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'mydb' AND character_set_name = 'utf8';
-- Convert
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

**Warning**: index key length limits vary by InnoDB row format:
- DYNAMIC/COMPRESSED: 3072 bytes maximum (≈768 chars with utf8mb4)
- REDUNDANT/COMPACT: 767 bytes maximum (≈191 chars with utf8mb4)

`VARCHAR(255)` with utf8mb4 occupies up to 1020 bytes (4×255). This is within the DYNAMIC/COMPRESSED limit but exceeds the REDUNDANT/COMPACT limit.

## Connection
Confirm the client is configured for `utf8mb4`: `SET NAMES utf8mb4;` (most modern drivers already default to this).

`SET NAMES utf8mb4` configures three session variables:
- `character_set_client` (encoding used for statements sent to the server)
- `character_set_connection` (encoding used for statement processing)
- `character_set_results` (encoding used for results returned to the client)

It also sets `collation_connection` to the default collation associated with utf8mb4.
