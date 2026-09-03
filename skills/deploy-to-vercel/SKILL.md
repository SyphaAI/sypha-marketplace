---
name: deploy-to-vercel
description: >-
  Deploy applications and websites to Vercel. Invoke when the user requests
  deployment actions like "deploy my app", "deploy and give me the link", "push
  this live", or "create a preview deployment".
metadata:
  author: vercel
  version: 3.0.0
  category: development
  source:
    repository: 'https://github.com/vercel-labs/agent-skills'
    path: skills/deploy-to-vercel
    commit: f8a72b9603728bb92a217a879b7e62e43ad76c81
license: MIT
---

# Deploy to Vercel

Deploy any project to Vercel. **Always deploy as preview** (not production) unless the user explicitly requests production.

The objective is to establish the best long-term setup for the user: their project linked to Vercel with git-push deploys. Every method below aims to move the user closer to that state.

## Step 1: Gather Project State

Run all four checks before deciding which method to use:

```bash
# 1. Check for a git remote
git remote get-url origin 2>/dev/null

# 2. Check if locally linked to a Vercel project (either file means linked)
cat .vercel/project.json 2>/dev/null || cat .vercel/repo.json 2>/dev/null

# 3. Check if the Vercel CLI is installed and authenticated
vercel whoami 2>/dev/null

# 4. List available teams (if authenticated)
vercel teams list --format json 2>/dev/null
```

### Team selection

If the user belongs to multiple teams, present all available team slugs as a bulleted list and ask which one to deploy to. Once the user selects a team, proceed immediately to the next step — do not ask for additional confirmation.

Pass the team slug via `--scope` on all subsequent CLI commands (`vercel deploy`, `vercel link`, `vercel inspect`, etc.):

```bash
vercel deploy [path] -y --no-wait --scope <team-slug>
```

If the project is already linked (`.vercel/project.json` or `.vercel/repo.json` exists), the `orgId` in those files determines the team — there is no need to ask again. If there is only one team (or just a personal account), skip the prompt and use it directly.

**About the `.vercel/` directory:** A linked project contains either:
- `.vercel/project.json` — created by `vercel link` (single project linking). Contains `projectId` and `orgId`.
- `.vercel/repo.json` — created by `vercel link --repo` (repo-based linking). Contains `orgId`, `remoteName`, and a `projects` array mapping directories to Vercel project IDs.

The presence of either file indicates the project is linked. Check for both.

**Do NOT** use `vercel project inspect`, `vercel ls`, or `vercel link` to detect state in an unlinked directory — without a `.vercel/` config, these commands will prompt interactively (or, with `--yes`, silently link as a side-effect). Only `vercel whoami` is safe to run anywhere.

## Step 2: Choose a Deploy Method

### Linked (`.vercel/` exists) + has git remote → Git Push

This is the ideal state. The project is linked and has git integration.

1. **Ask the user before pushing.** Never push without explicit approval:
   ```
   This project is connected to Vercel via git. I can commit and push to
   trigger a deployment. Want me to proceed?
   ```

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "deploy: <description of changes>"
   git push
   ```
   Vercel builds automatically from the push. Non-production branches receive preview deployments; the production branch (usually `main`) receives a production deployment.

3. **Retrieve the preview URL.** If the CLI is authenticated:
   ```bash
   sleep 5
   vercel ls --format json
   ```
   The JSON output includes a `deployments` array. Find the latest entry — its `url` field is the preview URL.

   If the CLI is not authenticated, direct the user to check the Vercel dashboard or the commit status checks on their git provider for the preview URL.

---

### Linked (`.vercel/` exists) + no git remote → `vercel deploy`

The project is linked but no git repo exists. Deploy directly using the CLI.

```bash
vercel deploy [path] -y --no-wait
```

Use `--no-wait` so the CLI returns immediately with the deployment URL rather than blocking until the build finishes (builds can take a while). Then check the deployment status with:

```bash
vercel inspect <deployment-url>
```

For production deploys (only if user explicitly asks):
```bash
vercel deploy [path] --prod -y --no-wait
```

---

### Not linked + CLI is authenticated → Link first, then deploy

The CLI is working but the project is not yet linked. This is the opportunity to place the user in the best long-term state.

1. **Ask the user which team to deploy to.** Present the team slugs from Step 1 as a bulleted list. If there is only one team (or just a personal account), skip this step.

2. **Once a team is selected, proceed directly to linking.** Inform the user what will happen but do not ask for separate confirmation:
   ```
   Linking this project to <team name> on Vercel. This will create a Vercel
   project to deploy to and enable automatic deployments on future git pushes.
   ```

3. **If a git remote exists**, use repo-based linking with the selected team scope:
   ```bash
   vercel link --repo --scope <team-slug>
   ```
   This reads the git remote URL and matches it to existing Vercel projects that deploy from that repo. It creates `.vercel/repo.json`. This approach is significantly more reliable than `vercel link` (without `--repo`), which attempts to match by directory name and frequently fails when the local folder and Vercel project have different names.

   **If there is no git remote**, fall back to standard linking:
   ```bash
   vercel link --scope <team-slug>
   ```
   This prompts the user to select or create a project and creates `.vercel/project.json`.

4. **Then deploy using the best available method:**
   - If a git remote exists → commit and push (see git push method above)
   - If no git remote → `vercel deploy [path] -y --no-wait --scope <team-slug>`, then `vercel inspect <url>` to check status

---

### Not linked + CLI not authenticated → Install, auth, link, deploy

The Vercel CLI is not set up at all.

1. **Install the CLI (if not already installed):**
   ```bash
   npm install -g vercel
   ```

2. **Authenticate:**
   ```bash
   vercel login
   ```
   The user completes authentication in their browser. If interactive authentication is unavailable or fails, stop and explain that an authenticated Vercel CLI session is required. Do not package or upload the project through another service.

3. **Ask which team to deploy to** — present team slugs from `vercel teams list --format json` as a bulleted list. If there is only one team or a personal account, skip this. Once a selection is made, proceed immediately.

4. **Link the project** with the selected team scope (use `--repo` if a git remote exists, plain `vercel link` otherwise):
   ```bash
   vercel link --repo --scope <team-slug>   # if git remote exists
   vercel link --scope <team-slug>          # if no git remote
   ```

5. **Deploy** using the best available method (git push if a remote exists, otherwise `vercel deploy -y --no-wait --scope <team-slug>`, then `vercel inspect <url>` to check status).

---

### Authentication unavailable → Stop

Do not deploy without an authenticated Vercel CLI session. Do not execute bundled fallback scripts, send the project to an unauthenticated deployment endpoint, or upload an archive through another service.

Inform the user that deployment has stopped because Vercel authentication is required. They can run `vercel login` and retry once authentication succeeds.

---

## Output

Always present the deployment URL to the user.

- **Git push:** Use `vercel ls --format json` to locate the preview URL. If the CLI is not authenticated, direct the user to the Vercel dashboard or commit status checks.
- **CLI deploy:** Show the URL returned by `vercel deploy --no-wait`. Use `vercel inspect <url>` to verify build status and report it to the user.

**Do not** curl or fetch the deployed URL to verify it is live. Simply return the link.

---

## Troubleshooting

### Network Access Error

If deployment fails because network access is unavailable, report the failure and stop. Do not reroute the project through a different deployment endpoint.

### CLI Auth Failure

If `vercel login` or `vercel deploy` fails with authentication errors, report that an authenticated Vercel CLI session is required and stop.
