---
title: Split Combined Hook Computations
impact: MEDIUM
impactDescription: avoids recomputing independent steps
tags: rerender, useMemo, useEffect, dependencies, optimization
---

## Split Combined Hook Computations

If a hook bundles multiple independent operations that each have their own dependencies, break them apart into separate hooks. A merged hook re-executes every operation whenever any dependency changes, even if a given operation has no interest in the changed value.

**Incorrect (changing `sortOrder` recomputes filtering):**

```tsx
const sortedProducts = useMemo(() => {
  const filtered = products.filter((p) => p.category === category)
  const sorted = filtered.toSorted((a, b) =>
    sortOrder === "asc" ? a.price - b.price : b.price - a.price
  )
  return sorted
}, [products, category, sortOrder])
```

**Correct (filtering only recomputes when products or category change):**

```tsx
const filteredProducts = useMemo(
  () => products.filter((p) => p.category === category),
  [products, category]
)

const sortedProducts = useMemo(
  () =>
    filteredProducts.toSorted((a, b) =>
      sortOrder === "asc" ? a.price - b.price : b.price - a.price
    ),
  [filteredProducts, sortOrder]
)
```

The same principle applies to `useEffect` when you bundle unrelated side effects together:

**Incorrect (both effects run when either dependency changes):**

```tsx
useEffect(() => {
  analytics.trackPageView(pathname)
  document.title = `${pageTitle} | My App`
}, [pathname, pageTitle])
```

**Correct (effects run independently):**

```tsx
useEffect(() => {
  analytics.trackPageView(pathname)
}, [pathname])

useEffect(() => {
  document.title = `${pageTitle} | My App`
}, [pageTitle])
```

**Note:** If your project uses [React Compiler](https://react.dev/learn/react-compiler), it handles dependency tracking automatically and may address some of these scenarios without manual intervention.
