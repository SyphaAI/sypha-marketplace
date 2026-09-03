---
title: Use Schema Validation
impact: MEDIUM
impactDescription: "Prevents invalid data at database level, catches bugs before production corruption"
tags: schema, validation, json-schema, data-integrity, fundamentals
---

## Use Schema Validation

**Enforce document structure using MongoDB's built-in JSON Schema validation.** Intercept invalid data at write time rather than discovering malformed documents in production after thousands have accumulated. Schema validation serves as the last line of defense when application-layer checks fail.

**Incorrect (no validation):**

Without validation, any document shape is accepted: an `email` field can contain a non-email string, an `age` field can receive a string instead of a number, and required fields like `email` can be omitted altogether. These corrupt documents surface only when downstream consumers crash or produce wrong output — often months after the data was written.

**Correct (schema validation):**

```javascript
// Create collection with validation rules
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email address"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "must be 1-100 characters"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150,
          description: "must be integer 0-150"
        },
        status: {
          enum: ["active", "inactive", "pending"],
          description: "must be one of: active, inactive, pending"
        },
        addresses: {
          bsonType: "array",
          maxItems: 10,  // Prevent unbounded arrays
          items: {
            bsonType: "object",
            required: ["city"],
            properties: {
              street: { bsonType: "string" },
              city: { bsonType: "string" },
              zip: { bsonType: "string", pattern: "^[0-9]{5}$" }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Invalid inserts now fail immediately with clear error
db.users.insertOne({ email: "not-an-email" })
// Error: Document failed validation:
// "email" does not match pattern, "name" is required
```

**Validation levels and actions:**

| validationLevel | Behavior |
|-----------------|----------|
| `strict` | Validate ALL inserts and updates (default, recommended) |
| `moderate` | Only validate documents that already match schema |

| validationAction | Behavior |
|------------------|----------|
| `error` | Reject invalid documents (default, recommended) |
| `warn` | Allow but log warning (use during migration only) |

**Add validation to an existing collection:**

```javascript
// Start with moderate + warn to discover violations
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: {...} },
  validationLevel: "moderate",  // Don't break existing invalid docs
  validationAction: "warn"       // Log violations, don't block
})

// Check for violations using the actual validator shape
const info = db.getCollectionInfos({ name: "users" })[0]
const validator = info?.options?.validator
db.users.find({ $nor: [validator] })

// Then switch to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**When NOT to use this pattern:**

- **Rapid prototyping**: Defer validation during early development and add it before moving to production.
- **Schema-per-document designs**: Some collections deliberately store documents with varied shapes.
- **Log/event collections**: High-throughput write collections where validation CPU overhead is a concern.

## Verify with

```javascript
// Read current validator and validation settings
const info = db.getCollectionInfos({ name: "users" })[0]
printjson({
  validationLevel: info?.options?.validationLevel,
  validationAction: info?.options?.validationAction,
  validator: info?.options?.validator
})

// Primary compliance check: find documents that do NOT match validator
const validator = info?.options?.validator
db.users.find({ $nor: [validator] })
```

Reference: [Schema Validation](https://mongodb.com/docs/manual/core/schema-validation/)
