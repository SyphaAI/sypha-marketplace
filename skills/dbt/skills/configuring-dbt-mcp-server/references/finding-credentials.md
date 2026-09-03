## How to Locate Your Credentials

### Which Token Type Should I Use?

| Use Case | Token Type | Why |
|----------|------------|-----|
| Personal development setup | Personal Access Token (PAT) | Inherits your permissions, works with all APIs including execute_sql |
| Shared team setup | Service Token | Multiple users, controlled permissions, separate from individual accounts |
| Using execute_sql tool | PAT (required) | SQL tools that require `x-dbt-user-id` need a PAT |
| CI/CD or automation | Service Token | System-level access, not tied to a person |

### Personal Access Token (PAT)

1. Navigate to **Account Settings** → expand **API tokens** → click **Personal tokens**
2. Click **Create personal access token**
3. Provide a descriptive name and click **Save**
4. **Copy the token right away** — it will not be displayed again

**Notes:**
- Requires a Developer license
- Carries all permissions assigned to your user account
- Account-scoped: generate separate tokens for each dbt account you need to access
- Rotate on a regular basis for security

### Service Token

Use service tokens for system-level integrations (CI/CD, automation) rather than personal user access.

1. Navigate to **Account Settings** → **Service Tokens** (in the left sidebar)
2. Click **+ New Token**
3. Choose the permission set appropriate for your use case
4. **Save the token right away** — it will not be displayed again

**Permission sets for MCP:**
- **Semantic Layer Only**: For querying metrics only
- **Metadata Only**: For Discovery API access
- **Job Admin**: For Admin API (triggering jobs)
- **Developer**: For broader access

**Notes:**
- Requires a Developer license plus account admin rights to create
- Service tokens are owned by the account, not an individual user
- Service tokens cannot be used for `execute_sql` — use a PAT instead

### Account ID

1. Log in to dbt Cloud
2. Check the browser URL — the Account ID is the number that follows `/accounts/`

**Example:** In `https://cloud.getdbt.com/settings/accounts/12345/...`, the Account ID is `12345`

**Alternative:** Open **Settings** → **Account Settings** and inspect the URL.

### Environment ID (Production or Development)

1. In dbt Cloud, go to **Deploy** → **Environments**
2. Click the target environment (Production or Development)
3. Check the URL — the Environment ID is the final number in the path

**URL pattern:** `https://cloud.getdbt.com/deploy/<account_id>/projects/<project_id>/environments/<environment_id>`

**Example:** In `.../environments/98765`, the Environment ID is `98765`

### User ID

1. Navigate to **Account Settings** → **Team** → **Users**
2. Click your user profile
3. Check the URL — the number after `/users/` is your User ID

**Example:** In `https://cloud.getdbt.com/settings/accounts/12345/users/67891`, the User ID is `67891`
