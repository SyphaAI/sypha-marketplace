---
title: Avoid Shared Module State for Request Data
impact: HIGH
impactDescription: prevents concurrency bugs and request data leaks
tags: server, rsc, ssr, concurrency, security, state
---

## Avoid Shared Module State for Request Data

In React Server Components and client components rendered during SSR, do not use mutable module-level variables to pass request-scoped data between components. Server renders may proceed concurrently within the same process. When one render writes to shared module state and another reads it, you risk race conditions, cross-request data contamination, and security vulnerabilities where one user's data leaks into another user's response.

Think of module scope on the server as process-wide shared memory, not per-request private storage.

**Incorrect (request data leaks across concurrent renders):**

```tsx
let currentUser: User | null = null

export default async function Page() {
  currentUser = await auth()
  return <Dashboard />
}

async function Dashboard() {
  return <div>{currentUser?.name}</div>
}
```

If two requests overlap, request A sets `currentUser`, but request B can overwrite it before request A has finished rendering `Dashboard`.

**Correct (keep request data local to the render tree):**

```tsx
export default async function Page() {
  const user = await auth()
  return <Dashboard user={user} />
}

function Dashboard({ user }: { user: User | null }) {
  return <div>{user?.name}</div>
}
```

Permitted exceptions:

- Immutable static assets or configuration values loaded once at module initialization
- Shared caches that are deliberately designed for cross-request reuse and use proper cache keys
- Process-wide singletons that hold no request- or user-specific mutable state

For guidance on static assets and configuration, see [Hoist Static I/O to Module Level](./server-hoist-static-io.md).
