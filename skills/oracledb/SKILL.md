---
name: oracledb
description: >-
  Apply these skills to administer and monitor Oracle databases by running SQL
  statements, inspecting schema metadata, evaluating query performance, tracking
  active sessions and resource usage, and overseeing storage and object health.
metadata:
  category: data
  source:
    repository: 'https://github.com/gemini-cli-extensions/oracledb'
    path: skills/oracledb
    license_path: LICENSE
    commit: d5a26255c6f2ffb32b5920735512629014622693
---

## Usage

All scripts are executed with Node.js. Substitute `<param_name>` and `<param_value>` with real values.

**Bash:**
`node <skill_dir>/scripts/<script_name>.js '{"<param_name>": "<param_value>"}'`

**PowerShell:**
`node <skill_dir>/scripts/<script_name>.js '{\"<param_name>\": \"<param_value>\"}'`

Note: The scripts load environment variables automatically from the relevant .env files. Do not prompt the user to set variables unless a skill execution fails because a required variable is absent.


## Scripts


### execute_sql

Runs a single read-only `SELECT` or `WITH` query by default. The wrapper rejects multiple statements, DDL, DML, transaction control, PL/SQL, `CALL`, `COPY`, `DO`, `SELECT INTO`, and row-locking queries before invoking the database tool.

#### Parameters

| Name | Type | Description | Required | Default |
| :--- | :--- | :--- | :--- | :--- |
| sql | string | One read-only SQL query to execute. | Yes |  |

Running a non-read statement requires both explicit CLI acknowledgements and must only be done after the user confirms the exact SQL:

```bash
node <skill_dir>/scripts/execute_sql.js \
  --dangerous --confirm-dangerous-sql=EXECUTE \
  '{"sql":"<confirmed non-read SQL>"}'
```


---

### get_query_plan

Produces a complete execution plan for a single `SELECT` or `WITH` query using EXPLAIN PLAN. The wrapper enforces the same read-only statement validation and the same two-flag dangerous override as `execute_sql` before calling the tool.

#### Parameters

| Name | Type | Description | Required | Default |
| :--- | :--- | :--- | :--- | :--- |
| query | string | The SQL statement for which you want to generate plan (omit the EXPLAIN keyword). | Yes |  |


---

### list_active_sessions

Returns the top N (default 50) currently active database sessions (STATUS='ACTIVE'), displaying SID, OS User, Program, and the current SQL statement text.



---

### list_invalid_objects

Enumerates all database objects currently in an invalid state that require recompilation (e.g., procedures, functions, views).



---

### list_tables

Shows all user tables in the connected schema, including segment size, row count, and last analyzed date. Accepts a comma-separated list of names as a filter. When names are omitted, all tables in the current user's schema are returned.



---

### list_tablespace_usage

Reports tablespace names, total size, free space, and used percentage to help monitor storage utilization.



---

### list_top_sql_by_resource

Retrieves the top N (default 5) SQL statements from the library cache ranked by a selected resource metric (CPU, I/O, or Elapsed Time). Displays SQL ID, execution count, buffer gets, disk reads, CPU time, and elapsed time.



---
