# QUERIES.md

Add your SQL queries below, grouped under a heading that corresponds to your database type.
The agent uses the heading to select the appropriate query script.

Supported out-of-the-box: `PostgreSQL`

> **Need a different database?** Add a `query_<dbtype>.py` script to the installed skill's `scripts/` directory using the same pattern as `query_postgresql.py`, then include a matching heading section here (e.g., `## Databricks`, `## Snowflake`, `## MySQL`).

---

## PostgreSQL

```sql
-- Example: replace with your actual query
SELECT * FROM public.your_table
```

---

**Note**: Only include sections for the database(s) you are actually using.
If you also maintain files in `sample-data/`, the agent must state which source it is selecting before Step A proceeds.
