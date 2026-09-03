---
name: mongodb-query-optimizer
description: >-
  Assists with MongoDB query optimization and indexing. Invoke only when the user
  requests optimization or performance help: "How do I optimize this query?",
  "How do I index this?", "Why is this query slow?", "Can you fix my slow
  queries?", "What are the slow queries on my cluster?", etc. Do not activate
  for general MongoDB query authoring unless the user explicitly asks for
  performance or index assistance. Prefer indexing as the primary optimization
  strategy. Use MongoDB MCP when available.
compatibility: >-
  Best with MongoDB MCP server. Uses collection-indexes and explain when the
  connection string works; uses Atlas Performance Advisor when Atlas API is
  configured. Without either, suggest indexes from query shape only. User
  creates indexes in Atlas or migrations unless tooling allows otherwise.
metadata:
  version: 1.0.0
  category: data
  source:
    repository: 'https://github.com/mongodb/agent-skills'
    path: skills/mongodb-query-optimizer
    license_path: LICENSE
    commit: 9ea7387c7a1638604542c6efd52e5efc6a7fc393
---

# MongoDB Query Optimizer

## When this skill is invoked

Invoke **only** when the user is asking about:

- Query/index **optimization** or **performance** improvements
- **Why** a query is slow or **how to make it faster**
- **Slow queries** on their cluster and/or **how to optimize them**

Do **not** invoke for routine query writing unless the user has specifically asked for help with optimization, slow queries, or indexing.

## High Level Workflow

### General Performance Help

When the user wants to examine slow queries or is looking for general performance recommendations (not tied to a particular query):

- Use the MongoDB MCP server’s **atlas-get-performance-advisor** tool to retrieve slow query logs and performance advisor output
- Formulate suggestions based on this information

If the Atlas MCP Server is not configured or you lack sufficient information to run **atlas-get-performance-advisor** against the correct cluster, inform the user that general performance analysis requires Atlas MCP Server configuration with API credentials, and suggest they either configure it or ask about a specific query instead.

### Help with a Specific Query

When the user is asking about a specific query:

- Use the **collection-indexes**, **explain**, and **find** MCP tools to retrieve existing indexes on the collection, explain() output for the query, and a sample document from the collection
- Use the **atlas-get-performance-advisor MCP** tool to fetch slow query logs and performance advisor output

Then produce an optimization recommendation based on the gathered information, MongoDB best practices, and the examples in the reference files. Where possible, prefer creating an index that fully covers the query. If MongoDB MCP Server is unavailable, still attempt to provide a suggestion.

## MCP: available tools

**How to invoke.** Call the **MongoDB MCP server** with the **exact tool name** as `toolName` and a single **arguments object** as `arguments`. Do not supply the tool name as an option, query parameter, or nested key; pass it as the MCP tool name and provide parameters as the arguments object. Full MCP Server tool reference: [MongoDB MCP Server Tools](https://www.mongodb.com/docs/mcp-server/tools/).

**Database tools** (when the MCP cluster connection works):

| Tool name (exact) | Arguments object |
| :---- | :---- |
| `collection-indexes` | `{ "database": "<db>", "collection": "<coll>" }` — both required strings. |
| `explain` | `{ "database": "<db>", "collection": "<coll>", "method": [ { "name": "find", "arguments": { "filter": {...}, "sort": {...}, "limit": N } } ], "verbosity": "executionStats" }`. `method` is an array of one object: `name` is `"find"`, `"aggregate"`, or `"count"`; `arguments` holds that method's params (e.g. find: `filter`, `sort`, `limit`; aggregate: `pipeline`; count: `query`). Optional `verbosity`: `"queryPlanner"` (default), `"executionStats"`, `"queryPlannerExtended"`, `"allPlansExecution"`. |
| `find` |  `{ "database": "<db>", "collection": "<coll>", "filter": {...}, "projection": {...}, "sort": {...}, "limit": N }` — `database`, `collection`, and `filter` are required. Optional: `projection`, `sort`, `limit`. |

**Atlas tools** (when Atlas API credentials are configured):

| Tool name (exact) | Arguments object |
| :---- | :---- |
| `atlas-list-projects` | `{}` or `{ "orgId": "<24-char hex>" }`. Returns projects with their IDs; use to get `projectId` for Performance Advisor. |
| `atlas-get-performance-advisor` | **Required:** `"projectId"` (24-character hex string), `"clusterName"` (string, 1–64 chars, alphanumeric/underscore/dash). **Optional:** `"operations"` — array of strings from `"suggestedIndexes"`, `"dropIndexSuggestions"`, `"slowQueryLogs"`, `"schemaSuggestions"` (request only what you need); for slowQueryLogs only: `"since"` (ISO 8601 date-time), `"namespaces"` (array of `"db.coll"` strings). |

For a given user question, attempt to gather information from both the connection string and the Atlas API for the query being optimized.

### 1\. DB connection string works for MongoDB MCP

Typical flow: call `collection-indexes` → `explain` → `find` (sample doc).

- **`collection-indexes`** — Examine the result's `classicIndexes` (each entry has `name` and `key`) to determine whether an existing index can already serve the query.
- **`explain`** — Start in `"queryPlanner"` mode to check for COLLSCAN. If the query already uses an index or the collection is very small, rerun with `"executionStats"` (10-second timeout) to compare docs scanned versus docs returned.

### 2\. Atlas API access works for MongoDB MCP

If a project ID is needed, call `atlas-list-projects` first. Then call `atlas-get-performance-advisor` requesting only the `operations` relevant to your analysis:

| Operation value | Use when |
| :---- | :---- |
| `slowQueryLogs` | Fetching slow queries—**prioritize by slowest and most frequent**. Optional: `namespaces` to scope to a collection; `since` for a time window. |
| `suggestedIndexes` | Fetching cluster index recommendations |
| `dropIndexSuggestions` | User asks what to remove or reduce index overhead |
| `schemaSuggestions` | User asks for schema/query-structure advice alongside indexes |

Do not supply the MCP tool name as an `operations` value — `operations` is a separate argument that specifies which data to retrieve.

## Example workflow 1 (help with specific query)

**User:** "Why is this query slow? `db.orders.find({status: 'shipped', region: 'US'}).sort({date: -1})`"

**If the MCP db connection is configured and the database and collection names are known**, execute steps 1–3. Otherwise skip to step 4.

1. **Check existing collection indexes:**
   - Call `collection-indexes` with database=`store`, collection=`orders`
   - Result shows: `{_id: 1}`, `{status: 1}`, `{date: -1}`

2. **Run explain:**
   - Call `explain` with method=`find`, filter=`{status: 'shipped', region: 'US'}`, sort=`{date: -1}`, verbosity=`queryPlanner` and `executionStats`
   - Result: Uses the `{status: 1}` index, then performs an in-memory SORT; `totalKeysExamined: 50000`, `nReturned: 100`

3. **Run find:**
   - Call `find` with limit=1 to retrieve a sample document for schema inference.

**If the MCP Atlas connection is configured**, execute step 4. Otherwise skip to step 5.

4. **Run atlas-get-performance-advisor:**
   - Attempt to derive the cluster name from the MCP connection string, or ask the user for the projectId/clusterName
   - Use slowQueryLogs to fetch slow query logs for database=`store`, collection=`orders` over the past 24 hours
   - Use suggestedIndexes to identify index recommendations for the query

5. **Diagnose:** Based on the explain output and slow query logs, this query targets 100 documents but scans 50K index entries (poor selectivity: 0.002). The in-memory sort adds additional overhead. The existing index covers neither both filter fields nor the sort.

6. **Recommend:** Create the compound index `{status: 1, region: 1, date: -1}` using ESR ordering (two equality fields followed by sort). This removes the in-memory sort stage and improves selectivity by filtering on both status and region.

If the MongoDB MCP server is not available, apply standard indexing best practices.

## Example workflow 2 (general database performance help)

**User:** "Can you help with optimizing slow queries on my cluster?”

1. **Run atlas-get-performance-advisor:**
   - Attempt to derive the cluster name from the connection string and infer the project name via atlas-list-projects; if uncertain, ask the user for the cluster name and project ID.
   - Use slowQueryLogs to fetch slow query logs from the past 24 hours
   - Use suggestedIndexes
   - Use dropIndexSuggestions
   - Use schemaSuggestions
2. **Diagnose and Recommend:** Drawing on slow query logs and performance advisor output, you can create the compound index `{status: 1, region: 1, date: -1}` on the `db.orders` collection to optimize queries such as `find({status: 'shipped', region: 'US'}).sort({date: -1})`

Review all performance advisor output alongside the slow query logs. Explain what will be improved and why, and concentrate on recommendations with the greatest potential impact (e.g., indexes that benefit the most queries or that address the worst-performing ones).

## Load references

Before starting diagnosis and recommendation, load the relevant reference files.

Always load:

- `references/core-indexing-principles.md`
- `references/antipattern-examples.md`

Load these files conditionally:

- **When diagnosing aggregation pipelines** → `references/aggregation-optimization.md`
- **When diagnosing document-modifying queries such as replaceOne, findOneAndUpdate, etc.** → `references/update-query-examples.md` for oplog-efficient updates and common update anti-patterns

## Output

- Keep responses concise and clear: a few sentences covering the index and optimization suggestions along with the reasoning (e.g., general indexing principles, observations from the cluster’s slow query logs, or advice surfaced by Performance Advisor)
- Prioritize the highest-impact indexes and optimizations — if you have omitted any, let the user know and present them when asked.
- Avoid definitive language such as “You should create these indexes and they will definitely improve application performance” — frame them as suggestions for specific queries and explain the rationale.
- Take into account the number of indexes already present on the collection (if known) — generally there should be no more than 20
- Recommend removing indexes only when the suggestion originates from Atlas Performance Advisor
- Do not create indexes directly via MCP without explicit user approval
