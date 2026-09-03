---
name: skill-share
description: >-
  A skill that builds new agent skills and automatically publishes them to Slack
  via Rube, enabling smooth team collaboration and skill discovery.
license: Complete terms in LICENSE.txt
metadata:
  category: development
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: skill-share
    commit: 92568c1edaff1bde5371154f036d959346c145a8
---

## When to use this skill

Use this skill when you need to:
- **Create new agent skills** with the correct structure and metadata
- **Generate skill packages** ready for distribution
- **Automatically publish created skills** to Slack channels for team visibility
- **Validate skill structure** prior to sharing
- **Package and distribute** skills to your team

Also use this skill when:
- **The user indicates they want to create or share their skill**

This skill is well suited for:
- Building skills as part of team workflows
- Developing internal tools that combine skill creation with team notifications
- Automating the skill development pipeline
- Collaborative skill creation with built-in team notifications

## Key Features

### 1. Skill Creation
- Generates properly structured skill directories containing SKILL.md
- Produces standardized scripts/, references/, and assets/ directories
- Auto-generates YAML frontmatter with all required metadata
- Enforces hyphen-case naming conventions

### 2. Skill Validation
- Validates SKILL.md format and required fields
- Verifies naming conventions
- Confirms metadata completeness before packaging proceeds

### 3. Skill Packaging
- Produces distributable zip files
- Bundles all skill assets and documentation
- Automatically runs validation before packaging

### 4. Slack Integration via Rube
- Automatically delivers skill information to designated Slack channels
- Shares skill metadata (name, description, link)
- Posts a skill summary to aid team discovery
- Supplies direct links to skill files

## How It Works

1. **Initialization**: Supply the skill name and description
2. **Creation**: The skill directory is created with the correct structure
3. **Validation**: Skill metadata is checked for correctness
4. **Packaging**: The skill is bundled into a distributable format
5. **Slack Notification**: Skill details are posted to the team's Slack channel

## Example Usage

```
When you ask Sypha to create a skill called "pdf-analyzer":
1. Creates /skill-pdf-analyzer/ with SKILL.md template
2. Generates structured directories (scripts/, references/, assets/)
3. Validates the skill structure
4. Packages the skill as a zip file
5. Posts to Slack: "New Skill Created: pdf-analyzer - Advanced PDF analysis and extraction capabilities"
```

## Integration with Rube

This skill uses Rube for:
- **SLACK_SEND_MESSAGE**: Delivers skill information to team channels
- **SLACK_POST_MESSAGE_WITH_BLOCKS**: Shares richly formatted skill metadata
- **SLACK_FIND_CHANNELS**: Locates target channels for skill announcements

## Requirements

- Slack workspace connection via Rube
- Write access to the skill creation directory
- Python 3.7+ for skill creation scripts
- A target Slack channel for skill notifications
