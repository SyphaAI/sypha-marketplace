# Build Templates

Project layout, build files, and test templates for generated Kafka Streams apps.

## Project Structure

```
<app-name>/
├── build.gradle
├── settings.gradle
├── gradle.properties
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew                                # Gradle wrapper (Unix)
├── gradlew.bat                           # Gradle wrapper (Windows)
├── src/
│   ├── main/
│   │   ├── avro/                        # Avro schemas (NOT resources/avro/)
│   │   │   ├── InputEvent.avsc
│   │   │   └── OutputEvent.avsc
│   │   ├── java/
│   │   │   └── com/example/<appname>/
│   │   │       ├── App.java              # Main class with config + shutdown hook
│   │   │       ├── TopologyBuilder.java   # Topology definition (testable)
│   │   │       ├── SampleDataProducer.java # Test data producer (if requested)
│   │   │       └── serdes/               # Custom serdes if needed
│   │   ├── resources/
│   │   │   ├── application.properties    # Streams config
│   │   │   └── simplelogger.properties   # Log level config (suppress noise)
│   └── test/
│       └── java/
│           └── com/example/<appname>/
│               └── TopologyTest.java     # TopologyTestDriver test
├── docker-compose.yml                    # Local dev environment
├── Dockerfile                           # Production container (if prod target)
├── create-topics.sh                     # Pre-create source, output, DLQ topics
├── teardown.sh                          # Clean up all topics and state
├── .env.example                         # Template for credentials
├── .env                                 # Actual credentials (gitignored)
├── .gitignore                           # Excludes build/, .gradle/, .env, state/
└── README.md                            # How to run, configure, monitor
```

**IMPORTANT:** The Gradle Avro plugin looks for schemas under `src/main/avro/`, NOT `src/main/resources/avro/`. Placing schemas in `resources/avro/` results in `NO-SOURCE` — the build completes but no Java classes are produced, causing compilation failures. See `references/schema-patterns.md` for correct schema examples.

For Protobuf: place files under `src/main/proto/`. For JSON Schema: no schema files are needed — define POJOs directly in `src/main/java/.../model/`.

Keep `TopologyBuilder` separate from `App` so the topology can be tested independently using `TopologyTestDriver`.

### Generating the Gradle Wrapper

**Always generate the Gradle wrapper** in new projects. It lets users run the project without a local Gradle installation — the wrapper scripts (`gradlew` and `gradlew.bat`) automatically download and invoke the pinned Gradle version.

Run the following after creating `build.gradle` and `settings.gradle`:

```bash
gradle wrapper --gradle-version 8.12
```

This produces:
- `gradle/wrapper/gradle-wrapper.jar` — the wrapper runtime
- `gradle/wrapper/gradle-wrapper.properties` — Gradle version config
- `gradlew` — Unix/Mac executable script
- `gradlew.bat` — Windows batch script

**If the user does not have Gradle installed**, the wrapper can be bootstrapped by creating `gradle-wrapper.properties` manually and downloading the wrapper JAR. For skill-generated projects, however, prefer running `gradle wrapper` directly.

Once the wrapper is in place, users invoke tasks with `./gradlew` instead of `gradle`:

```bash
./gradlew build
./gradlew run
./gradlew test
```

The wrapper guarantees consistent Gradle versions across development machines and CI/CD pipelines.

## Common Gradle Blocks

These blocks appear in every schema-specific build. They are omitted from the format-specific sections below to avoid repetition.

**Repositories:**
```groovy
repositories {
    mavenCentral()
    maven { url 'https://packages.confluent.io/maven/' }
}
```

**Common dependencies:**
```groovy
implementation 'org.apache.kafka:kafka-streams:4.2.0'
implementation 'org.slf4j:slf4j-simple:2.0.16'  // Dev; production: ch.qos.logback:logback-classic:1.5.16
testImplementation 'org.apache.kafka:kafka-streams-test-utils:4.2.0'
testImplementation 'org.junit.jupiter:junit-jupiter:5.11.4'
```

**Auto-load .env for `run` and `produce` tasks:**
```groovy
def loadEnv = {
    def envFile = file('.env')
    if (envFile.exists()) {
        envFile.readLines().each { line ->
            if (line && !line.startsWith('#') && line.contains('=')) {
                def (key, value) = line.split('=', 2)
                environment key.trim(), value.trim()
            }
        }
    }
    environment System.getenv()
}

run { doFirst(loadEnv) }

tasks.register('produce', JavaExec) {
    classpath = sourceSets.main.runtimeClasspath
    mainClass = 'com.example.<appname>.SampleDataProducer'
    doFirst(loadEnv)
}

test { useJUnitPlatform() }
```

## Gradle Avro Build (default)

```groovy
plugins {
    id 'java'
    id 'application'
    id 'com.github.davidmc24.gradle.plugin.avro' version '1.9.1'
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

// + Common repositories block

dependencies {
    implementation 'io.confluent:kafka-streams-avro-serde:8.2.0'
    implementation 'org.apache.avro:avro:1.12.0'
    // + Common dependencies
}

application {
    mainClass = 'com.example.<appname>.App'
}

// + Common .env loader, run/produce tasks
```

### Serde Dependency by Format

| Schema Format | Dependency |
|--------------|-----------|
| Avro | `io.confluent:kafka-streams-avro-serde:8.2.0` |
| Protobuf | `io.confluent:kafka-streams-protobuf-serde:8.2.0` |
| JSON Schema | `io.confluent:kafka-streams-json-schema-serde:8.2.0` |

Remove the Avro Gradle plugin (`com.github.davidmc24.gradle.plugin.avro`) when not using Avro.

## Gradle Protobuf Build

The `com.google.protobuf` plugin compiles `.proto` files from `src/main/proto/` into Java classes. Without it, `.proto` files are not compiled — the build appears to succeed but topology code fails with missing class errors.

```groovy
plugins {
    id 'java'
    id 'application'
    id 'com.google.protobuf' version '0.9.4'
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

// + Common repositories block

protobuf {
    protoc {
        artifact = 'com.google.protobuf:protoc:4.31.1'
    }
}

dependencies {
    implementation 'io.confluent:kafka-streams-protobuf-serde:8.2.0'
    implementation 'com.google.protobuf:protobuf-java:4.31.1'
    // + Common dependencies
}

application {
    mainClass = 'com.example.<appname>.App'
}

// + Common .env loader, run/produce tasks
```

## Gradle JSON Schema Build

JSON Schema requires no code generation. Define POJOs manually in `src/main/java/.../model/`. No schema plugin is necessary.

```groovy
plugins {
    id 'java'
    id 'application'
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

// + Common repositories block

dependencies {
    implementation 'io.confluent:kafka-streams-json-schema-serde:8.2.0'
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.17.0'
    // + Common dependencies
}

application {
    mainClass = 'com.example.<appname>.App'
}

// + Common .env loader, run/produce tasks
```

### Maven (pom.xml)

Maven is available as an alternative build tool but is not the default choice. When the user selects Maven, generate an equivalent `pom.xml` following the same patterns. The Maven Avro plugin is `org.apache.avro:avro-maven-plugin`, Protobuf uses `org.xolstice.maven.plugins:protobuf-maven-plugin`, and JSON Schema requires no plugin.

Maven is not fully templated here — adapt the Gradle examples to Maven conventions. Key differences:
- Use `maven-compiler-plugin` for Java 17
- Confluent repo: `<repository><url>https://packages.confluent.io/maven/</url></repository>`
- Exec plugin: `exec-maven-plugin` for running the app
- Test: `maven-surefire-plugin` with JUnit 5

### Containerization (shadow plugin)

For production Dockerfiles, include the shadow plugin to produce a fat jar:

```groovy
plugins {
    id 'com.github.johnrengelman.shadow' version '8.1.1'
}
```

Build with `./gradlew shadowJar`. The fat jar is located at `build/libs/<appname>-all.jar`.

Alternatively, the built-in Gradle `application` plugin's distribution task can be used: `./gradlew installDist` generates a runnable distribution under `build/install/<appname>/` including a startup script. This eliminates the shadow plugin dependency but outputs a directory rather than a single jar.

For Dockerfiles, `shadowJar` (single-file copy) is preferable to `installDist` (directory copy).

## simplelogger.properties

**Always generate this file** at `src/main/resources/simplelogger.properties`. Without it, each Kafka Streams startup emits hundreds of lines of AbstractConfig output, rendering logs unusable for demos and excessively noisy during development.

```properties
# Suppress noisy Kafka config dumps on startup
org.slf4j.simpleLogger.log.org.apache.kafka.common.config=WARN
org.slf4j.simpleLogger.log.org.apache.kafka.clients=WARN
org.slf4j.simpleLogger.log.io.confluent.kafka.serializers=WARN

# App logging
org.slf4j.simpleLogger.log.com.example=INFO

# Streams runtime — INFO shows state transitions, rebalancing, thread lifecycle
org.slf4j.simpleLogger.log.org.apache.kafka.streams=INFO

org.slf4j.simpleLogger.defaultLogLevel=WARN
org.slf4j.simpleLogger.showDateTime=true
org.slf4j.simpleLogger.dateTimeFormat=HH:mm:ss.SSS
org.slf4j.simpleLogger.showShortLogName=true
```

For production apps (Step 4), swap `slf4j-simple` for `logback-classic` and generate a `logback.xml` with a JSON encoder. See `references/production-hardening.md`.

## .env.example

Always generate a `.env.example` containing placeholder values. The user copies it to `.env` and substitutes their actual credentials.

```bash
# Kafka Cluster
BOOTSTRAP_SERVERS=<pkc-xxxxx.region.provider.confluent.cloud:9092>
CLUSTER_API_KEY=<your-cluster-api-key>
CLUSTER_API_SECRET=<your-cluster-api-secret>

# Schema Registry
SCHEMA_REGISTRY_URL=<https://psrc-xxxxx.region.provider.confluent.cloud>
SCHEMA_REGISTRY_API_KEY=<your-sr-api-key>
SCHEMA_REGISTRY_API_SECRET=<your-sr-api-secret>
```

For local dev with docker-compose, the `.env` values are pre-filled:
```bash
BOOTSTRAP_SERVERS=localhost:9092
SCHEMA_REGISTRY_URL=http://localhost:8081
```

## Testing

Always generate a `TopologyTest.java` backed by `TopologyTestDriver`. Use `mock://test-sr` as the Schema Registry URL — Confluent serdes automatically provision an in-memory mock registry when that URL scheme is detected.

**Common test structure:**
```java
import org.apache.kafka.streams.TopologyTestDriver;
import org.apache.kafka.streams.TestInputTopic;
import org.apache.kafka.streams.TestOutputTopic;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class TopologyTest {
    private TopologyTestDriver driver;
    private TestInputTopic<String, InputType> inputTopic;
    private TestOutputTopic<String, OutputType> outputTopic;

    @BeforeEach
    void setup() {
        Properties props = new Properties();
        props.put("application.id", "test-app");
        props.put("bootstrap.servers", "dummy:9092");
        props.put("schema.registry.url", "mock://test-sr");
        props.put("statestore.cache.max.bytes", "0");  // Deterministic tests
        // + format-specific serdes (see below)

        driver = new TopologyTestDriver(TopologyBuilder.build(props), props);
        // + format-specific topic creation (see below)
    }

    @AfterEach
    void teardown() { if (driver != null) driver.close(); }

    @Test
    void testTopology() {
        inputTopic.pipeInput("key", inputRecord);
        assertFalse(outputTopic.isEmpty());
        var result = outputTopic.readKeyValue();
        assertEquals("key", result.key);
    }
}
```

**Format-specific serde configuration:**

| Format | Default Serde | Serializer/Deserializer | Required Config |
|--------|--------------|------------------------|-----------------|
| Avro | `io.confluent...SpecificAvroSerde` | `SpecificAvroSerializer`/`Deserializer` | None |
| Protobuf | `io.confluent...KafkaProtobufSerde` | `KafkaProtobufSerializer`/`Deserializer` | `SPECIFIC_PROTOBUF_VALUE_TYPE=OutputProto.class.getName()` on deserializer |
| JSON Schema | `io.confluent...KafkaJsonSchemaSerde` | `KafkaJsonSchemaSerializer`/`Deserializer` | `JSON_VALUE_TYPE=OutputPojo.class.getName()` on deserializer |

All serdes configure with: `java.util.Map.of("schema.registry.url", "mock://test-sr")`

### Multiple Value Types in a Single Topology

When input and output schemas are of different types (for example, input is `Transaction` and output is `AccountSummary`), `default.value.serde` can only be configured for one type. Because internal topics (changelog and repartition) use the default serde, it must match the type used in state stores — typically the aggregation output type.

You MUST supply explicit serdes in `Consumed.with()`, `Produced.with()`, and `Materialized.with()` for every topic whose value type differs from the default. Relying on the default for the wrong type causes changelog deserialization to fail with difficult-to-interpret errors.

```java
// Example: input is Transaction (Avro), output is AccountSummary (Avro)
// Set default to AccountSummary (used by changelog stores)
// Use explicit serde for input consumption
KStream<String, Transaction> input = builder.stream(
    "transactions",
    Consumed.with(Serdes.String(), transactionSerde)  // explicit — not default
        .withName("source-transactions"));

KTable<String, AccountSummary> summary = input
    .groupByKey(Grouped.with(Serdes.String(), transactionSerde)
        .withName("group-by-account"))
    .aggregate(
        AccountSummary::new,
        (key, txn, agg) -> agg.add(txn),
        Named.as("aggregate"),
        Materialized.<String, AccountSummary, KeyValueStore<Bytes, byte[]>>
            as("account-summary-store")
            .withKeySerde(Serdes.String())
            .withValueSerde(accountSummarySerde));  // matches default — but explicit is safer
```

This approach is the quickest way to verify topology logic without a running Kafka cluster.

## Reference Repositories

For working examples and additional context, see:
- [Confluent Tutorials](https://github.com/confluentinc/tutorials) — Kafka Streams tutorials covering filtering, aggregation, joins, windowing, session windows, error handling, and serialization (Avro + Protobuf)
- [Confluent Examples](https://github.com/confluentinc/examples) — Broader examples including Confluent Cloud configurations
