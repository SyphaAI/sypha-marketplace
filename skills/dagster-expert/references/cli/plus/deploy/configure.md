---
title: "dg plus deploy configure"
triggers:
  - "Deploying to Dagster Plus, Github Actions, GitLab CI"
  - "CI/CD configuration"
---

The `dg plus deploy configure` command scaffolds all files required to enable deployment of a git repo to Dagster Plus. At a minimum, it produces a GitHub Actions or GitLab CI configuration file that automatically handles redeployment to Dagster Plus on merges to the main branch and creates branch deployments for pull requests.

Although the command exposes flags and subcommands for specific scenarios, running it without arguments is _HIGHLY_ recommended — this triggers an interactive prompt that collects all required information, including authentication with the relevant Git provider (GitHub or GitLab) and, when needed, container registry credentials for hybrid deployments.

`dg plus login` must ALWAYS be run before executing this command, and it requires the user to have a Dagster Plus account.

**IMPORTANT** For deployment to Dagster Plus to succeed, the `dagster-cloud` python package must be added as a project dependency (e.g. `uv add dagster-cloud`).

```bash
dg plus deploy configure
```
