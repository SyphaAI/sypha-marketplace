---
title: Suppress Expected Hydration Mismatches
impact: LOW-MEDIUM
impactDescription: avoids noisy hydration warnings for known differences
tags: rendering, hydration, ssr, nextjs
---

## Suppress Expected Hydration Mismatches

In SSR frameworks (e.g., Next.js), certain values are deliberately different between server and client renders (random IDs, dates, locale/timezone formatting). For these *expected* mismatches, add `suppressHydrationWarning` to the containing element to silence the noisy warnings. Do not use this to mask genuine bugs, and avoid overusing it.

**Incorrect (known mismatch warnings):**

```tsx
function Timestamp() {
  return <span>{new Date().toLocaleString()}</span>
}
```

**Correct (suppress expected mismatch only):**

```tsx
function Timestamp() {
  return (
    <span suppressHydrationWarning>
      {new Date().toLocaleString()}
    </span>
  )
}
```
