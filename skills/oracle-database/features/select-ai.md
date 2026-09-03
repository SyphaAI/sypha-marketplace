# Select AI in Oracle 26ai and 19c

Select AI is Oracle's built-in gateway to AI providers and models, including privately hosted models, for a wide range of generative and agentic AI scenarios. Select AI supports:

- **Natural language to SQL (NL2SQL)** - generate and explain SQL against your specific database schema, run generated queries, and narrate results in plain language
- **Retrieval augmented generation (RAG) on 26ai** - automated vector index creation and updates, and RAG workflows powered by AI Vector Search
- **Chat** - produce content from simple or complex custom prompts directly from the database, suitable for use cases such as email generation and sentiment analysis
- **Synthetic Data Generation (SDG)** - populate database tables with generated data to support activities such as testing and debugging applications and interfaces
- **AI agents** - construct interactive and autonomous AI agents capable of executing tasks and calling tools
- **Summarize text** - produce a condensed summary of long text with a choice of output style and processing method
- **Translate text** - invoke AI provider translation services to convert content from one language to another, simplifying application development and helping translate LLM output to the desired language

To use Select AI in SQL clients:

- `SELECT AI <action> <prompt>` after activating your AI profile
- `DBMS_CLOUD_AI.GENERATE(...)` for stateless or programmatic invocation

To use Select AI Agent in SQL clients:

- `SELECT AI AGENT <prompt>` after configuring your AI agent team
- `DBMS_CLOUD_AI_AGENT.RUN_TEAM`


The `SELECT AI` SQL command-line syntax is not supported in Database Actions or APEX Service. Use `DBMS_CLOUD_AI.GENERATE` in those environments instead.

## How Select AI Works for NL2SQL

1. A natural language prompt is submitted.
2. Select AI enriches the prompt with schema metadata drawn from the active AI profile.
3. Select AI transmits the assembled prompt to the configured AI provider.
4. Select AI returns either the generated SQL, query results with a natural-language summary, or a natural-language explanation, depending on the action specified.

For SQL generation, Oracle sends schema metadata only — not table contents. For `narrate`, Select AI may forward result data or retrieved content to the LLM unless an administrator has disabled data access.

## Prerequisites

At a minimum, the following are required:

- A credential for the AI provider
- An AI profile created via `DBMS_CLOUD_AI.CREATE_PROFILE`
- For stateful SQL command-line use, the profile must be activated in the current session with `DBMS_CLOUD_AI.SET_PROFILE`

In most environments, an administrator must also grant `EXECUTE` on `DBMS_CLOUD_AI` (and on `DBMS_CLOUD_AI_AGENT` when using AI agents) and enable outbound network access to the provider endpoint.

```sql
-- 1. Create credentials for the AI provider
BEGIN
  DBMS_CLOUD.CREATE_CREDENTIAL(
    credential_name => 'OPENAI_CRED',
    username        => 'OPENAI',
    password        => 'sk-...'   -- your API key
  );
END;
/

-- 2. Create an AI profile
BEGIN
  DBMS_CLOUD_AI.CREATE_PROFILE(
    profile_name => 'MY_AI_PROFILE',
    attributes   => '{"provider": "openai",
                      "credential_name": "OPENAI_CRED",
                      "object_list": [{"owner": "HR", "name": "EMPLOYEES"},
                                      {"owner": "HR", "name": "DEPARTMENTS"}],
                      "comments": true,
                      "temperature": 0}'
  );
END;
/

-- 3. Set the profile for the current session
EXEC DBMS_CLOUD_AI.SET_PROFILE('MY_AI_PROFILE');
```

## Select AI Syntax

The SQL syntax is:

```sql
SELECT AI action natural_language_prompt
```

`runsql` is the default action, making the action keyword optional.

```sql
-- RUNSQL: generate SQL and execute it
SELECT AI how many employees are in each department;

-- SHOWSQL: generate SQL but do not execute it
SELECT AI SHOWSQL how many employees were hired last year;

-- EXPLAINSQL: explain the generated SQL in natural language
SELECT AI EXPLAINSQL show the top 10 employees by salary;

-- NARRATE: execute the SQL and summarize the result in natural language
SELECT AI NARRATE what are the total sales by region this quarter;

-- CHAT: send the prompt directly to the LLM
SELECT AI CHAT what is the difference between a fact table and a dimension table;

-- SHOWPROMPT: display the constructed prompt Oracle sends to the model
SELECT AI SHOWPROMPT show the top 10 employees by salary;
```

Oracle AI Database also supports actions:

- `SUMMARIZE` for summarizing text and large files
- `FEEDBACK` for improving future SQL generation based on user feedback (26ai capability)
- `TRANSLATE` for OCI-backed translation
- `AGENT` for Select AI Agent team execution

## Supported AI Providers

| Provider | `provider` Value | Notes |
|---|---|---|
| OpenAI | `openai` | General LLM provider support |
| Cohere | `cohere` | General LLM provider support |
| Azure OpenAI | `azure` | Requires Azure resource and deployment attributes |
| OCI Generative AI | `oci` | Required for `translate`; may also need OCI-specific attributes |
| Google | `google` | Gemini/Vertex-backed provider support |
| Anthropic | `anthropic` | Claude-backed provider support |
| Hugging Face | `huggingface` | 26ai provider option |
| AWS Bedrock | `aws` | General LLM provider support |
| OpenAI-compatible API providers | Specify `provider_endpoint` | General LLM provider support |
| Privately hosted AI models | `x` |

Model availability differs by provider and Oracle release, so prefer examples that avoid hard-coding a specific model name unless a particular model is required.

See [Manage AI Profiles](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/select-ai-manage-profiles.html) for more information.

```sql
-- OCI Generative AI example
BEGIN
  DBMS_CLOUD_AI.CREATE_PROFILE(
    profile_name => 'OCI_AI_PROFILE',
    attributes   => '{"provider": "oci",
                      "credential_name": "OCI_CRED",
                      "object_list": [{"owner": "SALES", "name": "ORDERS"}]}'
  );
END;
/
```

## Profile Attributes

The following lists a selection of commonly used attributes

| Attribute | Description | Notes |
|---|---|---|
| `provider` | AI provider name | Required |
| `credential_name` | Name of the `DBMS_CLOUD` credential | Required |
| `object_list` | JSON array of schemas/tables/views allowed for NL2SQL | Optional in 26ai; required in 19c |
| `object_list_mode` | Specifies whether to send metadata for all objects in object_list or the most relevant objects to the LLM | Optional; values `all` or `automated`; 26ai feature |
| `model` | Provider model name | Optional; exact values vary by provider |
| `max_tokens` | Maximum response tokens | Optional; default is provider/package dependent |
| `temperature` | Randomness for generation | Optional; Lower values are more deterministic |
| `seed` | Enhance reproducible results or results with less variability from the LLM | Optional |
| `comments` | Include table/column comments in prompt metadata | Optional; true/false |
| `constraints` | Enable referential integrity constraints in metadata sent to LLM | Optional; true/false |
| `annotations` | Enable referential integrity constraints in metadata sent to LLM | Optional; true/false; 26 AI feature |
| `conversation` | Enable short-term conversation history | Optional boolean |

See [Select AI Profile Attributes](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/dbms-cloud-ai-package.html#GUID-12D91681-B51C-48E0-93FD-9ABC67B0F375) for more information.

```sql
-- Profile with comments enabled and more deterministic generation
BEGIN
  DBMS_CLOUD_AI.CREATE_PROFILE(
    profile_name => 'PRECISE_PROFILE',
    attributes   => '{"provider": "openai",
                      "credential_name": "OPENAI_CRED",
                      "object_list": [{"owner": "SALES"}],
                      "comments": true,
                      "seed": 12345,
                      "temperature": 0}'
  );
END;
/
```

## Improving Results with Table Comments

When `comments` is enabled in the profile, Oracle can include table and column comments in the prompt sent to the LLM. Schemas with thorough comments consistently yield better SQL generation. On 26ai, annotations are additionally supported through the `annotations` attribute.

```sql
-- Add descriptive comments so the LLM understands the schema
COMMENT ON TABLE sales.orders IS
  'Customer purchase orders. Each row is one order.';

COMMENT ON COLUMN sales.orders.status IS
  'Order lifecycle status: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED';

COMMENT ON COLUMN sales.orders.total_amount IS
  'Order total in USD including tax and shipping';
```

## Managing Profiles

```sql
-- List profiles in your schema
SELECT profile_name, status, description
FROM   user_cloud_ai_profiles
ORDER  BY profile_name;

-- List attributes for one profile
SELECT profile_name, attribute_name, attribute_value
FROM   user_cloud_ai_profile_attributes
WHERE  profile_name = 'MY_AI_PROFILE'
ORDER  BY attribute_name;

-- Disable a profile
EXEC DBMS_CLOUD_AI.DISABLE_PROFILE('MY_AI_PROFILE');

-- Enable a profile
EXEC DBMS_CLOUD_AI.ENABLE_PROFILE('MY_AI_PROFILE');

-- Clear the active session profile without dropping it
BEGIN
  DBMS_CLOUD_AI.CLEAR_PROFILE;
END;
/

-- Check the active session profile
SELECT DBMS_CLOUD_AI.GET_PROFILE()
FROM   DUAL;

-- Drop a profile
BEGIN
  DBMS_CLOUD_AI.DROP_PROFILE(profile_name => 'MY_AI_PROFILE');
END;
/
```

## Security Considerations

- For `runsql`, `showsql`, and `explainsql`, Oracle transmits schema metadata to the LLM — not table contents.
- The metadata can include object names, column names, data types, and optionally comments and other prompt-enrichment information.
- `narrate` (for both SQL and RAG workflows) as well as synthetic data generation can forward result data or retrieved document content to the LLM.
- An administrator can globally disable those data-forwarding capabilities using `DBMS_CLOUD_AI.DISABLE_DATA_ACCESS`.
- Generated SQL executes under the current session user's privilege set; VPD and row-level security apply normally.
- `SELECT AI` cannot execute PL/SQL, DDL, or DML statements.

```sql
-- Administrator-only: disable sending result data and RAG content to the LLM
BEGIN
  DBMS_CLOUD_AI.DISABLE_DATA_ACCESS();
END;
/
```

## Using SELECT AI Programmatically

Use `DBMS_CLOUD_AI.GENERATE` when stateless calls, per-call profile overrides, or programmatic invocation from PL/SQL or an application layer are needed.

```sql
DECLARE
  v_result CLOB;
BEGIN
  v_result := DBMS_CLOUD_AI.GENERATE(
    prompt       => 'how many employees are in each department',
    profile_name => 'MY_AI_PROFILE',
    action       => 'showsql'
  );

  DBMS_OUTPUT.PUT_LINE(v_result);
END;
/
```

## Python Access

For Python applications, select the interface based on the level of Select AI-specific workflow your application requires:

- Use `python-oracledb` to run `SELECT AI ...` statements or to call `DBMS_CLOUD_AI` / `DBMS_CLOUD_AI_AGENT` when the application already handles standard SQL execution.
- Use Oracle's `select_ai` Python library when Python-native objects are needed for profiles, conversations, vector indexes, synthetic data generation, feedback, async workflows, or agent teams.
- Keep generic driver concerns — pooling, bind variables, LOBs, transaction control — documented in `db/appdev/python-oracledb.md`.

## Ambiguous Table Name Handling

When similar table names exist across multiple schemas, narrow the profile scope using `object_list`.

Use `SET_ATTRIBUTE` to update a single attribute or `SET_ATTRIBUTES` to update several at once. Do not use `SET_PROFILE` to modify profile attributes.

```sql
-- Narrow object_list to explicit owner.object combinations
BEGIN
  DBMS_CLOUD_AI.SET_ATTRIBUTE(
    profile_name    => 'MYAPP_AI',
    attribute_name  => 'object_list',
    attribute_value => '[{"owner":"HR","name":"EMPLOYEES"},
                         {"owner":"HR","name":"DEPARTMENTS"},
                         {"owner":"SALES","name":"ORDERS"}]'
  );
END;
/
```

## Session vs Stateless Usage

`SELECT AI` always operates against the active session profile. To override the profile on a per-call basis, use `DBMS_CLOUD_AI.GENERATE(profile_name => ...)`.

```sql
-- Set a default profile for the session
EXEC DBMS_CLOUD_AI.SET_PROFILE('MYAPP_AI');

-- Session-based SELECT AI call
SELECT AI SHOWSQL list the top 10 customers by revenue;

-- Stateless call with an explicit profile override
SELECT DBMS_CLOUD_AI.GENERATE(
         prompt       => 'list the top 10 customers by revenue',
         profile_name => 'FINANCE_AI',
         action       => 'showsql'
       )
FROM   dual;

-- Check the active session profile
SELECT DBMS_CLOUD_AI.GET_PROFILE()
FROM   dual;
```

## Feedback for NL2SQL Refinement

Use Select AI feedback to iteratively improve SQL generation for NL2SQL actions such as `RUNSQL`, `SHOWSQL`, and `EXPLAINSQL`. Feedback is not the mechanism for correcting RAG grounding.

```sql
-- Feedback on a specific prompt
SELECT AI FEEDBACK FOR QUERY
  "select ai showsql how many watch histories in total",
  please use sum instead of count;

-- Feedback on a specific generated SQL statement
SELECT AI FEEDBACK please use sum instead of count for sql_id 1v1z68ra6r9zf;

-- Positive feedback on the most recent generated SQL
SELECT AI FEEDBACK the result is correct;
```

Use `DBMS_CLOUD_AI.FEEDBACK` when feedback must originate from SQL or PL/SQL rather than the `AI` keyword interface. Treat feedback as profile-level state: maintain separate profiles for distinct business domains and avoid shared-session application patterns in which unrelated users write feedback into the same profile.

## Synthetic Data Generation

Synthetic data generation uses `DBMS_CLOUD_AI.GENERATE_SYNTHETIC_DATA` — not `CHAT`, `NARRATE`, or standard SQL generation. Use it for development, testing, demos, or metadata clones where structure and variety are more important than production accuracy.

```sql
-- Single table form
BEGIN
  DBMS_CLOUD_AI.GENERATE_SYNTHETIC_DATA(
    profile_name => 'GENAI',
    owner_name   => 'HR',
    object_name  => 'EMPLOYEES',
    record_count => 100,
    user_prompt  => 'Use realistic department and job combinations'
  );
END;
/

-- Multi-table form
BEGIN
  DBMS_CLOUD_AI.GENERATE_SYNTHETIC_DATA(
    profile_name => 'GENAI',
    object_list  => '[{"owner":"HR","name":"DEPARTMENTS","record_count":5},
                      {"owner":"HR","name":"EMPLOYEES","record_count":100}]'
  );
END;
/
```

Large generation jobs are tracked in status tables following the naming pattern `SYNTHETIC_DATA$<operation_id>_STATUS`. Start with low `record_count` values, review the generated data, then scale up.

## Select AI Agent Lifecycle

Use Select AI Agent when the workflow requires explicitly defined teams, agents, tasks, tools, and multi-step orchestration. Simpler one-shot generation should remain with `SELECT AI <action>` or `DBMS_CLOUD_AI.GENERATE`.

The standard lifecycle is:

1. Create agents using `DBMS_CLOUD_AI_AGENT.CREATE_AGENT`.
2. Create tools using `DBMS_CLOUD_AI_AGENT.CREATE_TOOL`.
3. Create tasks using `DBMS_CLOUD_AI_AGENT.CREATE_TASK`.
4. Assemble a team using `DBMS_CLOUD_AI_AGENT.CREATE_TEAM`.
5. Execute with `SELECT AI AGENT ...` or `DBMS_CLOUD_AI_AGENT.RUN_TEAM`.

Built-in tool categories include SQL, RAG, web search, notification, and custom PL/SQL. Treat tool creation as explicit configuration — never assume a prompt can access arbitrary tools unless those tools have been created and enabled.

## History and Observability

Use `V$CLOUD_AI_SQL` to review SQL-generation history and the conversation views to examine conversation-backed prompt history.

```sql
-- Find the SQL_ID for a previously issued Select AI statement
SELECT sql_id
FROM   v$cloud_ai_sql
WHERE  sql_text = 'select ai showsql how many movies are in each genre';

-- Review conversation prompt history in your schema
SELECT conversation_id,
       prompt_action,
       prompt,
       prompt_response,
       created
FROM   user_cloud_ai_conversation_prompts
ORDER  BY created DESC
FETCH  FIRST 20 ROWS ONLY;
```

## Error and Provider Outage Handling

Provider or network failures raised by `DBMS_CLOUD_AI.GENERATE` typically appear as `ORA-20000` or `ORA-29273`. Catch those errors in PL/SQL and fall back to manual review when the provider is unavailable.

```sql
DECLARE
  v_sql CLOB;
BEGIN
  v_sql := DBMS_CLOUD_AI.GENERATE(
    prompt       => 'how many employees are in each department',
    profile_name => 'MY_AI_PROFILE',
    action       => 'showsql'
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE IN (-20000, -29273) THEN
      v_sql := NULL;
      DBMS_OUTPUT.PUT_LINE('Provider call failed; fall back to manual SQL review.');
    ELSE
      RAISE;
    END IF;
END;
/
```

## Views vs Base Tables in object_list

- Select AI works with both views and base tables in `object_list`
- Prefer views in production environments so that sensitive columns can be hidden, names can be stabilized, and common joins or derived metrics can be pre-encoded
- Views are particularly valuable when the base schema uses opaque column names or exposes fields that should never be visible to the LLM

```sql
-- Create a SELECT AI-safe view with only the columns you want exposed
CREATE OR REPLACE VIEW ai_employees AS
SELECT employee_id, job_id, department_id, hire_date, salary
FROM   employees;

-- Include the view in the AI profile instead of the base table
-- "object_list": [{"owner":"HR","name":"AI_EMPLOYEES"}]
```

## Best Practices

- Use `SHOWSQL` first and review the generated SQL before relying on `RUNSQL` in production workflows.
- Keep the metadata scope narrow by using a focused `object_list` or schema-level scoping.
- Prefer views with business-friendly names, pre-joined relationships, and precomputed KPIs for frequently issued prompts.
- Enable `comments` and/or `annotations` and populate tables and columns with meaningful descriptive text.
- Use low `temperature` settings, typically `0`, to obtain more deterministic SQL generation.
- In Database Actions or APEX Service, invoke `DBMS_CLOUD_AI.GENERATE` instead of `SELECT AI`.
- Treat `narrate` as a prose output channel, not a structured data API.
- For translation, use an OCI profile and set the `target_language` attribute.

## Common Mistakes

**Trying to edit attributes with `SET_PROFILE`** — use `SET_ATTRIBUTE` or `SET_ATTRIBUTES` to modify profile metadata such as `object_list`, `temperature`, or `comments`.

**Using a single profile for the entire enterprise schema** — excessive metadata raises ambiguity and increases token pressure. Scope the profile to a minimal set of objects or use `automated` object_list_mode.

**Exposing raw base tables instead of views** — doing so makes it easier for the LLM to select incorrect columns or surface sensitive fields.

**Using `narrate` when structured output is required** — `narrate` returns prose; use `showsql` or `runsql` when SQL or row data is needed.

**Assuming the `SELECT AI` command line works everywhere** — use `DBMS_CLOUD_AI.GENERATE` in Database Actions and APEX Service.

## Oracle Version Notes

- **26ai**: This guide targets the 26ai Select AI feature set, including `showprompt`, feedback, summarize, translate, agent integration, richer observability, and broader provider support
- **Autonomous Database 19c**: Supports Select AI summarization, but not the full 26ai feature set described in this guide

## See Also

- [AI Profiles and Provider Configuration](../features/ai-profiles.md) — Provider-specific profile setup details
- [DBMS_VECTOR and DBMS_VECTOR_CHAIN](../features/dbms-vector.md) — RAG and vector-enabled AI workflows
- [AI Vector Search in Oracle](../features/vector-search.md) — Embeddings and semantic retrieval in Oracle
- [Natural Language to SQL Mapping Patterns](../agent/nl-to-sql-patterns.md) — Manual NL-to-SQL guidance for agent workflows

## Sources

- [Select AI Online Documentation](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/select-ai.html)
- [Select AI Agent Online Documentation](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/select-ai-agent1.html)
- [Oracle AI Database 26ai Select AI User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/oracle-database-select-ai-users-guide.pdf)
- [DBMS_CLOUD_AI Package Reference](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/dbms-cloud-ai-package.html)
- [DBMS_CLOUD_AI_AGENT Package Reference](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/dbms-cloud-ai-agent-package.html)
- [DBMS_CLOUD_AI Views](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/dbms_cloud_ai-views.html)
- [Examples of Using Select AI](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/select-ai-examples.html)
- [Select AI for Python](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/select-ai-python.html)
- [Synthetic Data Generation](https://docs.oracle.com/en-us/iaas/autonomous-database-shared/doc/select-ai-synthetic-data-generation.html)
- [Verify, Observe, and Secure your Generative AI usage with Oracle Autonomous AI Database Select AI](https://blogs.oracle.com/machinelearning/verify-observe-and-secure-your-gen-ai-usage-with-adb-select-ai)
- [6 Simple Tips for Better Text-to-SQL Generation using Oracle Autonomous Database Select AI](https://blogs.oracle.com/machinelearning/6-simple-tips-for-better-texttosql-generation-using-oracle-autonomous-database-select-ai)
