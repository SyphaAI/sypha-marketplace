---
title: Cross-Request LRU Caching
impact: HIGH
impactDescription: caches across requests
tags: server, cache, lru, cross-request
---

## Cross-Request LRU Caching

`React.cache()` is scoped to a single request. When data must be shared across sequential requests (for example, a user clicks button A then button B), reach for an LRU cache instead.

**Implementation:**

```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 5 * 60 * 1000  // 5 minutes
})

export async function getUser(id: string) {
  const cached = cache.get(id)
  if (cached) return cached

  const user = await db.user.findUnique({ where: { id } })
  cache.set(id, user)
  return user
}

// Request 1: DB query, result cached
// Request 2: cache hit, no DB query
```

Apply this when back-to-back user actions reach multiple endpoints that need the same data within a short window.

**With Vercel's [Fluid Compute](https://vercel.com/docs/fluid-compute):** LRU caching is particularly powerful here because concurrent requests share the same function instance and its cache. The cache survives across requests without requiring external storage such as Redis.

**In traditional serverless:** Every invocation is isolated, so look to Redis for cross-process caching needs.

Reference: [https://github.com/isaacs/node-lru-cache](https://github.com/isaacs/node-lru-cache)
