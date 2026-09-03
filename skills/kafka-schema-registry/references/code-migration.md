# Code Migration Reference

This reference contains serializer and deserializer implementation patterns for moving existing Kafka applications onto Confluent Schema Registry with Avro, Protobuf, or JSON Schema serialization.

## When to Use

Once the schema analysis report has been generated, consult this reference when users want to:
- Modify their producer/consumer code so it uses Schema Registry
- Move from string/JSON/custom serializers over to Schema Registry-managed formats
- Set up proper serialization/deserialization using Avro, Protobuf, or JSON Schema
- Pick the schema format that fits their use case

## Choosing a Schema Format

If the user hasn't stated which schema format they want, ask whether they would prefer Avro, Protobuf, or JSON Schema. The guidance below can support that decision:

| Format | Best For | Pros | Cons |
|--------|----------|------|------|
| **Avro** | Analytics, high-throughput data pipelines | Compact binary encoding, rich schema evolution, fast serialization | Needs code generation, not very human-readable |
| **Protobuf** | Microservices, gRPC integration, cross-language use | Compact, broadly adopted, strong typing, backward/forward compatible | Needs code generation, steeper learning curve |
| **JSON Schema** | Web APIs, gradual migration from JSON, human readability | Readable by humans, no code generation, familiar to web devs | Bigger payload size, slower serialization |

**Recommendation:** Pick Avro for data-intensive pipelines, Protobuf for service-to-service communication, and JSON Schema for gradual migrations away from plain JSON.

## Migration Workflow

1. Go through the schema report to find the applications that need migration
2. Determine each application's language and role (producer/consumer)
3. Select the appropriate schema format (Avro, Protobuf, or JSON Schema)
4. Add Schema Registry client libraries to the dependencies
5. Swap the existing serializers/deserializers for Schema Registry-aware versions
6. Add Schema Registry connection details to the configuration
7. Test against the schemas generated in the `schemas/` directory

---

## Python

### Dependencies

```python
# requirements.txt or pyproject.toml

# For Avro:
confluent-kafka[avro]

# For Protobuf:
confluent-kafka[protobuf]

# For JSON Schema:
confluent-kafka[json]


### Avro

#### Producer Pattern

```python
from confluent_kafka.schema_registry.avro import AvroSerializer

avro_serializer = AvroSerializer(schema_registry_client, schema_string, value_to_dict)

producer.produce(
    topic=topic,
    value=avro_serializer(value_obj, SerializationContext(topic, MessageField.VALUE))
)
```

#### Consumer Pattern

```python
from confluent_kafka.schema_registry.avro import AvroDeserializer

avro_deserializer = AvroDeserializer(schema_registry_client, schema_str, dict_to_value)

msg = consumer.poll(1.0)
value_obj = avro_deserializer(msg.value(), SerializationContext(msg.topic(), MessageField.VALUE))
```

### Protobuf

#### Producer Pattern

```python
from confluent_kafka.schema_registry.protobuf import ProtobufSerializer

# Create serializer
protobuf_serializer = ProtobufSerializer(
    YourMessage,  # Protobuf message class
    schema_registry_client,
    {'use.latest.version': True}
)

producer.produce(
    topic=topic,
    value=protobuf_serializer(value_obj, SerializationContext(topic, MessageField.VALUE))
)
```

#### Consumer Pattern

```python
from confluent_kafka.schema_registry.protobuf import ProtobufDeserializer

protobuf_deserializer = ProtobufDeserializer(
    YourMessage,
    {'use.deprecated.format': False}
)

msg = consumer.poll(1.0)
value_obj = protobuf_deserializer(msg.value(), SerializationContext(msg.topic(), MessageField.VALUE))
```

### JSON Schema

#### Producer Pattern

```python
from confluent_kafka.schema_registry.json_schema import JSONSerializer

json_serializer = JSONSerializer(schema_str, schema_registry_client, value_to_dict)

producer.produce(
    topic=topic,
    value=json_serializer(value_obj, SerializationContext(topic, MessageField.VALUE))
)
```

#### Consumer Pattern

```python
from confluent_kafka.schema_registry.json_schema import JSONDeserializer

json_deserializer = JSONDeserializer(schema_str, dict_to_value)

msg = consumer.poll(1.0)
value_obj = json_deserializer(msg.value(), SerializationContext(msg.topic(), MessageField.VALUE))
```

---

## Java

### Dependencies

```xml
<!-- Maven pom.xml -->

<!-- For Avro: -->
<dependency>
    <groupId>io.confluent</groupId>
    <artifactId>kafka-avro-serializer</artifactId>
</dependency>

<!-- For Protobuf: -->
<dependency>
    <groupId>io.confluent</groupId>
    <artifactId>kafka-protobuf-serializer</artifactId>
</dependency>

<!-- For JSON Schema: -->
<dependency>
    <groupId>io.confluent</groupId>
    <artifactId>kafka-json-schema-serializer</artifactId>
</dependency>
```

```gradle
// Gradle build.gradle

// For Avro:
implementation 'io.confluent:kafka-avro-serializer'

// For Protobuf:
implementation 'io.confluent:kafka-protobuf-serializer'

// For JSON Schema:
implementation 'io.confluent:kafka-json-schema-serializer'
```

### Avro

#### Producer Pattern

```java
import io.confluent.kafka.serializers.KafkaAvroSerializer;

// Set serializer in producer properties
props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaAvroSerializer.class.getName());

KafkaProducer<String, YourAvroModel> producer = new KafkaProducer<>(props);

// YourAvroModel is a generated Avro class
YourAvroModel value = new YourAvroModel(...);
producer.send(new ProducerRecord<>(topic, key, value));
```

#### Consumer Pattern

```java
import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroDeserializerConfig;

// Set deserializer in consumer properties
props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaAvroDeserializer.class.getName());

Consumer<String, YourAvroModel> consumer = new KafkaConsumer<>(props);

while (true) {
    ConsumerRecords<String, YourAvroModel> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, YourAvroModel> record : records) {
        YourAvroModel value = record.value();
        // Process value
    }
}
```

### Protobuf

#### Producer Pattern

```java
import io.confluent.kafka.serializers.protobuf.KafkaProtobufSerializer;

// Set serializer in producer properties
props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaProtobufSerializer.class.getName());

KafkaProducer<String, YourProtoModel> producer = new KafkaProducer<>(props);

// YourProtoModel is a generated Protobuf class
YourProtoModel value = YourProtoModel.newBuilder()
    .setField1("value1")
    .setField2(123)
    .build();

producer.send(new ProducerRecord<>(topic, key, value));
```

#### Consumer Pattern

```java
import io.confluent.kafka.serializers.protobuf.KafkaProtobufDeserializer;
import io.confluent.kafka.serializers.protobuf.KafkaProtobufDeserializerConfig;

// Set deserializer in consumer properties
props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaProtobufDeserializer.class.getName());
props.put(KafkaProtobufDeserializerConfig.SPECIFIC_PROTOBUF_VALUE_TYPE, YourProtoModel.class.getName());

Consumer<String, YourProtoModel> consumer = new KafkaConsumer<>(props);

while (true) {
    ConsumerRecords<String, YourProtoModel> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, YourProtoModel> record : records) {
        YourProtoModel value = record.value();
        // Process value
    }
}
```

### JSON Schema

#### Producer Pattern

```java
import io.confluent.kafka.serializers.json.KafkaJsonSchemaSerializer;

// Set serializer in producer properties
props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaJsonSchemaSerializer.class.getName());

KafkaProducer<String, YourPOJO> producer = new KafkaProducer<>(props);

// YourPOJO is a Java class with Jackson annotations
YourPOJO value = new YourPOJO("value1", 123);
producer.send(new ProducerRecord<>(topic, key, value));
```

#### Consumer Pattern

```java
import io.confluent.kafka.serializers.json.KafkaJsonSchemaDeserializer;
import io.confluent.kafka.serializers.json.KafkaJsonSchemaDeserializerConfig;

// Set deserializer in consumer properties
props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, KafkaJsonSchemaDeserializer.class.getName());
props.put(KafkaJsonSchemaDeserializerConfig.JSON_VALUE_TYPE, YourPOJO.class.getName());

Consumer<String, YourPOJO> consumer = new KafkaConsumer<>(props);

while (true) {
    ConsumerRecords<String, YourPOJO> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, YourPOJO> record : records) {
        YourPOJO value = record.value();
        // Process value
    }
}
```

---

## JavaScript/Node.js

### Dependencies

```json
{
  "dependencies": {
    "@confluentinc/kafka-javascript": "1.9.1",
    "@confluentinc/schemaregistry": "1.9.1",
    "protobufjs": "8.6.5"
  }
}
```

**Note:** Avro, Protobuf, and JSON Schema serialization are all supported by the `@confluentinc/schemaregistry` package.

### Avro

#### Producer Pattern

```javascript
const {
  SchemaRegistryClient,
  SerdeType,
  AvroSerializer
} = require("@confluentinc/schemaregistry");

// Create serializer
const serializer = new AvroSerializer(srClient, SerdeType.VALUE, {
  useLatestVersion: true
});

// Serialize value
const message = {
  value: await serializer.serialize("your-topic", { field1: "value1", field2: 123 })
};
```

#### Consumer Pattern

```javascript
const {
  SerdeType,
  AvroDeserializer
} = require("@confluentinc/schemaregistry");

const deserializer = new AvroDeserializer(srClient, SerdeType.VALUE, {});

consumer.run({
  eachMessage: async ({ topic, message }) => {
    const decodedValue = await deserializer.deserialize(topic, message.value);
    // Process decodedValue
  }
});
```

### Protobuf

#### Producer Pattern

```javascript
const {
  SerdeType,
  ProtobufSerializer
} = require("@confluentinc/schemaregistry");

// Create serializer
const serializer = new ProtobufSerializer(srClient, SerdeType.VALUE, {
  useLatestVersion: true
});

// Serialize value
const message = {
  value: await serializer.serialize("your-topic", { field1: "value1", field2: 123 })
};

await producer.send({ topic: "your-topic", messages: [message] });
```

#### Consumer Pattern

```javascript
const {
  SerdeType,
  ProtobufDeserializer
} = require("@confluentinc/schemaregistry");

const deserializer = new ProtobufDeserializer(srClient, SerdeType.VALUE, {});

consumer.run({
  eachMessage: async ({ topic, message }) => {
    const decodedValue = await deserializer.deserialize(topic, message.value);
    // Process decodedValue
  }
});
```

### JSON Schema

#### Producer Pattern

```javascript
const {
  SerdeType,
  JsonSerializer
} = require("@confluentinc/schemaregistry");

// Create serializer
const serializer = new JsonSerializer(srClient, SerdeType.VALUE, {
  useLatestVersion: true
});

// Serialize value
const message = {
  value: await serializer.serialize("your-topic", { field1: "value1", field2: 123 })
};

await producer.send({ topic: "your-topic", messages: [message] });
```

#### Consumer Pattern

```javascript
const {
  SerdeType,
  JsonDeserializer
} = require("@confluentinc/schemaregistry");

const deserializer = new JsonDeserializer(srClient, SerdeType.VALUE, {});

consumer.run({
  eachMessage: async ({ topic, message }) => {
    const decodedValue = await deserializer.deserialize(topic, message.value);
    // Process decodedValue
  }
});
```

---

## Go

### Dependencies

```go
require (
    github.com/confluentinc/confluent-kafka-go/v2
)
```

**Note:** The confluent-kafka-go package provides Avro, Protobuf, and JSON Schema support via separate serde packages.

### Avro

#### Producer Pattern

```go
import (
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde/avrov2"
)

// Create Avro serializer
ser, _ := avrov2.NewSerializer(client, serde.ValueSerde, avrov2.NewSerializerConfig())

// Serialize value
value := YourStruct{Field1: "value1", Field2: 123}
payload, _ := ser.Serialize(topic, &value)

// Produce
producer.Produce(&kafka.Message{
    TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
    Value:          payload,
}, deliveryChan)
```

#### Consumer Pattern

```go
import (
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde/avrov2"
)

// Create Avro deserializer
deser, _ := avrov2.NewDeserializer(client, serde.ValueSerde, avrov2.NewDeserializerConfig())

// Deserialize
switch e := event.(type) {
case *kafka.Message:
    value := YourStruct{}
    deser.DeserializeInto(*e.TopicPartition.Topic, e.Value, &value)
    // Process value
}
```

### Protobuf

#### Producer Pattern

```go
import (
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde/protobuf"
)

// Create Protobuf serializer
ser, _ := protobuf.NewSerializer(client, serde.ValueSerde, protobuf.NewSerializerConfig())

// Serialize value (YourProtoMessage is generated from .proto file)
value := &YourProtoMessage{Field1: "value1", Field2: 123}
payload, _ := ser.Serialize(topic, value)

// Produce
producer.Produce(&kafka.Message{
    TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
    Value:          payload,
}, deliveryChan)
```

#### Consumer Pattern

```go
import (
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde/protobuf"
)

// Create Protobuf deserializer
deser, _ := protobuf.NewDeserializer(client, serde.ValueSerde, protobuf.NewDeserializerConfig())

// Deserialize
switch e := event.(type) {
case *kafka.Message:
    value := YourProtoMessage{}
    deser.DeserializeInto(*e.TopicPartition.Topic, e.Value, &value)
    // Process value
}
```

### JSON Schema

#### Producer Pattern

```go
import (
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde/jsonschema"
)

// Create JSON Schema serializer
ser, _ := jsonschema.NewSerializer(client, serde.ValueSerde, jsonschema.NewSerializerConfig())

// Serialize value
value := YourStruct{Field1: "value1", Field2: 123}
payload, _ := ser.Serialize(topic, &value)

// Produce
producer.Produce(&kafka.Message{
    TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
    Value:          payload,
}, deliveryChan)
```

#### Consumer Pattern

```go
import (
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde"
    "github.com/confluentinc/confluent-kafka-go/v2/schemaregistry/serde/jsonschema"
)

// Create JSON Schema deserializer
deser, _ := jsonschema.NewDeserializer(client, serde.ValueSerde, jsonschema.NewDeserializerConfig())

// Deserialize
switch e := event.(type) {
case *kafka.Message:
    value := YourStruct{}
    deser.DeserializeInto(*e.TopicPartition.Topic, e.Value, &value)
    // Process value
}
```
---

## .NET / C#

### Dependencies

```xml
<!-- .csproj -->

<!-- For Avro: -->
<PackageReference Include="Confluent.SchemaRegistry.Serdes.Avro" />

<!-- For Protobuf: -->
<PackageReference Include="Confluent.SchemaRegistry.Serdes.Protobuf" />

<!-- For JSON Schema: -->
<PackageReference Include="Confluent.SchemaRegistry.Serdes.Json" />
```

### Avro

#### Producer Pattern

```csharp
using Confluent.Kafka;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;

using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var producer = new ProducerBuilder<string, YourAvroModel>(producerConfig)
    .SetValueSerializer(new AvroSerializer<YourAvroModel>(schemaRegistry))
    .Build();

var value = new YourAvroModel { Field1 = "value1", Field2 = 123 };
await producer.ProduceAsync(topic, new Message<string, YourAvroModel> { Key = key, Value = value });
```

#### Consumer Pattern

```csharp
using Confluent.Kafka;
using Confluent.Kafka.SyncOverAsync;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;

using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var consumer = new ConsumerBuilder<string, YourAvroModel>(consumerConfig)
    .SetValueDeserializer(new AvroDeserializer<YourAvroModel>(schemaRegistry).AsSyncOverAsync())
    .Build();

consumer.Subscribe("your-topic");

while (true)
{
    var consumeResult = consumer.Consume();
    var value = consumeResult.Message.Value;
    // Process value
}
```

### Protobuf

#### Producer Pattern

```csharp
using Confluent.Kafka;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;

using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var producer = new ProducerBuilder<string, YourProtoMessage>(producerConfig)
    .SetValueSerializer(new ProtobufSerializer<YourProtoMessage>(schemaRegistry))
    .Build();

var value = new YourProtoMessage { Field1 = "value1", Field2 = 123 };
await producer.ProduceAsync(topic, new Message<string, YourProtoMessage> { Key = key, Value = value });
```

#### Consumer Pattern

```csharp
using Confluent.Kafka;
using Confluent.Kafka.SyncOverAsync;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;

using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var consumer = new ConsumerBuilder<string, YourProtoMessage>(consumerConfig)
    .SetValueDeserializer(new ProtobufDeserializer<YourProtoMessage>().AsSyncOverAsync())
    .Build();

consumer.Subscribe("your-topic");

while (true)
{
    var consumeResult = consumer.Consume();
    var value = consumeResult.Message.Value;
    // Process value
}
```

### JSON Schema

#### Producer Pattern

```csharp
using Confluent.Kafka;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;

using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var producer = new ProducerBuilder<string, YourPOJO>(producerConfig)
    .SetValueSerializer(new JsonSerializer<YourPOJO>(schemaRegistry))
    .Build();

var value = new YourPOJO { Field1 = "value1", Field2 = 123 };
await producer.ProduceAsync(topic, new Message<string, YourPOJO> { Key = key, Value = value });
```

#### Consumer Pattern

```csharp
using Confluent.Kafka;
using Confluent.Kafka.SyncOverAsync;
using Confluent.SchemaRegistry;
using Confluent.SchemaRegistry.Serdes;

using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var consumer = new ConsumerBuilder<string, YourPOJO>(consumerConfig)
    .SetValueDeserializer(new JsonDeserializer<YourPOJO>().AsSyncOverAsync())
    .Build();

consumer.Subscribe("your-topic");

while (true)
{
    var consumeResult = consumer.Consume();
    var value = consumeResult.Message.Value;
    // Process value
}
```

---

## Migration Testing Checklist

Before the migrated code goes to deployment:

- [ ] Confirm the schema files in the `schemas/` directory match the data models
- [ ] Register schemas in Schema Registry by applying Terraform
- [ ] Test that the producer serializes sample data
- [ ] Test that the consumer deserializes existing topic data
- [ ] Check that PII fields are tagged correctly (if applicable)
- [ ] Add schema validation to CI/CD pipelines
- [ ] Write down the rollout order (consumers first for Category E, producers first for Category B)
- [ ] Prepare a rollback strategy (initially keep the old serializers available)
- [ ] Watch for schema compatibility errors in Schema Registry
- [ ] Adjust monitoring/alerting to cover serialization failures

---

## Common Migration Issues

### Issue: Schema Mismatch
**Symptom:** Errors during serialization/deserialization
**Solution:** Make sure the data model exactly matches the generated schema. Verify field names, types, and nullability.

### Issue: Authentication Errors
**Symptom:** 401/403 errors when connecting to Schema Registry
**Solution:** Check the SR API key/secret and confirm the credentials carry the proper ACLs.

### Issue: Compatibility Errors
**Symptom:** "Schema being registered is incompatible"
**Solution:** Inspect the Schema Registry compatibility mode. Use BACKWARD for a consumers-first migration, FORWARD for producers-first.

### Issue: Performance Degradation
**Symptom:** Higher latency after migration
**Solution:** Turn on schema caching. Most clients cache automatically, but confirm the configuration.

### Issue: Missing Schema ID in Messages
**Symptom:** The deserializer cannot find the schema
**Solution:** Confirm the producer is really using AvroSerializer rather than falling back to a custom serializer.

---
