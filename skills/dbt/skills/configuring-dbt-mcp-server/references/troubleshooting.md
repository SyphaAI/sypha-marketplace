## Troubleshooting

### "uvx not found" or "spawn uvx ENOENT"
Locate the full path and specify it in the config:
```bash
# macOS/Linux
which uvx
# Use output like: /opt/homebrew/bin/uvx

# Windows
where uvx
```

Update config:
```json
{
  "command": "/opt/homebrew/bin/uvx",
  "args": ["dbt-mcp"]
}
```

### "Could not connect to MCP server"
1. Confirm `uvx` is installed: `uvx --version`
2. Validate paths exist: `ls $DBT_PROJECT_DIR/dbt_project.yml`
3. Confirm dbt is working: `$DBT_PATH --version`

### OAuth Not Working
OAuth is supported only for accounts with static subdomains (e.g., `abc123.us1.dbt.com`). Verify your Access URLs in the dbt platform settings.

### Remote Server Returns 401/403
- Confirm the token has Semantic Layer and Developer permissions
- For `execute_sql`: A personal access token is required — service tokens are not accepted
- Verify the environment ID is correct (available from the Orchestration page)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using npm/npx instead of uvx | The package is `dbt-mcp` via `uvx`, not npm |
| Wrong env var names (DBT_CLOUD_*) | Use `DBT_TOKEN`, `DBT_PROD_ENV_ID`, etc. |
| Using `mcpServers` in VS Code | VS Code uses `servers` key in mcp.json |
| Service token for execute_sql | Use personal access token for SQL tools |
| Windows paths in WSL | Use Linux paths (`/home/...`) not Windows |
| Local user settings in WSL | Must use Remote settings in VS Code |
| Missing `uv` installation | Install uv first: https://docs.astral.sh/uv/ |
