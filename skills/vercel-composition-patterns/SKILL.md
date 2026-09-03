---
name: vercel-composition-patterns
description: >-
  Scalable React composition patterns. Apply when refactoring components
  suffering from boolean prop proliferation, building flexible component libraries,
  or designing reusable APIs. Activates on tasks involving compound components,
  render props, context providers, or component architecture. Covers React 19
  API changes.
license: MIT
metadata:
  author: vercel
  version: 1.0.0
  category: development
  source:
    repository: 'https://github.com/vercel-labs/agent-skills'
    path: skills/composition-patterns
    commit: f8a72b9603728bb92a217a879b7e62e43ad76c81
---

# React Composition Patterns

Composition patterns for constructing flexible, maintainable React components. Prevent
boolean prop proliferation by adopting compound components, lifting state, and
composing internals. These patterns improve codebase manageability for both humans and AI
agents as projects grow in scale.

## When to Apply

Consult these guidelines when:

- Refactoring components that carry many boolean props
- Constructing reusable component libraries
- Designing flexible component APIs
- Auditing component architecture
- Working with compound components or context providers

## Rule Categories by Priority

| Priority | Category                | Impact | Prefix          |
| -------- | ----------------------- | ------ | --------------- |
| 1        | Component Architecture  | HIGH   | `architecture-` |
| 2        | State Management        | MEDIUM | `state-`        |
| 3        | Implementation Patterns | MEDIUM | `patterns-`     |
| 4        | React 19 APIs           | MEDIUM | `react19-`      |

## Quick Reference

### 1. Component Architecture (HIGH)

- `architecture-avoid-boolean-props` - Don't add boolean props to customize
  behavior; use composition
- `architecture-compound-components` - Structure complex components with shared
  context

### 2. State Management (MEDIUM)

- `state-decouple-implementation` - Provider is the only place that knows how
  state is managed
- `state-context-interface` - Define generic interface with state, actions, meta
  for dependency injection
- `state-lift-state` - Move state into provider components for sibling access

### 3. Implementation Patterns (MEDIUM)

- `patterns-explicit-variants` - Create explicit variant components instead of
  boolean modes
- `patterns-children-over-render-props` - Use children for composition instead
  of renderX props

### 4. React 19 APIs (MEDIUM)

> **⚠️ React 19+ only.** Skip this section if using React 18 or earlier.

- `react19-no-forwardref` - Don't use `forwardRef`; use `use()` instead of `useContext()`

## How to Use

Consult individual rule files for thorough explanations and code examples:

```
rules/architecture-avoid-boolean-props.md
rules/state-context-interface.md
```

Each rule file includes:

- A concise explanation of why the rule matters
- An incorrect code example with commentary
- A correct code example with commentary
- Additional context and references

## Full Compiled Document

For the complete guide with all rules expanded, see: `AGENTS.md`
