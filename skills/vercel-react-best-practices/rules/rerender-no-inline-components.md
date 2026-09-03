---
title: Don't Define Components Inside Components
impact: HIGH
impactDescription: prevents remount on every render
tags: rerender, components, remount, performance
---

## Don't Define Components Inside Components

**Impact: HIGH (prevents remount on every render)**

Declaring a component inside another component generates a new component type on every render. Because React sees a different type each time, it fully remounts the component, wiping all state and DOM.

Developers often do this to read parent-scope variables without threading props. The correct approach is always to pass those values as props.

**Incorrect (remounts on every render):**

```tsx
function UserProfile({ user, theme }) {
  // Defined inside to access `theme` - BAD
  const Avatar = () => (
    <img
      src={user.avatarUrl}
      className={theme === 'dark' ? 'avatar-dark' : 'avatar-light'}
    />
  )

  // Defined inside to access `user` - BAD
  const Stats = () => (
    <div>
      <span>{user.followers} followers</span>
      <span>{user.posts} posts</span>
    </div>
  )

  return (
    <div>
      <Avatar />
      <Stats />
    </div>
  )
}
```

Each time `UserProfile` renders, `Avatar` and `Stats` are brand-new component types. React tears down the existing instances and mounts fresh ones, discarding internal state, re-running effects, and rebuilding DOM nodes.

**Correct (pass props instead):**

```tsx
function Avatar({ src, theme }: { src: string; theme: string }) {
  return (
    <img
      src={src}
      className={theme === 'dark' ? 'avatar-dark' : 'avatar-light'}
    />
  )
}

function Stats({ followers, posts }: { followers: number; posts: number }) {
  return (
    <div>
      <span>{followers} followers</span>
      <span>{posts} posts</span>
    </div>
  )
}

function UserProfile({ user, theme }) {
  return (
    <div>
      <Avatar src={user.avatarUrl} theme={theme} />
      <Stats followers={user.followers} posts={user.posts} />
    </div>
  )
}
```

**Symptoms of this bug:**
- Input fields lose focus on every keystroke
- Animations restart unexpectedly
- `useEffect` cleanup/setup runs on every parent render
- Scroll position resets inside the component
