---
name: kafka-schema-registry
description: >-
  Analyze a folder or repo to find Kafka applications, derive schemas from
  their data models, flag PII fields, produce Terraform that registers schemas
  with Confluent Schema Registry, and write a migration report that includes
  rollout ordering. Invoke this skill whenever a user wants a project scanned
  for Kafka usage, schemas extracted, producer/consumer configurations
  audited, or Terraform generated for Schema Registry.
metadata:
  category: data
  source:
    repository: 'https://github.com/confluentinc/agent-skills'
    path: skills/kafka-schema-registry
    license_path: LICENSE
    commit: 9095afceac13c8924c7b9993b26f0f57abd8b267
---

# Kafka Schema Registry Skill

Analyze a project to locate Kafka applications, pull out their schemas, produce Terraform that registers those schemas with Schema Registry, and write a comprehensive analysis report.

## When to Use

Trigger this skill when:
- A user wants a project analyzed for Kafka usage so that event schemas can be added or Schema Registry can be integrated
- A user asks to have schemas extracted from Kafka producers
- A user needs Terraform that registers schemas in Schema Registry
- A user wants their Kafka producer/consumer configurations audited

## Deliverables

Running this skill creates 3 outputs inside the target project:

1. **`schema-report.md`** — Complete analysis report covering findings, risks, and upgrade recommendations
2. **`schemas/`** — The extracted schema files (Avro, JSON Schema, Protobuf), with PII tags applied
3. **`terraform/`** — Terraform configurations that register the schemas via the Confluent provider

### Optional: Code Migration Assistance

When the user requests that their application code itself be modified to work with Schema Registry, follow the [Code Migration Reference](references/code-migration.md) to apply the correct Schema Registry integration patterns to the code.

---

## High-Level Workflow

### Phase 0: Initialize

- Manually look for an existing `schema.yaml` and `schemas/` directory
- Record any schema infrastructure that already exists in the report

### Phase 1: Project Scan & Kafka Detection

1. **Locate build files** — Look for `pom.xml`, `build.gradle`, `requirements.txt`, `package.json`, etc.
2. **Spot Kafka dependencies** — Search for `spring-kafka`, `confluent-kafka`, `kafkajs`, etc.
3. **Locate producers & consumers** — Grep for `KafkaTemplate`, `Producer(`, `producer.send`, etc.
4. **Pull out topic names** — Taken from string literals, config properties, YAML files
5. **Determine serializers** — Locate `value.serializer`, `KafkaAvroSerializer`, custom serializers
6. **Assemble the app catalog** — Bring the findings together: app name, language, role, topics, serializer, category

**Detailed patterns:** [Detection Patterns Reference](references/detection-patterns.md)

**App catalog structure:**
```yaml
app_name: module name
language: Java | Python | .NET | Go | Node/TS
role: producer | consumer | both
topics: [list of topics]
serializer_class: value.serializer used
custom_serializer: true | false
schema_format: AVRO | JSON | PROTOBUF | UNKNOWN
sr_integrated: true | false
category: A | B | C | D | E  # REQUIRED
```

**Multi-schema topic detection:**
- When several data models write to a single topic, build a wrapper schema using `oneOf`/union/`oneof`
- Emit Terraform containing `schema_reference` blocks
- Call this out prominently in the report

### Phase 2: Risk Detection

Look for:
- **`auto.register.schemas=true`** — Schema evolution without controls (Category C)
- **`use.latest.version`** — When enabled, makes migration easier
- **Custom serializers** — Skip SR completely (Category E)

For every occurrence, note the file path, line number, and the topics involved.

**Patterns:** [Detection Patterns Reference](references/detection-patterns.md#risk-detection)

### Phase 3: Schema Inference

For every producer:
1. **Look for schema files that already exist** — `**/*.avsc`, `**/*.proto`, `**/*.schema.json`
2. **Derive from data models** — Java classes, Pydantic models, TypeScript interfaces, Go structs
3. **Derive from inline data** — HashMap, dict literals, map[string]any, plain objects, JSON strings
4. **Translate into schemas** — Convert language types to JSON Schema / Avro / Protobuf
5. **Apply PII tags** — Inspect field names for `email`, `ssn`, `phone`, `address`, etc.

**PII tagging:** Attach `confluent:tags` (`PII`, `PRIVATE`, `SENSITIVE`, `PHI`) to the fields you detect.

**Detailed inference patterns:** [Schema Inference Reference](references/schema-inference.md)

### Phase 4: Categorize Producers

Assign each producer a classification:

| Category | Criteria |
|----------|----------|
| **A: Compliant** | Confluent serializer + SR + no auto.register |
| **A→Header** | On SR already, moving to headers |
| **B: Schema in code, no SR** | Data models are present, but SR is not integrated |
| **C: Auto-register** | `auto.register.schemas=true` |
| **D: No schema** | Raw strings/bytes with no data model |
| **E: Custom serializer** | Custom `Serializer<T>` or inline serialization without SR |

**CRITICAL:** The exact phrase "Category X" must appear in:
- App catalog field
- Applications Discovered table
- Report section headers
- Terraform comments
- Risk sections

**Details:** [Categorization Reference](references/categorization.md)

### Phase 5: Create Schema Files

**Directory structure:**
```
schemas/
├── avro/
│   └── {topic}-value.avsc
├── json/
│   └── {topic}-value.json
└── proto/
    └── {topic}-value.proto
```

**File naming:** **kebab-case** (lowercase with hyphens) is REQUIRED:
- Value: `{topic}-value.{ext}`
- Key: `{topic}-key.{ext}`
- Examples: `order-events-value.avsc`, `user-notifications-value.json`

**Initialize:** Create `schema.yaml`.

**Validate:** If available, invoke `schema_lint(path: schemas/, fix: true)`.

### Phase 6: Generate Terraform

**File structure (MANDATORY separate files):**
```
terraform/
├── providers.tf              # Provider config
├── variables.tf              # Variable definitions
├── tags.tf                   # confluent_tag resources (if PII exists)
├── schemas.tf                # Active schemas (A, B, E)
├── flagged-auto-register.tf  # Category C only (commented out)
├── outputs.tf                # Output values
└── import.sh                 # Import script
```

**CRITICAL:**
- `schemas.tf` = Categories A, B, E — NOT commented out
- `flagged-auto-register.tf` = Category C ONLY — MUST be commented out
- `tags.tf` = MUST be present whenever ANY schema uses `confluent:tags`
- Every schema resource MUST carry a comment block listing: Topic, App, Source, Category

**Templates:** [Terraform Templates Reference](references/terraform-templates.md)

### Phase 7: Generate Report

Write `schema-report.md` containing:
- Executive Summary (metrics + category breakdown)
- **Applications Discovered table** (EXACT format, Category column MANDATORY)
- RISKS (auto-register, custom serializers)
- Producer Upgrade Recommendations (one per app, heading includes "Category X")
- Migration Rollout Ordering (grouped by category)
- PII Fields Detected
- Terraform Resources Generated
- Next Steps checklist

**CRITICAL formatting requirements:**
1. Applications Discovered = markdown table, NOT narrative sections
2. Every app section MUST state "Category X" explicitly
3. Every Terraform resource requires a comment block

**Template:** [Report Template Reference](references/report-template.md)

---

## Migration Rollout by Category

- **Category B** (JSON, no SR): Producers first → consumers
- **Category A→Header** (already on SR): Verify consumer versions → producers only
- **Category C** (auto-register): Register via Terraform → disable auto-register → producers fetch latest
- **Category E** (custom serializers): Consumers first (composite deserializer) → producers

**Details:** [Categorization Reference](references/categorization.md#migration-rollout-order-by-category)

---

## Edge Cases

- **Monorepos:** Every service/module carrying Kafka dependencies counts as its own app
- **Multi-topic producers:** Emit one schema resource for each topic
- **Shared schemas:** A single schema file may be referenced by multiple Terraform resources
- **No topic names:** When topics come from env vars, insert placeholders marked with TODO
- **Test code:** Ignore test directories unless schema definitions are the only thing they contain
- **Multiple serializers:** Produce a separate schema file for each format

---

## Output Organization

```
{project_root}/
├── schema-report.md              # Analysis report
├── schemas/
│   ├── schema.yaml               # Schema project config
│   ├── avro/
│   │   └── {topic}-value.avsc
│   ├── json/
│   │   └── {topic}-value.json
│   └── proto/
│       └── {topic}-value.proto
└── terraform/
    ├── providers.tf
    ├── variables.tf
    ├── tags.tf                    # PII/PRIVATE/SENSITIVE tags
    ├── schemas.tf                 # Active schemas (depends_on tags)
    ├── flagged-auto-register.tf   # Commented-out Category C
    ├── outputs.tf
    └── import.sh                  # Import existing schemas
```

---

## Reference Documentation

- [Detection Patterns](references/detection-patterns.md) — Patterns for locating Kafka apps, dependencies, producers, consumers, serializers
- [Schema Inference](references/schema-inference.md) — Deriving schemas from data models and inline data, plus PII tagging
- [Categorization](references/categorization.md) — What each category means, rollout ordering, minimum client versions
- [Terraform Templates](references/terraform-templates.md) — File layout, templates, naming conventions
- [Report Template](references/report-template.md) — Mandatory sections, formatting rules, validation checklist
- [Code Migration](references/code-migration.md) — Serializer/deserializer implementation patterns covering Python, Java, JavaScript, Go, and .NET

---

## Execution Approach

1. Use **Glob** to locate build files and schema files
2. Use **Grep** to detect patterns (dependencies, producers, serializers, risks)
3. Use **Read** to examine source files and data models
4. Use **Write** to produce schema files, Terraform configs, and the report

**The Agent tool is not needed** — this skill is self-contained and relies on direct tool calls.
