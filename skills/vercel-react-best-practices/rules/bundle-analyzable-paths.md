---
title: Prefer Statically Analyzable Paths
impact: HIGH
impactDescription: avoids accidental broad bundles and file traces
tags: bundle, nextjs, vite, webpack, rollup, esbuild, path
---

## Prefer Statically Analyzable Paths

Build tools operate most effectively when import and file-system paths can be determined at build time. Hiding the actual path inside a variable or assembling it dynamically forces the tool to either pull in a wide set of candidate files, emit a warning that it cannot trace the import, or expand file tracing to be safe.

Use explicit lookup maps or literal paths so that the set of reachable files remains narrow and deterministic. This principle applies equally whether you are selecting modules through `import()` or reading files in server and build code.

When analysis scope grows too large, the penalties are concrete:
- Larger server bundles
- Slower builds
- Worse cold starts
- Higher memory consumption

### Import Paths

**Incorrect (the bundler cannot tell what may be imported):**

```ts
const PAGE_MODULES = {
  home: './pages/home',
  settings: './pages/settings',
} as const

const Page = await import(PAGE_MODULES[pageName])
```

**Correct (use an explicit map of allowed modules):**

```ts
const PAGE_MODULES = {
  home: () => import('./pages/home'),
  settings: () => import('./pages/settings'),
} as const

const Page = await PAGE_MODULES[pageName]()
```

### File-System Paths

**Incorrect (a 2-value enum still hides the final path from static analysis):**

```ts
const baseDir = path.join(process.cwd(), 'content/' + contentKind)
```

**Correct (make each final path literal at the callsite):**

```ts
const baseDir =
  kind === ContentKind.Blog
    ? path.join(process.cwd(), 'content/blog')
    : path.join(process.cwd(), 'content/docs')
```

In Next.js server code, this also affects output file tracing. Using `path.join(process.cwd(), someVar)` can broaden the traced file set because Next.js performs static analysis of `import`, `require`, and `fs` calls.

Reference: [Next.js output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Next.js dynamic imports](https://nextjs.org/learn/seo/dynamic-imports), [Vite features](https://vite.dev/guide/features.html), [esbuild API](https://esbuild.github.io/api/), [Rollup dynamic import vars](https://www.npmjs.com/package/@rollup/plugin-dynamic-import-vars), [Webpack dependency management](https://webpack.js.org/guides/dependency-management/)
