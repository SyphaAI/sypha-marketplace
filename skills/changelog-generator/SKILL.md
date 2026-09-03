---
name: changelog-generator
description: >-
  Builds user-facing changelogs from git commits automatically by examining
  commit history, sorting changes into categories, and converting technical
  commits into clear, customer-friendly release notes. Reduces hours of manual
  changelog writing to minutes of automated generation.
metadata:
  category: development
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: changelog-generator
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# Changelog Generator

This skill turns technical git commits into polished, user-friendly changelogs that your customers and users will genuinely understand and value.

## When to Use This Skill

- Putting together release notes for a new version
- Producing weekly or monthly product update summaries
- Recording changes for customers
- Drafting changelog entries for app store submissions
- Producing update notifications
- Writing internal release documentation
- Keeping a public changelog/product updates page up to date

## What This Skill Does

1. **Scans Git History**: Examines commits from a given time period or between versions
2. **Categorizes Changes**: Sorts commits into logical categories (features, improvements, bug fixes, breaking changes, security)
3. **Translates Technical → User-Friendly**: Rewrites developer commits in customer language
4. **Formats Professionally**: Produces clean, structured changelog entries
5. **Filters Noise**: Leaves out internal commits (refactoring, tests, etc.)
6. **Follows Best Practices**: Uses changelog guidelines and your brand voice

## How to Use

### Basic Usage

Run from within your project repository:

```
Create a changelog from commits since last release
```

```
Generate changelog for all commits from the past week
```

```
Create release notes for version 2.5.0
```

### With Specific Date Range

```
Create a changelog for all commits between March 1 and March 15
```

### With Custom Guidelines

```
Create a changelog for commits since v2.4.0, using my changelog
guidelines from CHANGELOG_STYLE.md
```

## Example

**User**: "Create a changelog for commits from the past 7 days"

**Output**:
```markdown
# Updates - Week of March 10, 2024

## ✨ New Features

- **Team Workspaces**: Create separate workspaces for different
  projects. Invite team members and keep everything organized.

- **Keyboard Shortcuts**: Press ? to see all available shortcuts.
  Navigate faster without touching your mouse.

## 🔧 Improvements

- **Faster Sync**: Files now sync 2x faster across devices
- **Better Search**: Search now includes file contents, not just titles

## 🐛 Fixes

- Fixed issue where large images wouldn't upload
- Resolved timezone confusion in scheduled posts
- Corrected notification badge count
```

**Inspired by:** A use case by Manik Aggarwal featured in Lenny's Newsletter

## Tips

- Execute from the root of your git repository
- Provide date ranges to keep changelogs focused
- Rely on your CHANGELOG_STYLE.md to keep formatting consistent
- Check and tweak the generated changelog before you publish it
- Write the output straight to CHANGELOG.md

## Related Use Cases

- Producing GitHub release notes
- Drafting app store update descriptions
- Composing email updates for users
- Writing social media announcement posts
