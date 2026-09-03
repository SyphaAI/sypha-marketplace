---
title: Per-Request Deduplication with React.cache()
impact: MEDIUM
impactDescription: deduplicates within request
tags: server, cache, react-cache, deduplication
---

## Per-Request Deduplication with React.cache()

Apply `React.cache()` to deduplicate server-side requests within a single render. Authentication calls and database queries see the greatest benefit.

**Usage:**

```typescript
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  return await db.user.findUnique({
    where: { id: session.user.id }
  })
})
```

Within a single request, any number of calls to `getCurrentUser()` will run the underlying query exactly once.

**Avoid passing inline objects as arguments:**

`React.cache()` relies on shallow equality (`Object.is`) to identify cache hits. Inline objects produce a new reference on every call, which prevents cache hits from ever occurring.

**Incorrect (always cache miss):**

```typescript
const getUser = cache(async (params: { uid: number }) => {
  return await db.user.findUnique({ where: { id: params.uid } })
})

// Each call creates new object, never hits cache
getUser({ uid: 1 })
getUser({ uid: 1 })  // Cache miss, runs query again
```

**Correct (cache hit):**

```typescript
const getUser = cache(async (uid: number) => {
  return await db.user.findUnique({ where: { id: uid } })
})

// Primitive args use value equality
getUser(1)
getUser(1)  // Cache hit, returns cached result
```

If passing an object is unavoidable, pass the same reference across calls:

```typescript
const params = { uid: 1 }
getUser(params)  // Query runs
getUser(params)  // Cache hit (same reference)
```

**Next.js-Specific Note:**

In Next.js, the `fetch` API is automatically patched with request memoization. Calls sharing the same URL and options are deduplicated automatically within a single request, so `React.cache()` is not needed for `fetch` calls. That said, `React.cache()` remains indispensable for other async work:

- Database queries (Prisma, Drizzle, etc.)
- Computationally intensive operations
- Authentication checks
- File system access
- Any async operation that is not a `fetch` call

Use `React.cache()` to eliminate duplicate executions of these operations across your component tree.

Reference: [React.cache documentation](https://react.dev/reference/react/cache)
