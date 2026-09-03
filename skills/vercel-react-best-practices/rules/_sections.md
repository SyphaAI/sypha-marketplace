# Sections

This file specifies all sections along with their ordering, impact levels, and descriptions.
The section ID shown in parentheses is the filename prefix used to group related rules.

---

## 1. Eliminating Waterfalls (async)

**Impact:** CRITICAL
**Description:** Waterfalls are the single biggest performance killer. Every sequential await introduces a full round of network latency. Removing them delivers the greatest performance gains.

## 2. Bundle Size Optimization (bundle)

**Impact:** CRITICAL
**Description:** Shrinking the initial bundle size leads to better Time to Interactive and Largest Contentful Paint scores.

## 3. Server-Side Performance (server)

**Impact:** HIGH
**Description:** Tuning server-side rendering and data fetching removes server-side waterfalls and cuts response times.

## 4. Client-Side Data Fetching (client)

**Impact:** MEDIUM-HIGH
**Description:** Built-in deduplication and well-structured data fetching patterns cut down on redundant network requests.

## 5. Re-render Optimization (rerender)

**Impact:** MEDIUM
**Description:** Cutting down on needless re-renders reduces wasted computation and keeps the UI more responsive.

## 6. Rendering Performance (rendering)

**Impact:** MEDIUM
**Description:** Improving the rendering pipeline lowers the amount of work the browser has to perform.

## 7. JavaScript Performance (js)

**Impact:** LOW-MEDIUM
**Description:** Small optimizations applied to hot paths accumulate into worthwhile overall improvements.

## 8. Advanced Patterns (advanced)

**Impact:** LOW
**Description:** Specialized patterns for edge cases that demand deliberate and careful implementation.
