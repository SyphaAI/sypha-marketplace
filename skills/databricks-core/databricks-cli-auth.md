# Databricks CLI Authentication

Covers Databricks CLI workspace and profile configuration, including profile switching, the --profile flag, the DATABRICKS_CONFIG_PROFILE environment variable, OAuth2 authentication (PAT is never used), and how to resolve authentication problems.

## Important: Always Use OAuth

**CRITICAL**: OAuth2 is the required authentication method for the Databricks CLI. **NEVER recommend or use Personal Access Tokens (PAT)** except when a particular use case explicitly demands it.

## Prerequisites

1. The Databricks CLI must already be installed
   - Verify: `databricks --version`
2. Access to a Databricks workspace is required
3. The workspace URL must be available (e.g., `https://adb-1111111111111111.10.azuredatabricks.net`)

## Agent Shell Behavior

**CRITICAL**: Each Bash command the agent executes in a separate tool call may run in its own **separate shell session**. This directly affects how profile configuration behaves:

### Key Differences from Regular Terminal

1. **Environment variables don't persist between commands**
   - `export DATABRICKS_CONFIG_PROFILE=staging` in one command
   - `databricks jobs list` in the next command
   - ❌ **Result**: The second command will NOT use the staging profile

2. **Recommended Approach: Use --profile flag**
   - Supply `--profile <profile-name>` explicitly with every command
   - Example: `databricks jobs list --profile staging`
   - ✅ **Result**: Consistent and predictable behavior

3. **Alternative: Chain commands with &&**
   - Use `export DATABRICKS_CONFIG_PROFILE=staging && databricks jobs list`
   - Both the export and the command execute within the same shell session
   - ✅ **Result**: Works correctly

### Quick Reference for Isolated Agent Shells

```bash
# ✅ RECOMMENDED: Use --profile flag
databricks jobs list --profile staging
databricks apps list --profile prod-azure

# ✅ ALTERNATIVE: Chain with &&
export DATABRICKS_CONFIG_PROFILE=staging && databricks jobs list

# ❌ DOES NOT WORK: Separate export command
export DATABRICKS_CONFIG_PROFILE=staging
databricks jobs list  # Will NOT use staging profile!
```

## Handling Authentication Failures

When a Databricks CLI command fails with an authentication error:
```
Error: default auth: cannot configure default credentials
```

**CRITICAL - Always follow this workflow:**

1. **Check for existing profiles first:**
   ```bash
   databricks auth profiles
   ```

2. **If profiles exist:**
   - Present the available profiles to the user (including workspace URLs and validation status)
   - Ask: "Which profile would you like to use for this command?"
   - Offer the option to create a new profile if needed
   - Re-run the command with `--profile <selected-profile-name>`
   - **For agent-run commands, always use the `--profile` flag** rather than relying on persistent environment variables

3. **If user wants a new profile or no profiles exist:**
   - Continue to the OAuth Authentication Setup workflow below

**Example:**
```
User: databricks apps list
Error: default auth: cannot configure default credentials

Assistant: Let me check for existing profiles.
[Runs: databricks auth profiles]

You have two configured profiles:
1. aws-dev - https://company-workspace.cloud.databricks.com (Valid)
2. azure-prod - https://adb-1111111111111111.10.azuredatabricks.net (Valid)

Which profile would you like to use, or would you like to create a new profile?

User: dais

Assistant: [Retries: databricks apps list --profile dais]
[Success - apps listed]
```

## OAuth Authentication Setup

### Standard Authentication Command

OAuth with a named profile is the preferred authentication method:

```bash
databricks auth login --host <workspace-url> --profile <profile-name>
```

**CRITICAL**:
1. The `--profile` parameter is **REQUIRED** for credentials to be stored correctly.
2. **ALWAYS ASK THE USER** for their preferred profile name - DO NOT assume or select one on their behalf.
3. **NEVER use the profile name `DEFAULT`** unless the user explicitly requests it - opt for descriptive, workspace-specific names instead.

### Workflow for Authenticating

1. **Ask the user for the workspace URL** if it has not been provided yet
2. **Ask the user for their preferred profile name**
   - Propose descriptive names derived from the workspace (e.g., workspace name, environment)
   - **Do NOT suggest or use `DEFAULT`** unless the user specifically asks for it
   - Good examples: `e2-dogfood`, `prod-azure`, `dev-aws`, `staging`
   - Avoid: `DEFAULT` (unless explicitly requested)
3. Execute the authentication command with both parameters supplied
4. Confirm that authentication completed successfully

### Example

```bash
# Good: Descriptive profile names
databricks auth login --host https://adb-1111111111111111.10.azuredatabricks.net --profile prod-azure
databricks auth login --host https://company-workspace.cloud.databricks.com --profile staging

# Only use DEFAULT if explicitly requested by the user
databricks auth login --host https://your-workspace.cloud.databricks.com --profile DEFAULT
```

### What Happens During Authentication

1. The CLI launches a local OAuth callback server (typically on `localhost:8020`)
2. A browser window opens automatically to the Databricks login page
3. You complete authentication in the browser with your Databricks credentials
4. Once authentication succeeds, the browser redirects control back to the CLI
5. The CLI writes the OAuth tokens to `~/.databrickscfg`
6. You should see: `Profile <profile-name> was successfully saved`

## Profile Management

### What Are Profiles?

Profiles let you maintain configurations for multiple Databricks workspaces within a single `~/.databrickscfg` file. Each profile holds:
- The workspace host URL
- The authentication method (OAuth, PAT, etc.)
- Token and credential paths

### Common Profile Names

**IMPORTANT**: Profile names should always be descriptive. Do NOT create a profile named `DEFAULT` unless the user explicitly asks for it.

**Recommended naming conventions**:
- `<workspace-name>` - Human-readable names tied to the workspace (e.g., `e2-dogfood`, `prod-aws`, `dev-azure`)
- `<environment>` - Names that reflect the deployment environment (e.g., `dev`, `staging`, `prod`)
- `<team>-<environment>` - Names combining team and environment (e.g., `data-eng-prod`, `ml-dev`)

**Special profile names**:
- `DEFAULT` - The fallback profile used when neither a `--profile` flag nor environment variables are present. Create this profile only if the user explicitly requests it.

### Listing Configured Profiles

List all configured profiles along with their current status:

```bash
databricks auth profiles
```

Example output:
```
Name        Host                                                 Valid
DEFAULT     https://adb-1111111111111111.10.azuredatabricks.net  YES
staging     https://company-workspace.cloud.databricks.com       YES
```

### Using Different Profiles

**IMPORTANT FOR AGENT RUNS**: Commands may run in separate shell sessions, so an environment variable exported in one command may not carry over to the next. Refer to the agent-shell guidance above.

There are three methods for specifying which profile or workspace to target, listed in order of precedence:

#### 1. CLI Flag (Highest Priority) - RECOMMENDED FOR AGENT RUNS

Attach the `--profile` flag directly to any command:

```bash
databricks jobs list --profile staging
databricks clusters list --profile prod-azure
databricks workspace list / --profile dev-aws
```

**For agent-run commands, this is the most reliable method** because it does not depend on environment variables persisting across shell invocations.

#### 2. Environment Variables

Use environment variables to override the default profile selection:

**DATABRICKS_CONFIG_PROFILE** - Selects which profile from `~/.databrickscfg` to activate:
```bash
export DATABRICKS_CONFIG_PROFILE=staging
databricks jobs list  # Uses staging profile
```

**DATABRICKS_HOST** - Sets the workspace URL directly, skipping profile resolution entirely:
```bash
export DATABRICKS_HOST=https://company-workspace.cloud.databricks.com
databricks jobs list  # Uses this host directly
```

**CRITICAL - Isolated Agent Shells:**

When each Bash command executes in its own shell, you **CANNOT** do this:

```bash
# ❌ DOES NOT WORK across separate agent commands
export DATABRICKS_CONFIG_PROFILE=staging
databricks jobs list  # ERROR: Will not use staging profile!
```

Instead, you **MUST** choose one of the following approaches:

**Option 1: Use --profile flag (RECOMMENDED)**
```bash
# ✅ WORKS in isolated agent shells
databricks jobs list --profile staging
databricks clusters list --profile staging
```

**Option 2: Chain commands with &&**
```bash
# ✅ WORKS in isolated agent shells - export and command run in same shell
export DATABRICKS_CONFIG_PROFILE=staging && databricks jobs list
export DATABRICKS_CONFIG_PROFILE=staging && databricks clusters list
```

**Traditional Terminal Session (for reference only)**:
```bash
# This example shows how it works in a regular terminal session
# DO NOT use this pattern across separate agent commands
# Set profile for entire terminal session
export DATABRICKS_CONFIG_PROFILE=staging

# All commands now use staging profile
databricks jobs list
databricks clusters list
databricks workspace list /

# Override for a single command
databricks jobs list --profile prod-azure
```

#### 3. DEFAULT Profile (Lowest Priority)

When neither a `--profile` flag nor any environment variables are present, the CLI falls back to the `DEFAULT` profile in `~/.databrickscfg`.

### Configuration File Management

#### Viewing the Configuration File

All configuration is kept in `~/.databrickscfg`:

```bash
cat ~/.databrickscfg
```

Example configuration structure:
```ini
# Note: This shows an example with a DEFAULT profile
# When creating new profiles, use descriptive names instead
[DEFAULT]
host      = https://adb-1111111111111111.10.azuredatabricks.net
auth_type = databricks-cli

[staging]
host      = https://company-workspace.cloud.databricks.com
auth_type = databricks-cli
```

#### Editing Profiles

Direct edits to `~/.databrickscfg` can be used to:
- Rename a profile (update the `[profile-name]` section header)
- Change workspace URLs
- Delete a profile (remove its entire section)

**Example - Removing a profile**:
```bash
# Open in your preferred editor
vi ~/.databrickscfg

# Or use sed to remove a specific profile section
sed -i '' '/^\[staging\]/,/^$/d' ~/.databrickscfg
```

#### Adding New Profiles

New profiles should always be added through `databricks auth login` with the `--profile` flag:

```bash
databricks auth login --host <workspace-url> --profile <profile-name>
```

**Remember**:
- Ask the user for their preferred profile name before proceeding
- Choose descriptive names such as `staging`, `prod-azure`, `dev-aws`
- Do NOT use `DEFAULT` unless the user explicitly asks for it

### Working with Multiple Workspaces

Follow these best practices when working across multiple workspaces:

```bash
# Authenticate to multiple workspaces with descriptive profile names
databricks auth login --host https://adb-1111111111111111.10.azuredatabricks.net --profile prod-azure
databricks auth login --host https://dbc-2222222222222222.cloud.databricks.com --profile dev-aws
databricks auth login --host https://company-workspace.cloud.databricks.com --profile staging
```

**For agent-run commands, use --profile with each command (RECOMMENDED):**
```bash
# Use profiles explicitly in commands
databricks jobs list --profile prod-azure
databricks jobs list --profile dev-aws
databricks clusters list --profile staging
```

**Alternatively, in an agent-run command, chain commands with &&:**
```bash
# Set profile and run command in same shell
export DATABRICKS_CONFIG_PROFILE=prod-azure && databricks jobs list
export DATABRICKS_CONFIG_PROFILE=prod-azure && databricks clusters list

# Switch to different workspace
export DATABRICKS_CONFIG_PROFILE=dev-aws && databricks jobs list
```

**Traditional Terminal Session (for reference only - NOT for isolated agent shells):**
```bash
# This pattern works in regular terminals but NOT across separate agent commands
export DATABRICKS_CONFIG_PROFILE=prod-azure
databricks jobs list
databricks clusters list

# Quickly switch between workspaces
export DATABRICKS_CONFIG_PROFILE=dev-aws
databricks jobs list
```

### Profile Selection Precedence

Each time a command runs, the Databricks CLI resolves the target workspace using the following priority order:

1. **`--profile` flag** (if specified) → Highest priority
2. **`DATABRICKS_HOST` environment variable** (if set) → Overrides profile
3. **`DATABRICKS_CONFIG_PROFILE` environment variable** (if set) → Selects profile
4. **`DEFAULT` profile** in `~/.databrickscfg` → Fallback

**Example for traditional terminal session** (demonstrating precedence):
```bash
# Setup
export DATABRICKS_CONFIG_PROFILE=staging

# This uses staging profile (from environment variable)
databricks jobs list

# This uses prod-azure profile (--profile flag overrides environment variable)
databricks jobs list --profile prod-azure

# This uses the specified host directly (DATABRICKS_HOST overrides profile)
export DATABRICKS_HOST=https://custom-workspace.cloud.databricks.com
databricks jobs list  # Uses custom-workspace.cloud.databricks.com
```

**Agent-shell version** (with chained commands):
```bash
# Using environment variable with && chaining
export DATABRICKS_CONFIG_PROFILE=staging && databricks jobs list

# Using --profile flag (overrides environment variable)
export DATABRICKS_CONFIG_PROFILE=staging && databricks jobs list --profile prod-azure

# Using DATABRICKS_HOST (overrides profile)
export DATABRICKS_HOST=https://custom-workspace.cloud.databricks.com && databricks jobs list
```

## Verification

Once authentication is complete, confirm it is functioning correctly:

```bash
# Test with a simple command
databricks workspace list /

# Or list jobs
databricks jobs list
```

A successful authentication will have these commands return results without any errors.

## Troubleshooting

### Authentication Not Saved (Config File Missing)

**Symptom**: Running `databricks` commands produces:
```
Error: default auth: cannot configure default credentials
```

**Solution**: Ensure you provided the `--profile` parameter with a descriptive name:
```bash
databricks auth login --host <workspace-url> --profile <profile-name>
# Example: databricks auth login --host https://company-workspace.cloud.databricks.com --profile staging
```

### Browser Doesn't Open Automatically

**Solution**:
1. Look for a URL in the terminal output
2. Copy and paste that URL into your browser manually
3. Finish the authentication flow in the browser
4. The CLI will pick up the callback on its own

### "OAuth callback server listening" But Nothing Happens

**Possible causes**:
1. A firewall is blocking localhost connections
2. Port 8020 is already occupied by another process
3. No browser is configured as the default application

**Solution**:
1. Verify that port 8020 is free: `lsof -i :8020`
2. Terminate any processes that are using that port
3. Attempt authentication again

### Multiple Workspaces

Authenticate to each workspace separately, assigning a distinct profile name to each:

```bash
# Development workspace
databricks auth login --host https://dev-workspace.databricks.net --profile dev

# Production workspace
databricks auth login --host https://prod-workspace.databricks.net --profile prod

# Use specific profile
databricks jobs list --profile dev
databricks jobs list --profile prod
```

### Re-authenticating

When your OAuth token expires or fresh authentication is needed:

```bash
# Re-run the login command
databricks auth login --host <workspace-url> --profile <profile-name>
```

This replaces the existing profile entry with the newly issued credentials.

### Debug Mode

To diagnose authentication problems, enable debug mode:

```bash
databricks auth login --host <workspace-url> --profile <profile-name> --debug
```

This outputs detailed diagnostic information about the OAuth flow, such as:
- OAuth server endpoint addresses
- Status of the callback server
- Progress of the token exchange

## Security Best Practices

1. **Never commit** `~/.databrickscfg` to any version control system
2. **Never share** OAuth tokens or the configuration file with others
3. **Use separate profiles** to isolate each environment (dev/staging/prod)
4. **Regularly rotate** credentials by running the login command again
5. **Use workspace-specific service principals** for automation and CI/CD rather than personal OAuth tokens

## Environment-Specific Notes

### CI/CD Pipelines

Interactive OAuth login is not appropriate for CI/CD environments. Use one of the following instead:
- Service Principal authentication
- Azure Managed Identity (for Azure Databricks)
- AWS IAM roles (for AWS Databricks)

**Do NOT** use personal OAuth tokens or PATs in CI/CD.

### Containerized Environments

OAuth authentication can function inside containers provided that:
1. A browser is present on the host machine
2. Port forwarding is set up for the callback server
3. The workspace URL is reachable from within the container

For headless containers, service principal authentication should be used instead.

## Common Commands After Authentication

```bash
# List workspaces
databricks workspace list / --profile <PROFILE>

# List jobs
databricks jobs list --profile <PROFILE>

# List clusters
databricks clusters list --profile <PROFILE>

# Get current user info
databricks current-user me --profile <PROFILE>

# Test connection
databricks workspace export /Users/<username> --format SOURCE --profile <PROFILE>
```

## References

- [Databricks CLI Authentication Documentation](https://docs.databricks.com/en/dev-tools/auth.html)
- [OAuth 2.0 with Databricks](https://docs.databricks.com/en/dev-tools/auth.html#oauth-2-0)
