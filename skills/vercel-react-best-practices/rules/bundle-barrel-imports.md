---
title: Avoid Barrel File Imports
impact: CRITICAL
impactDescription: 200-800ms import cost, slow builds
tags: bundle, imports, tree-shaking, barrel-files, performance
---

## Avoid Barrel File Imports

Import directly from individual source files rather than barrel files to prevent pulling in thousands of modules you never use. **Barrel files** are aggregation entry points that re-export multiple modules (e.g., an `index.js` that contains `export * from './module'`).

Widely used icon and component libraries can expose **up to 10,000 re-exports** through their entry file. For many React packages, **the import alone costs 200-800ms**, which degrades both development startup time and production cold starts.

**Why tree-shaking doesn't help:** When a library is declared as external (not inlined by the bundler), the bundler has no opportunity to optimize it. Bundling it to unlock tree-shaking instead causes builds to slow down significantly as the entire module graph is analyzed.

**Incorrect (imports entire library):**

```tsx
import { Check, X, Menu } from 'lucide-react'
// Loads 1,583 modules, takes ~2.8s extra in dev
// Runtime cost: 200-800ms on every cold start

import { Button, TextField } from '@mui/material'
// Loads 2,225 modules, takes ~4.2s extra in dev
```

**Correct - Next.js 13.5+ (recommended):**

```js
// next.config.js - automatically optimizes barrel imports at build time
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@mui/material']
  }
}
```

```tsx
// Keep the standard imports - Next.js transforms them to direct imports
import { Check, X, Menu } from 'lucide-react'
// Full TypeScript support, no manual path wrangling
```

This approach is preferred because it maintains full TypeScript type safety and editor autocompletion while removing the barrel import overhead.

**Correct - Direct imports (non-Next.js projects):**

```tsx
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
// Loads only what you use
```

> **TypeScript warning:** Certain libraries (most notably `lucide-react`) do not provide `.d.ts` files for their deep import paths. Importing via `lucide-react/dist/esm/icons/check` resolves to an implicit `any` type, which breaks compilation under `strict` or `noImplicitAny`. Use `optimizePackageImports` whenever it is available, or confirm that the library publishes types for its subpaths before switching to direct imports.

Applying these optimizations yields 15-70% faster dev boot, 28% faster builds, 40% faster cold starts, and noticeably quicker HMR.

Commonly affected libraries: `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@headlessui/react`, `@radix-ui/react-*`, `lodash`, `ramda`, `date-fns`, `rxjs`, `react-use`.

Reference: [How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
