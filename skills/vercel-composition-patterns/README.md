# React Composition Patterns

A structured collection of React composition patterns built to scale. These
patterns prevent boolean prop proliferation by leveraging compound components,
lifting state, and composing internals.

## Structure

- `rules/` - Individual rule files (one per rule)
  - `_sections.md` - Section metadata (titles, impacts, descriptions)
  - `_template.md` - Template for creating new rules
  - `area-description.md` - Individual rule files
- `metadata.json` - Document metadata (version, organization, abstract)
- **`AGENTS.md`** - Compiled output (generated)

## Rules

### Component Architecture (CRITICAL)

- `architecture-avoid-boolean-props.md` - Don't add boolean props to customize
  behavior
- `architecture-compound-components.md` - Structure as compound components with
  shared context

### State Management (HIGH)

- `state-lift-state.md` - Lift state into provider components
- `state-context-interface.md` - Define clear context interfaces
  (state/actions/meta)
- `state-decouple-implementation.md` - Decouple state management from UI

### Implementation Patterns (MEDIUM)

- `patterns-children-over-render-props.md` - Prefer children over renderX props
- `patterns-explicit-variants.md` - Create explicit component variants

## Core Principles

1. **Composition over configuration** — Rather than adding props, let consumers
   compose
2. **Lift your state** — Keep state in providers, not locked inside components
3. **Compose your internals** — Subcomponents read from context, not props
4. **Explicit variants** — Define ThreadComposer, EditComposer, not a Composer
   with isThread

## Creating a New Rule

1. Copy `rules/_template.md` to `rules/area-description.md`
2. Select the appropriate area prefix:
   - `architecture-` for Component Architecture
   - `state-` for State Management
   - `patterns-` for Implementation Patterns
3. Complete the frontmatter and content sections
4. Include clear examples accompanied by explanations

## Impact Levels

- `CRITICAL` - Foundational patterns that prevent unmaintainable code
- `HIGH` - Substantial improvements to long-term maintainability
- `MEDIUM` - Recommended practices that produce cleaner code
