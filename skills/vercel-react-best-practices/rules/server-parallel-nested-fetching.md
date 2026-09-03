---
title: Parallel Nested Data Fetching
impact: CRITICAL
impactDescription: eliminates server-side waterfalls
tags: server, rsc, parallel-fetching, promise-chaining
---

## Parallel Nested Data Fetching

When retrieving nested data in parallel, attach dependent fetches directly to each item's promise so that one slow item cannot hold up the rest.

**Incorrect (a single slow item blocks all nested fetches):**

```tsx
const chats = await Promise.all(
  chatIds.map(id => getChat(id))
)

const chatAuthors = await Promise.all(
  chats.map(chat => getUser(chat.author))
)
```

If one `getChat(id)` out of 100 is extremely slow, the authors of the other 99 chats can't start loading even though their data is ready.

**Correct (each item chains its own nested fetch):**

```tsx
const chatAuthors = await Promise.all(
  chatIds.map(id => getChat(id).then(chat => getUser(chat.author)))
)
```

Every item chains `getChat` → `getUser` on its own, so a sluggish chat fetch does not delay author lookups for the remaining items.
