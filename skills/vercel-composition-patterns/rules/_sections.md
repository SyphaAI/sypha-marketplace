# Sections

This file specifies all sections, their ordering, impact levels, and descriptions.
The section ID shown in parentheses is the filename prefix used to group rules.

---

## 1. Component Architecture (architecture)

**Impact:** HIGH
**Description:** Core patterns for organizing components in ways that prevent prop
proliferation and allow for flexible composition.

## 2. State Management (state)

**Impact:** MEDIUM
**Description:** Patterns for hoisting state and managing shared context across
composed components.

## 3. Implementation Patterns (patterns)

**Impact:** MEDIUM
**Description:** Concrete techniques for building compound components and
context providers.

## 4. React 19 APIs (react19)

**Impact:** MEDIUM
**Description:** React 19+ only. Do not use `forwardRef`; use `use()` in place of `useContext()`.
