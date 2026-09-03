# Update Query Examples

## replaceOne vs. updateOne with $replaceWith

**Bad** — A full document replacement produces a large oplog entry:

```javascript
db.coll.replaceOne({ _id: X }, entireNewDocument)
```

**Good** — Use an aggregation-based update to produce smaller oplog deltas:

```javascript
db.coll.updateOne({ _id: X }, [{ $replaceWith: { $literal: entireNewDocument } }])
```

**Why:** `replaceOne` writes the entire document to the oplog. The aggregation update syntax allows MongoDB to compute field-level deltas, yielding smaller oplog entries when only a handful of fields change.

## findOneAndUpdate Misuse vs. updateOne

**Bad** — Calling `findOneAndUpdate` when the returned document is not needed:

```javascript
db.coll.findOneAndUpdate(
  { _id: X },
  { $set: { status: "processed" } }
)
```

**Good** — Use `updateOne` when the result document is not required:

```javascript
db.coll.updateOne(
  { _id: X },
  { $set: { status: "processed" } }
)
```

**Why:** `findOneAndUpdate` stores a copy of the pre-modification document in a side collection to support retryable writes. That overhead is wasted when you have no use for the returned document.
