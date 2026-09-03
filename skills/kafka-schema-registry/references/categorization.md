# Producer Categorization Reference

Assign every producer to a category according to its current state and the actions it requires.

## Category Definitions

| Category | Criteria | Action |
|----------|----------|--------|
| **A: Compliant** | Confluent serializer in use + schema.registry.url configured + no auto.register | Mark as compliant in the report. Still extract the schema into Terraform if IaC doesn't already manage it. |
| **A→Header: Already on SR, migrating to headers** | Confluent serializer + SR in use, wants the schema ID moved from the payload prefix into Kafka headers | Schema extraction is unnecessary. Add `HeaderSchemaIdSerializer` to producers. Consumers require no changes — Confluent deserializers automatically check both. |
| **B: Schema in code, no SR** | Data models/classes exist but the app relies on StringSerializer, JsonSerializer (Spring), kafka-python, kafkajs raw, or otherwise lacks Confluent SR integration | Extract schema → `terraform/schemas.tf` + add an upgrade recommendation |
| **C: Auto-register** | `auto.register.schemas=true` is set | Extract schema → `terraform/flagged-auto-register.tf` (commented out) + flag as a risk |
| **D: No schema** | Raw strings/bytes, no identifiable data model, hardcoded JSON strings | Note in the report and recommend moving to a schema-first approach |
| **E: Custom serializer** | Implements the `Serializer<T>` interface, or uses `json.dumps`/`JSON.stringify`/`JsonConvert`/`json.Marshal`/`GenericDatumWriter` inline — in every case without SR | Extract schema from the data model → `terraform/schemas.tf` + recommend swapping in a Confluent serializer |

## App Catalog Structure

Record this for every Kafka application:
```yaml
app_name: directory or module name
language: Java | Python | .NET | Go | Node/TS
role: producer | consumer | both
topics: [list of topic names]
serializer_class: the value.serializer being used
custom_serializer: true | false
custom_serializer_file: file:line where defined
schema_format: AVRO | JSON | PROTOBUF | UNKNOWN
sr_integrated: true | false
sr_url: schema registry URL if configured
auto_register: true | false
category: A | B | C | D | E
```

## Category Labeling Requirements

**CRITICAL:** The exact phrase "Category X" must appear in each of these places:

1. **App catalog** — internal field: `category: "C"`
2. **Applications Discovered table** — Category column containing the letter
3. **Report section headers** — "order-processor — Category C"
4. **Upgrade recommendations** — "Category X" belongs in the heading/first paragraph
5. **Terraform comments** — a `# Category: C` line
6. **Risk sections** — "Category C applications with auto-registration..."

**Examples:**
- ✅ "The order-processor application is **Category C** (auto-register)"
- ✅ Terraform comment: `# Category: C`
- ❌ WRONG: "The application uses auto-registration" (missing "Category C")

## Migration Rollout Order by Category

### Category B (JSON data, no SR) — Producers First

Today's consumers read raw JSON and pay no attention to headers, so producers can safely be upgraded first.

1. **Upgrade producers** → Confluent serializer + `HeaderSchemaIdSerializer`
2. **Upgrade consumers** → Confluent deserializer (auto-detects schema ID location)

### Category A→Header (Already on SR) — Producers Only

Consumers are already on Confluent deserializers, and on supported versions those check headers first automatically.

1. **Verify consumer versions** — Java 8.1.1+, Python 2.13.0+, etc.
2. **Upgrade producers** — add `HeaderSchemaIdSerializer`

### Category C (Auto-register) — Producers First

Mirrors Category B — turn off auto-register, register through Terraform, and have producers fetch the latest.

1. **Register schemas via Terraform**
2. **Set auto.register.schemas=false** in producer config
3. **Set use.latest.version=true** in producer config

### Category E (Custom serializers) — Consumers First

Replacing a custom serializer changes the payload format.

1. **Upgrade consumers** — Java: composite deserializer. Others: coordinated cutover
2. **Upgrade producers** — swap the custom serializer for Confluent + `HeaderSchemaIdSerializer`
3. **After old data expires** — drop the composite deserializer

## Minimum Client Versions

Required for header-based schema ID (`HeaderSchemaIdSerializer`):

- Java: CP client >= 8.1.1
- C/C++: libserdes >= 0.1.0
- Python: confluent-kafka >= 2.13.0
- .NET: Confluent.Kafka >= 2.13.0
- Go: confluent-kafka-go >= 2.13.0
- Node.js: @confluentinc/kafka-javascript >= 1.8.0

**Consumer auto-detection:** On supported versions, every Confluent deserializer looks in the Kafka headers first for the schema ID and falls back to the payload prefix.
