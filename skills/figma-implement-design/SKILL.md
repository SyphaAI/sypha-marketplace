---
name: figma-implement-design
description: >-
  Converts Figma designs into production-ready application code with 1:1 visual
  fidelity. Use when generating UI code from Figma files, when user mentions
  "implement design", "generate code", "implement component", provides Figma
  URLs, or asks to build components matching Figma specs. For Figma canvas
  writes via `use_figma`, use `figma-use`.
metadata:
  category: development
  source:
    repository: 'https://github.com/openai/skills'
    path: skills/.curated/figma-implement-design
    license_path: skills/.curated/figma-implement-design/LICENSE.txt
    commit: 49f948faa9258a0c61caceaf225e179651397431
---

# Implement Design

## Overview

This skill offers a structured workflow for converting Figma designs into production-ready code with pixel-perfect accuracy. It guarantees consistent integration with the Figma MCP server, correct use of design tokens, and 1:1 visual parity with the source designs.

## Skill Boundaries

- Apply this skill when the deliverable is code committed to the user's repository.
- If the user wants to create, edit, or delete nodes inside Figma itself, switch to [figma-use](../figma-use/SKILL.md).
- If the user wants to build or update a full-page screen in Figma from code or a description, switch to [figma-generate-design](../figma-generate-design/SKILL.md).
- If the user wants only Code Connect mappings, switch to [figma-code-connect-components](../figma-code-connect-components/SKILL.md).
- If the user wants to author reusable agent rules, switch to [figma-create-design-system-rules](../figma-create-design-system-rules/SKILL.md).

## Prerequisites

- Figma MCP server must be connected and accessible
- User must provide a Figma URL in the format: `https://figma.com/design/:fileKey/:fileName?node-id=1-2`
  - `:fileKey` is the file key
  - `1-2` is the node ID (the specific component or frame to implement)
- **OR** when using `figma-desktop` MCP: User can select a node directly in the Figma desktop app (no URL required)
- Project should have an established design system or component library (preferred)

## Required Workflow

**Follow these steps in order. Do not skip steps.**

### Step 0: Set up Figma MCP (if not already configured)

If an MCP call fails because Figma MCP is not connected, stop and guide the user through setup.

The Figma MCP server runs locally through the Figma Desktop app. Make sure the Figma Desktop app is open, then add the Figma Desktop MCP server to your config:

```json
{
  "mcp": {
    "Figma Desktop": {
      "type": "remote",
      "url": "http://127.0.0.1:3845/mcp"
    }
  }
}
```

**VS Code Extension:** Open Sypha Settings > Agent Behaviour > MCP Servers, then click "Edit Global MCP" (or "Edit Project MCP" for project-scoped configuration) and paste the config above.

**CLI:** Add the `mcp` block to your `sypha.json` config file. Config file locations:
- **Global:** `~/.config/sypha/sypha.json`
- **Project:** `./sypha.json` or `./.sypha/sypha.json` in your project root

Project-level configuration takes precedence over global settings.

After adding the server, restart Sypha to establish the connection to the Figma MCP server, then proceed to Step 1.

### Step 1: Get Node ID

#### Option A: Parse from Figma URL

When the user supplies a Figma URL, extract the file key and node ID to use as arguments for MCP tool calls.

**URL format:** `https://figma.com/design/:fileKey/:fileName?node-id=1-2`

**Extract:**

- **File key:** `:fileKey` (the path segment immediately after `/design/`)
- **Node ID:** `1-2` (the value of the `node-id` query parameter)

**Note:** When using the local desktop MCP (`figma-desktop`), `fileKey` is not passed as a parameter to tool calls. The server automatically references the currently open file, so only `nodeId` is required.

**Example:**

- URL: `https://figma.com/design/kL9xQn2VwM8pYrTb4ZcHjF/DesignSystem?node-id=42-15`
- File key: `kL9xQn2VwM8pYrTb4ZcHjF`
- Node ID: `42-15`

#### Option B: Use Current Selection from Figma Desktop App (figma-desktop MCP only)

When using the `figma-desktop` MCP and the user has NOT provided a URL, the tools automatically operate on the node currently selected in the open Figma file in the desktop app.

**Note:** Selection-based targeting only works with the `figma-desktop` MCP server. The remote server requires a frame or layer link to extract context. The Figma desktop app must be open with a node selected.

### Step 2: Fetch Design Context

Run `get_design_context` with the extracted file key and node ID.

```
get_design_context(fileKey=":fileKey", nodeId="1-2")
```

This returns structured data that includes:

- Layout properties (Auto Layout, constraints, sizing)
- Typography specifications
- Color values and design tokens
- Component structure and variants
- Spacing and padding values

**If the response is too large or truncated:**

1. Run `get_metadata(fileKey=":fileKey", nodeId="1-2")` to retrieve the high-level node map
2. Identify the specific child nodes required from the metadata
3. Fetch individual child nodes with `get_design_context(fileKey=":fileKey", nodeId=":childNodeId")`

### Step 3: Capture Visual Reference

Run `get_screenshot` with the same file key and node ID to obtain a visual reference.

```
get_screenshot(fileKey=":fileKey", nodeId="1-2")
```

This screenshot acts as the authoritative reference for visual validation. Keep it available throughout the implementation.

### Step 4: Download Required Assets

Download any assets (images, icons, SVGs) provided by the Figma MCP server.

**IMPORTANT:** Follow these asset rules:

- If the Figma MCP server returns a `localhost` source for an image or SVG, use that source directly
- DO NOT import or add new icon packages - all assets should come from the Figma payload
- DO NOT use or create placeholders if a `localhost` source is provided
- Assets are served through the Figma MCP server's built-in assets endpoint

### Step 5: Translate to Project Conventions

Map the Figma output to this project's framework, styles, and conventions.

**Key principles:**

- Treat the Figma MCP output (typically React + Tailwind) as a representation of design intent and behavior, not as the final code style
- Replace Tailwind utility classes with the project's preferred utilities or design system tokens
- Reuse existing components (buttons, inputs, typography, icon wrappers) rather than duplicating functionality
- Apply the project's color system, typography scale, and spacing tokens consistently
- Respect existing routing, state management, and data-fetch patterns

### Step 6: Achieve 1:1 Visual Parity

Aim for pixel-perfect visual alignment with the Figma design.

**Guidelines:**

- Prioritize Figma fidelity to match designs exactly
- Avoid hardcoded values — use design tokens from Figma where available
- When conflicts arise between design system tokens and Figma specs, prefer design system tokens but adjust spacing or sizes as needed to preserve visual fidelity
- Follow WCAG requirements for accessibility
- Add component documentation as needed

### Step 7: Validate Against Figma

Before marking the task complete, verify the final UI against the Figma screenshot.

**Validation checklist:**

- [ ] Layout matches (spacing, alignment, sizing)
- [ ] Typography matches (font, size, weight, line height)
- [ ] Colors match exactly
- [ ] Interactive states work as designed (hover, active, disabled)
- [ ] Responsive behavior follows Figma constraints
- [ ] Assets render correctly
- [ ] Accessibility standards met

## Implementation Rules

### Component Organization

- Place UI components in the project's designated design system directory
- Adhere to the project's component naming conventions
- Avoid inline styles unless they are genuinely required for dynamic values

### Design System Integration

- ALWAYS use components from the project's design system when available
- Map Figma design tokens to their project equivalents
- When a matching component already exists, extend it rather than creating a new one
- Document any new components added to the design system

### Code Quality

- Avoid hardcoded values — extract them to constants or design tokens
- Keep components composable and reusable
- Add TypeScript types for component props
- Include JSDoc comments for exported components

## Examples

### Example 1: Implementing a Button Component

User says: "Implement this Figma button component: https://figma.com/design/kL9xQn2VwM8pYrTb4ZcHjF/DesignSystem?node-id=42-15"

**Actions:**

1. Parse URL to extract fileKey=`kL9xQn2VwM8pYrTb4ZcHjF` and nodeId=`42-15`
2. Run `get_design_context(fileKey="kL9xQn2VwM8pYrTb4ZcHjF", nodeId="42-15")`
3. Run `get_screenshot(fileKey="kL9xQn2VwM8pYrTb4ZcHjF", nodeId="42-15")` for visual reference
4. Download any button icons from the assets endpoint
5. Check if project has existing button component
6. If yes, extend it with new variant; if no, create new component using project conventions
7. Map Figma colors to project design tokens (e.g., `primary-500`, `primary-hover`)
8. Validate against screenshot for padding, border radius, typography

**Result:** Button component matching Figma design, integrated with project design system.

### Example 2: Building a Dashboard Layout

User says: "Build this dashboard: https://figma.com/design/pR8mNv5KqXzGwY2JtCfL4D/Dashboard?node-id=10-5"

**Actions:**

1. Parse URL to extract fileKey=`pR8mNv5KqXzGwY2JtCfL4D` and nodeId=`10-5`
2. Run `get_metadata(fileKey="pR8mNv5KqXzGwY2JtCfL4D", nodeId="10-5")` to understand the page structure
3. Identify main sections from metadata (header, sidebar, content area, cards) and their child node IDs
4. Run `get_design_context(fileKey="pR8mNv5KqXzGwY2JtCfL4D", nodeId=":childNodeId")` for each major section
5. Run `get_screenshot(fileKey="pR8mNv5KqXzGwY2JtCfL4D", nodeId="10-5")` for the full page
6. Download all assets (logos, icons, charts)
7. Build layout using project's layout primitives
8. Implement each section using existing components where possible
9. Validate responsive behavior against Figma constraints

**Result:** Complete dashboard matching Figma design with responsive layout.

## Best Practices

### Always Start with Context

Never implement based on assumptions. Always call `get_design_context` and `get_screenshot` before writing code.

### Incremental Validation

Validate throughout implementation rather than only at the end. Catching discrepancies early avoids costly corrections later.

### Document Deviations

If a deviation from the Figma design is unavoidable (for example, due to accessibility requirements or technical constraints), explain the reason in code comments.

### Reuse Over Recreation

Check for existing components before building new ones. Codebase consistency takes precedence over literal Figma replication.

### Design System First

When uncertain, favor the project's design system patterns over a direct translation from Figma.

## Common Issues and Solutions

### Issue: Figma output is truncated

**Cause:** The design is too complex or contains too many nested layers to return in a single response.
**Solution:** Use `get_metadata` to retrieve the node structure, then call `get_design_context` for each relevant node individually.

### Issue: Design doesn't match after implementation

**Cause:** Visual discrepancies exist between the implemented code and the original Figma design.
**Solution:** Compare side-by-side against the screenshot captured in Step 3. Cross-check spacing, colors, and typography against the design context data.

### Issue: Assets not loading

**Cause:** The Figma MCP server's assets endpoint is inaccessible, or the asset URLs are being altered.
**Solution:** Confirm the Figma MCP server's assets endpoint is reachable. The server delivers assets via `localhost` URLs — use them directly without modification.

### Issue: Design token values differ from Figma

**Cause:** The project's design system tokens carry different values than those defined in the Figma design.
**Solution:** When project tokens diverge from Figma values, use project tokens for consistency but adjust spacing or sizing as necessary to preserve visual fidelity.

## Understanding Design Implementation

The Figma implementation workflow establishes a dependable process for converting designs into code:

**For designers:** Assurance that implementations will reproduce their designs with pixel-perfect accuracy.
**For developers:** A clear, structured approach that removes guesswork and minimizes revision cycles.
**For teams:** Consistent, high-quality output that upholds design system integrity.

Following this workflow ensures every Figma design is delivered with the same standard of care and precision.

## Additional Resources

- [Figma MCP Server Documentation](https://developers.figma.com/docs/figma-mcp-server/)
- [Figma MCP Server Tools and Prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/)
- [Figma Variables and Design Tokens](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)
