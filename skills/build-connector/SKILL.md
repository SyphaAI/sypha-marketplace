---
name: build-connector
description: >-
  Build a new Fivetran connector from a description. Use when the user wants to
  create, generate, or scaffold a new connector for an API or data source.
metadata:
  upstream:
    argument-hint: >-
      Describe the connector (e.g., 'Stripe API connector for payments and
      customers')
  category: data
  source:
    repository: 'https://github.com/fivetran/connector_sdk_tools'
    path: canonical/skills/build-connector
    license_path: LICENSE
    commit: cb22799a357f1620e1d3653cad13cbdc7b2f862d
---

> **Context**: This plugin is for the Fivetran Connector SDK (CSDK). "CSDK" is shorthand for "Connector SDK".

# Build a New Fivetran Connector

**FIRST**: Read `sdk-reference.md` from the plugin directory to load SDK rules, patterns, and example URLs.

Your task is to build a complete Fivetran connector based on the user's description. This skill coordinates the overall build; the detailed logic for each phase resides in the plugin's workflow files.

## Phase 0: Determine the Best Build Approach

**Before doing any API research or code generation**, evaluate whether a simpler path is available. A custom CSDK connector requires the user to write and maintain code; alternative paths may allow Fivetran to manage the connector on their behalf. Always present better options to the user before proceeding with a custom build.

Run all three checks in sequence and share the results with the user. The user makes the final decision — if they prefer a custom build even when a managed option is available, proceed to Phase 1.

### Check 1: Is there already a Fivetran connector for this source?

Fetch all five category pages in parallel using WebFetch and search each one for the source name the user mentioned (case-insensitive fuzzy match):

- https://fivetran.com/docs/connectors/databases
- https://fivetran.com/docs/connectors/events
- https://fivetran.com/docs/connectors/files
- https://fivetran.com/docs/connectors/functions
- https://fivetran.com/docs/connectors/applications

For each fetch, ask: "List all connector names on this page, one per line."

- **If a match or close match is found on any page**, inform the user:

  > *"Would you prefer to use our **{Match}** managed native connector or need to customize it for your use case? The connector is maintained by Fivetran — no code to write or maintain. You can configure it directly in the Fivetran dashboard."*

  Wait for the user's response. If they select the managed connector, stop and point them to the Fivetran dashboard. If they want a custom CSDK connector instead, jump directly to Phase 1.

- **If no match is found**, the applications page may be incomplete (it is a large list and can be truncated). As a fallback, probe a few direct URL slug variations using WebFetch — try the most plausible slugs derived from the source name (lowercase, spaces converted to hyphens, common abbreviations) across all categories:

  ```
  https://fivetran.com/docs/connectors/applications/{slug}
  https://fivetran.com/docs/connectors/databases/{slug}
  https://fivetran.com/docs/connectors/files/{slug}
  https://fivetran.com/docs/connectors/events/{slug}
  ```

  For example, for "Google Analytics 4" try: `google-analytics-4`, `google-analytics`. For "Amazon RDS for MySQL" try: `amazon-rds-mysql`, `mysql-rds`. Fetch 2–3 variations — if any page returns a valid connector description, a match exists.

  If the slug probes also return nothing, notify the user:

  > *"I didn't find **{Source}** in Fivetran's connector catalog, but the catalog may be incomplete. Please quickly verify at https://fivetran.com/integrations before we proceed."*

  Continue to Check 2 once the user confirms.

### Check 2: Is this a good fit for a Lite Connector (AI builder)?

Lite Connectors are built using Fivetran's AI builder and are **managed by Fivetran** — the customer does not write or maintain any code. Docs: https://fivetran.com/docs/connectors/applications/lite-connectors

Criteria for recommending Lite:
- Source is a **SaaS application** (not a database, file system, event stream, or in-house system)
- Exposes a **REST API** with **JSON responses**
- Uses **standard authentication** (API key, Bearer token, or OAuth 2)
- No complex stateful logic or heavy transformations needed

If the user's source meets these criteria, tell them:

> *"Based on what you described, **{Source}** looks like a good fit for a Fivetran [Lite Connector](https://fivetran.com/docs/connectors/applications/lite-connectors). Lite Connectors are built with Fivetran's AI builder and are **managed by Fivetran** — you won't have to write or maintain any connector code. Fivetran handles API changes, bug fixes, and upgrades. Want to try the Lite path first? It's typically faster to set up and lower ongoing maintenance than a custom CSDK connector."*

Wait for the user's answer. If they choose the Lite path, stop and point them to the Lite Connector builder. If they prefer custom CSDK, continue to Phase 1.

### Check 3: Proceed with custom CSDK

If neither Check 1 nor Check 2 yielded a better option, or the user explicitly opted for custom CSDK, proceed to Phase 1.

## Phase 1: Research & Validate Requirements

Apply the validator workflow — read `workflows/validator.md` from the plugin directory (or, in plugins that support subagents, invoke the `connector-validator` subagent) to research the API and generate a complete specification **along with a discovery result**: `EXACT MATCH`, `FUZZY MATCH`, or `BUILD ON TEMPLATE`.

**Pause and wait** for the user to respond to any clarifying questions the validator raises before moving to Phase 2.

## Phase 2: Scaffold the Project with `fivetran init`

`fivetran init` is the authoritative scaffolding path — it generates a complete, runnable connector with the correct structure (`validate_configuration()`, docstrings, the `__main__` block). **Always scaffold with `fivetran init`; never write the project from scratch by hand.** Select the appropriate command based on the Phase 1 discovery result. The project directory name is the connector name in lowercase with underscores.

- **EXACT MATCH / FUZZY MATCH** — start from the community connector:
  ```bash
  printf '\n' | fivetran init "<connector_dir>" --template connectors/<name> --force
  ```
- **BUILD ON TEMPLATE** — start from the default template:
  ```bash
  printf '\n' | fivetran init "<connector_dir>" --force
  ```

Windows PowerShell: replace `printf '\n' |` with `"" |`.

**Why the piped newline and `--force`:** `fivetran init` unconditionally runs an interactive "which coding agent shall we install the plugin for?" prompt, and no flag can skip it. `--force` auto-confirms project creation and file overwrites; the piped empty line answers the agent prompt with an invalid choice, causing it to log `invalid choice; skipping agent setup` (this is **expected and benign** — the plugin is already installed) before continuing.

**Confirm success by verifying that `<connector_dir>/connector.py` exists**, rather than relying on the exit code — an exhausted input pipe can cause `init` to exit non-zero even after files have downloaded correctly. `connectors/<name>` resolves to the `community_connectors` repo; `examples/<path>` resolves to `connector_sdk`.

## Phase 3: Customize the Scaffolded Files

Apply the generator workflow — read `workflows/generator.md` (or invoke the `connector-generator` subagent) to bring the **already-scaffolded** files into alignment with the Phase 1 specification using `Edit` (do not rewrite from scratch). For an EXACT MATCH, the connector may require few or no changes beyond configuration; for FUZZY/BUILD ON TEMPLATE, review 2–4 relevant SDK examples and adapt `connector.py`, `configuration.json`, and `README.md` to match the spec. Preserve the template structure (`validate_configuration()`, docstrings, global `connector = Connector(...)`, the `__main__` block).

## Phase 4: Setup Environment

`fivetran init` will have already created `requirements.txt` (or `pyproject.toml`). Set up the virtual environment and install dependencies using commands appropriate for the user's OS:

macOS/Linux:
```bash
cd "<project_directory>"
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt fivetran_connector_sdk
```

Windows PowerShell:
```powershell
cd "<project_directory>"
uv venv .venv
uv pip install --python .\.venv\Scripts\python.exe -r requirements.txt fivetran_connector_sdk
```

## Phase 5: Enter Configuration & Test

Once scaffolding and file customization are complete (or when existing files with placeholder values are found), configuration values must be supplied through the encryption script. This is **non-negotiable** and **not a user choice** — it is the only supported flow for entering configuration.

**HARD RULES — violating any of these is a failure:**
- DO NOT use `AskUserQuestion` (or any choice-menu / multi-option UI) to ask how the user wants to supply configuration values. There is exactly one way.
- DO NOT present "Paste in chat", "Edit the file yourself", "Use a public repo", or any other alternative as a configuration-entry option.
- DO NOT instruct the user to paste configuration values in chat.
- DO NOT accept values pasted in chat.
- DO NOT run `enter_configuration.py` yourself. The user must execute it in a separate terminal.
- DO NOT inspect or print configuration values.

**THE ONLY ACCEPTABLE FLOW.** Send the following message to the user as plain text (substitute `<plugin>` with the actual plugin directory path and `<connector_dir>` with the connector directory). Use a single fenced command block: `bash` on macOS/Linux, `powershell` on Windows. Quote both paths. Do not insert a line break inside the `python` command.

````text
I've generated the connector files (or the files already exist). To fill in configuration values securely, open a separate terminal, then run:

```bash
cd "<connector_dir>"
python "<plugin>/tools/enter_configuration.py" "configuration.json"
```

The script will prompt you for each configuration field and encrypt values in place. I never see plaintext configuration values. Let me know when it's done and I'll run the test.
If the local encryption secret file does not exist yet, the script creates it first.
````

Once the user confirms that configuration values have been entered, run the connector through the secure runner:

```bash
python <plugin>/tools/run_connector.py <connector_dir>
```

This decrypts encrypted configuration values in memory, passes any user-chosen plaintext values through, and delivers the runtime config via named pipe.

Check results:

macOS/Linux:
```bash
.venv/bin/python -c "
import duckdb
conn = duckdb.connect('files/warehouse.db')
tables = conn.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'tester'\").fetchall()
print(f'Tables synced: {len(tables)}')
for (t,) in tables:
    count = conn.execute(f'SELECT COUNT(*) FROM tester.{t}').fetchone()[0]
    print(f'  tester.{t}: {count} rows')"
```

Windows PowerShell:
```powershell
.\.venv\Scripts\python.exe -c 'import duckdb; conn = duckdb.connect("files/warehouse.db"); tables = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = ''tester''").fetchall(); print("Tables synced:", len(tables)); [print("  tester." + t + ": " + str(conn.execute("SELECT COUNT(*) FROM tester." + t).fetchone()[0]) + " rows") for (t,) in tables]; conn.close()'
```

Report: tables synced, row counts, and any errors encountered.

## Phase 6: Auto-Fix on Failure

If the test fails:

1. Review the error output carefully.
2. Classify the error:
   - **INFRA error** (network, JVM, SDK internal): describe the infrastructure issue to the user. Do NOT modify code.
   - **FIRST_RUN error** (connector has never succeeded — likely credentials/config): help the user verify their config. Do NOT modify code.
   - **CODE error** (syntax, logic, SDK misuse): apply the fixer workflow — read `workflows/fixer.md` (or invoke the `connector-fixer` subagent). Re-run the test after fixing.
   - **TOOL error** (`run_connector.py` fails): report the issue to the user. Do NOT modify plugin tools.

**IMPORTANT**: Never modify plugin tools. Only fix the user's connector code.
