---
title: Check Cheap Conditions Before Async Flags
impact: HIGH
impactDescription: avoids unnecessary async work when a synchronous guard already fails
tags: async, await, feature-flags, short-circuit, conditional
---

## Check Cheap Conditions Before Async Flags

When a branch uses `await` for a flag or remote value and also depends on a **cheap synchronous** condition (local props, request metadata, already-loaded state), evaluate the cheap condition **first**. Without this, you pay the cost of the async call even when the compound condition can never be satisfied.

This rule is a specific application of [Defer Await Until Needed](./async-defer-await.md) for `flag && cheapCondition` style checks.

**Incorrect:**

```typescript
const someFlag = await getFlag()

if (someFlag && someCondition) {
  // ...
}
```

**Correct:**

```typescript
if (someCondition) {
  const someFlag = await getFlag()
  if (someFlag) {
    // ...
  }
}
```

This matters when `getFlag` involves a network call, a feature-flag service, or `React.cache` / DB work: bypassing it when `someCondition` is false eliminates that cost on the cold path.

Preserve the original order if `someCondition` is itself expensive, depends on the flag result, or side effects must execute in a specific sequence.
