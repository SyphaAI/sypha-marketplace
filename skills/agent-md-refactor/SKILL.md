---
name: agent-md-refactor
description: >-
  Refactor oversized AGENTS.md, CLAUDE.md, or similar agent instruction files
  so they follow progressive disclosure principles. Breaks monolithic files
  apart into organized, linked documentation.
metadata:
  category: development
  source:
    repository: 'https://github.com/softaworks/agent-toolkit'
    path: skills/agent-md-refactor
    license_path: LICENSE
    commit: 3027f20f3181758385a1bb8c022d4041dfb4de84
---

# Agent MD Refactor

Restructure bloated agent instruction files (AGENTS.md, CLAUDE.md, COPILOT.md, etc.) around **progressive disclosure principles** - the essentials stay at the root while everything else is arranged into linked, categorized files.

---

## Triggers

Invoke this skill when you hear:
- "refactor my AGENTS.md" / "refactor my CLAUDE.md"
- "split my agent instructions"
- "organize my CLAUDE.md file"
- "my AGENTS.md is too long"
- "progressive disclosure for my instructions"
- "clean up my agent config"

---

## Quick Reference

| Phase | Action | Output |
|-------|--------|--------|
| 1. Analyze | Find contradictions | List of conflicts to resolve |
| 2. Extract | Identify essentials | Core instructions for root file |
| 3. Categorize | Group remaining instructions | Logical categories |
| 4. Structure | Create file hierarchy | Root + linked files |
| 5. Prune | Flag for deletion | Redundant/vague instructions |

---

## Process

### Phase 1: Find Contradictions

Spot any instructions that are in conflict with one another.

**Look for:**
- Style guidelines that contradict (e.g., "use semicolons" vs "no semicolons")
- Workflow instructions that clash
- Tool preferences that are incompatible
- Patterns that are mutually exclusive

**For each contradiction found:**
```markdown
## Contradiction Found

**Instruction A:** [quote]
**Instruction B:** [quote]

**Question:** Which should take precedence, or should both be conditional?
```

Have the user resolve these before moving on.

---

### Phase 2: Identify the Essentials

Pull out ONLY the content that belongs in the root agent file. Keep the root minimal - just information that applies to **every single task**.

**Essential content (keep in root):**
| Category | Example |
|----------|---------|
| Project description | One sentence: "A React dashboard for analytics" |
| Package manager | Only if not npm (e.g., "Uses pnpm") |
| Non-standard commands | Custom build/test/typecheck commands |
| Critical overrides | Things that MUST override defaults |
| Universal rules | Applies to 100% of tasks |

**NOT essential (move to linked files):**
- Language-specific conventions
- Testing guidelines
- Code style details
- Framework patterns
- Documentation standards
- Git workflow details

---

### Phase 3: Group the Rest

Sort the instructions that remain into logical categories.

**Common categories:**
| Category | Contents |
|----------|----------|
| `typescript.md` | TS conventions, type patterns, strict mode rules |
| `testing.md` | Test frameworks, coverage, mocking patterns |
| `code-style.md` | Formatting, naming, comments, structure |
| `git-workflow.md` | Commits, branches, PRs, reviews |
| `architecture.md` | Patterns, folder structure, dependencies |
| `api-design.md` | REST/GraphQL conventions, error handling |
| `security.md` | Auth patterns, input validation, secrets |
| `performance.md` | Optimization rules, caching, lazy loading |

**Grouping rules:**
1. Every file should cover its topic in a self-contained way
2. Target 3-8 files (neither too granular nor too broad)
3. Give files clear names: `{topic}.md`
4. Keep only instructions that are actionable

---

### Phase 4: Create the File Structure

**Output structure:**
```
project-root/
├── CLAUDE.md (or AGENTS.md)     # Minimal root with links
└── .claude/                      # Or docs/agent-instructions/
    ├── typescript.md
    ├── testing.md
    ├── code-style.md
    ├── git-workflow.md
    └── architecture.md
```

**Root file template:**
```markdown
# Project Name

One-sentence description of the project.

## Quick Reference

- **Package Manager:** pnpm
- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Typecheck:** `pnpm typecheck`

## Detailed Instructions

For specific guidelines, see:
- [TypeScript Conventions](.claude/typescript.md)
- [Testing Guidelines](.claude/testing.md)
- [Code Style](.claude/code-style.md)
- [Git Workflow](.claude/git-workflow.md)
- [Architecture Patterns](.claude/architecture.md)
```

**Each linked file template:**
```markdown
# {Topic} Guidelines

## Overview
Brief context for when these guidelines apply.

## Rules

### Rule Category 1
- Specific, actionable instruction
- Another specific instruction

### Rule Category 2
- Specific, actionable instruction

## Examples

### Good
\`\`\`typescript
// Example of correct pattern
\`\`\`

### Avoid
\`\`\`typescript
// Example of what not to do
\`\`\`
```

---

### Phase 5: Flag for Deletion

Pick out the instructions that should be dropped altogether.

**Delete if:**
| Criterion | Example | Why Delete |
|-----------|---------|------------|
| Redundant | "Use TypeScript" (in a .ts project) | The agent already knows |
| Too vague | "Write clean code" | Nothing actionable |
| Overly obvious | "Don't introduce bugs" | Burns context |
| Default behavior | "Use descriptive variable names" | Already standard practice |
| Outdated | References deprecated APIs | No longer relevant |

**Output format:**
```markdown
## Flagged for Deletion

| Instruction | Reason |
|-------------|--------|
| "Write clean, maintainable code" | Too vague to be actionable |
| "Use TypeScript" | Redundant - project is already TS |
| "Don't commit secrets" | Agent already knows this |
| "Follow best practices" | Meaningless without specifics |
```

---

## Execution Checklist

```
[ ] Phase 1: All contradictions identified and resolved
[ ] Phase 2: Root file contains ONLY essentials
[ ] Phase 3: All remaining instructions categorized
[ ] Phase 4: File structure created with proper links
[ ] Phase 5: Redundant/vague instructions removed
[ ] Verify: Each linked file is self-contained
[ ] Verify: Root file is under 50 lines
[ ] Verify: All links work correctly
```

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Keeping everything in root | Bloated and hard to maintain | Split into linked files |
| Too many categories | Fragmentation | Consolidate related topics |
| Vague instructions | Burns tokens for no value | Be specific or delete |
| Duplicating defaults | The agent already knows | Override only when needed |
| Deep nesting | Difficult to navigate | Flat structure with links |

---

## Examples

### Before (Bloated Root)
```markdown
# CLAUDE.md

This is a React project.

## Code Style
- Use 2 spaces
- Use semicolons
- Prefer const over let
- Use arrow functions
... (200 more lines)

## Testing
- Use Jest
- Coverage > 80%
... (100 more lines)

## TypeScript
- Enable strict mode
... (150 more lines)
```

### After (Progressive Disclosure)
```markdown
# CLAUDE.md

React dashboard for real-time analytics visualization.

## Commands
- `pnpm dev` - Start development server
- `pnpm test` - Run tests with coverage
- `pnpm build` - Production build

## Guidelines
- [Code Style](.claude/code-style.md)
- [Testing](.claude/testing.md)
- [TypeScript](.claude/typescript.md)
```

---

## Verification

Once refactoring is done, confirm:

1. **Root file is minimal** - Below 50 lines, holding only universal info
2. **Links work** - Every referenced file exists
3. **No contradictions** - The instructions are consistent
4. **Actionable content** - Each instruction is specific
5. **Complete coverage** - Nothing was lost (except items flagged for deletion)
6. **Self-contained files** - Every linked file stands on its own

---
