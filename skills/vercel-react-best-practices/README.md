# React Best Practices

A well-organized repository for authoring and managing React Best Practices, tailored for use by agents and LLMs.

## Structure

- `rules/` - One file per rule
  - `_sections.md` - Metadata for each section (titles, impacts, descriptions)
  - `_template.md` - Starter template for new rules
  - `area-description.md` - Individual rule files
- `src/` - Build scripts and utility code
- `metadata.json` - Document-level metadata (version, organization, abstract)
- __`AGENTS.md`__ - Compiled output (generated)
- __`test-cases.json`__ - Test cases for LLM evaluation (generated)

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Compile AGENTS.md from rules:
   ```bash
   pnpm build
   ```

3. Check rule files for validity:
   ```bash
   pnpm validate
   ```

4. Pull out test cases:
   ```bash
   pnpm extract-tests
   ```

## Creating a New Rule

1. Copy `rules/_template.md` to `rules/area-description.md`
2. Select the appropriate area prefix:
   - `async-` for Eliminating Waterfalls (Section 1)
   - `bundle-` for Bundle Size Optimization (Section 2)
   - `server-` for Server-Side Performance (Section 3)
   - `client-` for Client-Side Data Fetching (Section 4)
   - `rerender-` for Re-render Optimization (Section 5)
   - `rendering-` for Rendering Performance (Section 6)
   - `js-` for JavaScript Performance (Section 7)
   - `advanced-` for Advanced Patterns (Section 8)
3. Complete the frontmatter and body content
4. Provide clear examples accompanied by explanations
5. Run `pnpm build` to regenerate AGENTS.md and test-cases.json

## Rule File Structure

Every rule file must conform to this structure:

```markdown
---
title: Rule Title Here
impact: MEDIUM
impactDescription: Optional description
tags: tag1, tag2, tag3
---

## Rule Title Here

Brief explanation of the rule and why it matters.

**Incorrect (description of what's wrong):**

```typescript
// Bad code example
```

**Correct (description of what's right):**

```typescript
// Good code example
```

Optional explanatory text after examples.

Reference: [Link](https://example.com)

## File Naming Convention

- Files prefixed with `_` are special-purpose (excluded from build)
- Rule files use the pattern: `area-description.md` (e.g., `async-parallel.md`)
- The section is derived automatically from the filename prefix
- Within each section, rules are sorted alphabetically by title
- IDs (e.g., 1.1, 1.2) are assigned automatically at build time

## Impact Levels

- `CRITICAL` - Top priority; delivers the largest performance gains
- `HIGH` - Produces significant performance improvements
- `MEDIUM-HIGH` - Moderate-to-high gains
- `MEDIUM` - Delivers moderate performance improvements
- `LOW-MEDIUM` - Low-to-moderate gains
- `LOW` - Provides incremental improvements

## Scripts

- `pnpm build` - Compile rules into AGENTS.md
- `pnpm validate` - Validate all rule files
- `pnpm extract-tests` - Extract test cases for LLM evaluation
- `pnpm dev` - Build and validate

## Contributing

When adding or updating rules:

1. Use the correct filename prefix for your section
2. Follow the `_template.md` structure
3. Provide clear bad/good examples accompanied by explanations
4. Attach appropriate tags
5. Run `pnpm build` to regenerate AGENTS.md and test-cases.json
6. Rules are sorted by title automatically — no manual numbering required!

## Acknowledgments

Originally created by [@shuding](https://x.com/shuding) at [Vercel](https://vercel.com).
