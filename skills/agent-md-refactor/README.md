# Agent MD Refactor

A skill that turns bloated agent instruction files into clean, well-organized documentation by applying progressive disclosure principles.

Inspired by https://x.com/mattpocockuk/status/2012906065856270504 (Matt Pocock's Prompt Idea)

## Purpose

As time passes, agent instruction files such as `CLAUDE.md`, `AGENTS.md`, or `COPILOT.md` gradually swell into unwieldy documents with hundreds of lines of mixed instructions. Several problems result:

- **Context waste**: The whole file is loaded for every task, even when most of its instructions don't apply
- **Maintenance burden**: Locating and updating a specific instruction gets harder
- **Contradictions**: Guidelines that conflict with each other pile up unnoticed
- **Signal-to-noise ratio**: Key rules end up buried beneath obvious or vague statements

The skill addresses these issues through **progressive disclosure** - only essential, universal instructions stay in the root file, while everything else is arranged into focused, linked documentation files.

## When to Use

Reach for this skill whenever agent instruction files need cleaning up. Typical trigger phrases include:

- "refactor my AGENTS.md" / "refactor my CLAUDE.md"
- "split my agent instructions"
- "organize my CLAUDE.md file"
- "my AGENTS.md is too long"
- "progressive disclosure for my instructions"
- "clean up my agent config"

**Good candidates for refactoring:**

- Root agent files that run past 50-100 lines
- Files blending several unrelated topics (testing, code style, architecture, etc.)
- Documents that grew organically and lack structure
- Files holding contradictory or redundant instructions

## How It Works

The skill works through a systematic process in 5 phases:

### Phase 1: Find Contradictions

Prior to any restructuring, the skill locates conflicting instructions that must be resolved. Examples are contradictory style guidelines ("use semicolons" vs "no semicolons") or workflow instructions that are incompatible. Every contradiction is presented alongside a question for the user to answer.

### Phase 2: Identify the Essentials

Pulls out only the content that genuinely belongs in the root file - information relevant to every single task:

| Keep in Root | Move Out |
|-------------|----------|
| One-sentence project description | Language-specific conventions |
| Non-standard package manager | Testing guidelines |
| Custom build/test commands | Code style details |
| Critical overrides | Framework patterns |
| Universal rules (100% of tasks) | Documentation standards |

### Phase 3: Group the Rest

Sorts the remaining instructions into logical categories such as:

- `typescript.md` - Type patterns, strict mode rules
- `testing.md` - Test frameworks, coverage, mocking
- `code-style.md` - Formatting, naming, structure
- `git-workflow.md` - Commits, branches, PRs
- `architecture.md` - Patterns, folder structure

### Phase 4: Create the File Structure

Builds the new file hierarchy, with the documentation correctly linked together:

```
project-root/
├── CLAUDE.md              # Minimal root with links
└── .claude/               # Categorized instructions
    ├── typescript.md
    ├── testing.md
    ├── code-style.md
    └── architecture.md
```

### Phase 5: Flag for Deletion

Picks out instructions that ought to be removed altogether:

- **Redundant**: "Use TypeScript" in a project that is already TypeScript
- **Too vague**: "Write clean code" with no specifics
- **Overly obvious**: "Don't introduce bugs"
- **Default behavior**: "Use descriptive variable names"
- **Outdated**: Mentions of deprecated APIs

## Key Features

- **Contradiction detection**: Brings conflicting instructions to light before any restructuring
- **Intelligent categorization**: Collects related instructions into logical files
- **Root file minimization**: Aims to keep the main file under 50 lines
- **Deletion recommendations**: Points out instructions that waste context tokens
- **Template-driven output**: All generated files share a consistent structure
- **Link verification**: Confirms every reference between files is valid

## Usage Examples

### Basic Refactoring

```
User: refactor my CLAUDE.md

Sypha: I'll analyze your CLAUDE.md file and refactor it using progressive
disclosure principles...
```

### Specific File

```
User: my AGENTS.md is too long, can you split it up?

Sypha: I'll review your AGENTS.md and organize it into focused, linked files...
```

### After a Project Grows

```
User: organize my agent config - it's gotten out of control

Sypha: I'll apply the 5-phase refactoring process to clean up your
agent instructions...
```

## Output

Once the skill has run, it produces:

**A minimal root file (~50 lines or fewer):**
```markdown
# Project Name

One-sentence description of the project.

## Quick Reference

- **Package Manager:** pnpm
- **Build:** `pnpm build`
- **Test:** `pnpm test`

## Detailed Instructions

- [TypeScript Conventions](.claude/typescript.md)
- [Testing Guidelines](.claude/testing.md)
- [Code Style](.claude/code-style.md)
```

**Linked files organized with a consistent structure:**
```markdown
# Testing Guidelines

## Overview
Brief context for when these guidelines apply.

## Rules

### Unit Tests
- Specific, actionable instruction
- Another specific instruction

## Examples

### Good
[code example]

### Avoid
[code example]
```

**A deletion report:**
```markdown
## Flagged for Deletion

| Instruction | Reason |
|-------------|--------|
| "Write clean, maintainable code" | Too vague to be actionable |
| "Use TypeScript" | Redundant - project is already TS |
```

## Best Practices

### Before Refactoring

1. **Commit current state** - Start from a clean git state so the changes are easy to review
2. **Identify your goals** - Be clear about which problems you want solved
3. **Gather all instruction files** - In some projects, instructions are scattered across several locations

### During Refactoring

1. **Resolve contradictions first** - Don't move forward until the conflicts are settled
2. **Be aggressive about root minimization** - If unsure, move it out
3. **Aim for 3-8 linked files** - Neither too granular nor too broad
4. **Delete liberally** - Vague instructions burn tokens while adding no value

### After Refactoring

1. **Verify all links work** - Confirm the referenced files actually exist
2. **Check for lost instructions** - Make sure nothing important got dropped
3. **Test with real tasks** - Run a handful of typical tasks to confirm the agent can locate the instructions it needs

## Anti-Patterns to Avoid

| Avoid | Why | Instead |
|-------|-----|---------|
| Keeping everything in root | Bloated and hard to maintain | Split into linked files |
| Too many categories | Fragmentation and navigation overhead | Consolidate related topics |
| Vague instructions | Burns tokens for no value | Be specific or delete |
| Duplicating defaults | The agent already knows | Override only when needed |
| Deep nesting | Difficult to navigate | Flat structure with links |

## Verification Checklist

Once refactoring is done, confirm:

- [ ] The root file stays under 50 lines
- [ ] The root holds ONLY universal information
- [ ] Every link to a sub-file works correctly
- [ ] No contradictions are left between files
- [ ] Each instruction is specific and actionable
- [ ] No instructions went missing (unless deleted on purpose)
- [ ] Every linked file covers its topic in a self-contained way

## License

MIT
