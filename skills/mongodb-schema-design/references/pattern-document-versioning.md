---
title: "Document Versioning Pattern"
impact: MEDIUM
impactDescription: "Enables reproducing exact historical document state for audit, compliance, and rollback"
tags: schema, patterns, versioning, audit, compliance
---

## Document Versioning Pattern

**Maintain complete document history in a dedicated `revisions` collection to allow reconstruction of historical state.** This differs from schema versioning (which manages field migration) — document versioning preserves full snapshots of every change. Apply it to insurance policies, legal documents, compliance audit trails, and any data where exact historical state must be reproducible.

**Incorrect (overwrite history with no trail):**

```javascript
// Policy document — only current state exists
{
  _id: "POL-001",
  holder: "Jane Smith",
  premium: 450,
  coverage: "comprehensive",
  updatedAt: ISODate("2024-06-01")
}

// When premium changes, old value is lost forever
db.policies.updateOne(
  { _id: "POL-001" },
  { $set: { premium: 475, updatedAt: new Date() } }
)
// Previous premium of 450 is gone — no audit trail
// Cannot reproduce what the policy looked like on 2024-03-15
// Compliance audit fails: "show me the policy as of Q1"
```

**Correct (current collection + revisions collection):**

```javascript
// currentPolicies collection — current state only (fast reads)
{
  _id: "POL-001",
  holder: "Jane Smith",
  premium: 450,
  coverage: "comprehensive",
  v: 3,
  updatedAt: ISODate("2024-06-01")
}

// policyRevisions collection — full history snapshots
{
  policyId: "POL-001",
  v: 2,
  snapshot: {
    holder: "Jane Smith",
    premium: 425,
    coverage: "basic",
    v: 2
  },
  changedAt: ISODate("2024-03-15")
}
```

**Implementation:**

```javascript
async function updatePolicy(policyId, newData, session) {
  const current = await db.currentPolicies.findOne({ _id: policyId }, { session })

  await db.policyRevisions.insertOne({
    policyId: current._id,
    v: current.v,
    snapshot: { ...current },
    changedAt: new Date()
  }, { session })

  await db.currentPolicies.updateOne(
    { _id: policyId },
    { $set: { ...newData, v: current.v + 1, updatedAt: new Date() } },
    { session }
  )
}

async function getPolicyAtVersion(policyId, version) {
  if (version === 'current') {
    return db.currentPolicies.findOne({ _id: policyId })
  }
  const rev = await db.policyRevisions.findOne({ policyId, v: version })
  return rev?.snapshot
}
```

**Using Transactions for Atomicity:**

The `updatePolicy` function writes to two collections (inserting a revision **and** updating the current document). Depending on your use case, it may be appropriate to wrap this call in a [multi-document transaction](https://mongodb.com/docs/manual/core/transactions/) to ensure both writes either succeed or fail as a unit:

```javascript
const session = client.startSession()
try {
  await session.withTransaction(async () => {
    await updatePolicy("POL-001", { premium: 475, coverage: "premium" }, session)
  })
} finally {
  await session.endSession()
}
```

**Indexes:**

```javascript
db.policyRevisions.createIndex({ policyId: 1, v: -1 })
// Optional TTL for retention (e.g., 7 years)
db.policyRevisions.createIndex({ changedAt: 1 }, { expireAfterSeconds: 220752000 })
```

**Difference from Schema Versioning:**

| Pattern | Purpose | Stores |
|---------|---------|--------|
| Schema Versioning | Handle field structure migration | `schemaVersion` field on each doc |
| Document Versioning | Reproduce complete historical state | Full snapshots in revisions collection |

**When NOT to use this pattern:**

- **High-frequency updates**: If documents are modified many times per second, event sourcing is a better fit.
- **Approximate history is sufficient**: If you only need to track what changed without reconstructing exact state.
- **Unbounded revision growth without retention**: Make sure a TTL index or archival policy is in place for the revisions collection.

## Verify with

```javascript
// Check revision collection growth
db.policyRevisions.aggregate([
  { $group: {
    _id: "$policyId",
    revisionCount: { $sum: 1 },
    oldestRevision: { $min: "$changedAt" },
    newestRevision: { $max: "$changedAt" }
  }},
  { $sort: { revisionCount: -1 } },
  { $limit: 10 }
])
// Monitor for documents with unexpectedly high revision counts

// Verify current docs have version field
db.currentPolicies.countDocuments({ v: { $exists: false } })
// Should be 0 — all documents need version tracking

// Check that revisions are consistent with current version
db.currentPolicies.aggregate([
  { $lookup: {
    from: "policyRevisions",
    localField: "_id",
    foreignField: "policyId",
    as: "revisions"
  }},
  { $project: {
    currentVersion: "$v",
    revisionCount: { $size: "$revisions" },
    maxRevisionVersion: { $max: "$revisions.v" }
  }},
  { $match: {
    $expr: { $ne: [{ $subtract: ["$currentVersion", 1] }, "$maxRevisionVersion"] }
  }}
])
// Finds documents where revision history has gaps
```

Reference: [Keep a History of Document Versions](https://mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/)
