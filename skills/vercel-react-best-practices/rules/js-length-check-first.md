---
title: Early Length Check for Array Comparisons
impact: MEDIUM-HIGH
impactDescription: avoids expensive operations when lengths differ
tags: javascript, arrays, performance, optimization, comparison
---

## Early Length Check for Array Comparisons

Before performing expensive array comparisons (sorting, deep equality, serialization), verify that the lengths match first. Arrays of different lengths cannot be equal.

In practice, this optimization delivers the greatest benefit when the comparison executes in hot paths such as event handlers and render loops.

**Incorrect (always runs expensive comparison):**

```typescript
function hasChanges(current: string[], original: string[]) {
  // Always sorts and joins, even when lengths differ
  return current.sort().join() !== original.sort().join()
}
```

Both O(n log n) sorts execute regardless of whether `current.length` is 5 and `original.length` is 100. Joining the arrays and comparing the resulting strings adds further overhead.

**Correct (O(1) length check first):**

```typescript
function hasChanges(current: string[], original: string[]) {
  // Early return if lengths differ
  if (current.length !== original.length) {
    return true
  }
  // Only sort when lengths match
  const currentSorted = current.toSorted()
  const originalSorted = original.toSorted()
  for (let i = 0; i < currentSorted.length; i++) {
    if (currentSorted[i] !== originalSorted[i]) {
      return true
    }
  }
  return false
}
```

This approach is more efficient for several reasons:
- Sorting and joining are skipped entirely when lengths differ
- No memory is consumed by joined strings (particularly important for large arrays)
- The original arrays are never mutated
- Iteration stops as soon as a difference is detected
