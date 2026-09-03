---
name: create-pull-request
description: >-
  Create a GitHub pull request that follows project conventions. Use when the
  user wants to create a PR, submit changes for review, or open a pull request.
  Covers commit analysis, branch management, PR template usage, and PR creation
  via the gh CLI tool.
metadata:
  category: development
  source:
    repository: 'https://github.com/cline/cline'
    path: .agents/skills/create-pull-request
    license_path: LICENSE
    commit: 14a28b0559fbc783d45befe962c71811b5804065
---

# Create Pull Request

This skill walks you through creating a well-structured GitHub pull request that adheres to project conventions and best practices.

## Prerequisites Check

Before continuing, verify the following:

### 1. Check if `gh` CLI is installed

```bash
gh --version
```

If it is not installed, notify the user:
> The GitHub CLI (`gh`) is required but not installed. Please install it:
> - macOS: `brew install gh`
> - Other: https://cli.github.com/

### 2. Check if authenticated with GitHub

```bash
gh auth status
```

If not authenticated, direct the user to run `gh auth login`.

### 3. Verify clean working directory

```bash
git status
```

If uncommitted changes exist, ask the user whether to:
- Commit them as part of this PR
- Stash them temporarily
- Discard them (with caution)

## Gather Context

### 1. Identify the current branch

```bash
git branch --show-current
```

Confirm you are not on `main` or `master`. If you are, ask the user to create or switch to a feature branch.

### 2. Find the base branch

```bash
git remote show origin | grep "HEAD branch"
```

This is usually `main` or `master`.

### 3. Analyze recent commits relevant to this PR

```bash
git log origin/main..HEAD --oneline --no-decorate
```

Examine these commits to understand:
- What changes are being introduced
- The scope of the PR (single feature/fix or multiple changes)
- Whether commits should be squashed or reorganized

### 4. Review the diff

```bash
git diff origin/main..HEAD --stat
```

This indicates which files changed and helps characterize the type of change.

## Information Gathering

Before creating the PR, gather the following information. Determine whether it can be inferred from:
- Commit messages
- Branch name (e.g., `fix/issue-123`, `feature/new-login`)
- Changed files and their content

If any critical information is unavailable, use `ask_followup_question` to request it from the user:

### Required Information

1. **Related Issue Number**: Look for patterns like `#123`, `fixes #123`, or `closes #123` in commit messages
2. **Description**: What problem does this solve? Why were these changes made?
3. **Type of Change**: Bug fix, new feature, breaking change, refactor, cosmetic, documentation, or workflow
4. **Test Procedure**: How was this tested? What could break?

### Example clarifying question

If the issue number cannot be found:
> I couldn't find a related issue number in the commit messages or branch name. What GitHub issue does this PR address? (Enter the issue number, e.g., "123" or "N/A" for small fixes)

## Git Best Practices

Before creating the PR, apply these best practices:

### Commit Hygiene

1. **Atomic commits**: Each commit should encapsulate a single logical change
2. **Clear commit messages**: Follow conventional commit format whenever possible
3. **No merge commits**: Prefer rebasing over merging to maintain a clean history

### Branch Management

1. **Rebase on latest main** (if needed):
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Squash if appropriate**: If there are many small "WIP" commits, consider an interactive rebase:
   ```bash
   git rebase -i origin/main
   ```
   Only propose this if the commits look disorganized and the user is comfortable rebasing.

### Push Changes

Make sure all commits are pushed:
```bash
git push origin HEAD
```

If the branch was rebased, you may need to force-push:
```bash
git push origin HEAD --force-with-lease
```

## Create the Pull Request

**IMPORTANT**: Read and use the PR template at `.github/pull_request_template.md`. The PR body format must **strictly match** the template structure. Do not deviate from the template format.

When populating the template:
- Replace `#XXXX` with the actual issue number, or leave it as `#XXXX` when no issue exists (for small fixes)
- Fill in every section with relevant information gathered from commits and context
- Check the appropriate "Type of Change" checkbox(es)
- Complete the applicable "Pre-flight Checklist" items

### Create PR with gh CLI

**Use a temporary file for the PR body** to prevent shell escaping issues, newline problems, and other command-line unreliability:

1. Write the PR body to a temporary file:
   ```
   /tmp/pr-body.md
   ```

2. Create the PR using the file:
   ```bash
   gh pr create --title "PR_TITLE" --body-file /tmp/pr-body.md --base main
   ```

3. Remove the temporary file:
   ```bash
   rm /tmp/pr-body.md
   ```

For draft PRs:
```bash
gh pr create --title "PR_TITLE" --body-file /tmp/pr-body.md --base main --draft
```

**Why use a file?** Passing complex markdown containing newlines, special characters, and checkboxes via `--body` directly is unreliable. The `--body-file` flag handles all content without issues.

## Post-Creation

After creating the PR:

1. **Display the PR URL** so the user can review it
2. **Remind about CI checks**: Tests and linting will run automatically
3. **Suggest next steps**:
   - Add reviewers if needed: `gh pr edit --add-reviewer USERNAME`
   - Add labels if needed: `gh pr edit --add-label "bug"`

## Error Handling

### Common Issues

1. **No commits ahead of main**: The branch has no changes to submit
   - Ask whether the user intended to work on a different branch

2. **Branch not pushed**: The remote does not have the branch
   - Push the branch first: `git push -u origin HEAD`

3. **PR already exists**: A PR for this branch is already open
   - Show the existing PR: `gh pr view`
   - Ask whether they would like to update it instead

4. **Merge conflicts**: The branch conflicts with the base
   - Guide the user through resolving conflicts or rebasing

## Summary Checklist

Before finalizing, verify:
- [ ] `gh` CLI is installed and authenticated
- [ ] Working directory is clean
- [ ] All commits are pushed
- [ ] Branch is up-to-date with the base branch
- [ ] Related issue number is identified, or placeholder is used
- [ ] PR description follows the template exactly
- [ ] Appropriate type of change is selected
- [ ] Pre-flight checklist items are addressed
