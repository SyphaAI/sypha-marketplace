# Verification and Operations

Checklists covering Kafka Streams application verification, schema-aware tooling, and application reset procedures.

## Verification — agent runs this before handing off

Successful compilation and passing `TopologyTestDriver` tests do **not** constitute a working application. You must run against a real broker and confirm `State transition from REBALANCING to RUNNING` before handing off. Common failure modes that compile and pass tests cleanly but crash at startup include:

- `NoClassDefFoundError` on a Confluent class → missing runtime dep; check `build-templates.md`
- Silent log output / `Failed to load class org.slf4j.impl.StaticLoggerBinder` → SLF4J API/impl version skew
- `cannot find symbol` on a Streams API → check the import path against KS 4.x (`debugging.md` § Startup Failures)
- Auth failures → check `.env`, bootstrap URL, and SR creds

### Local (Apache Kafka / Confluent Platform via docker-compose)

You run the entire stack yourself.

1. `docker compose up -d` — start Kafka and Schema Registry. Wait for both services to be healthy (`docker compose ps`, or `curl localhost:8081/subjects`).
2. `./create-topics.sh` — pre-create the source, output, and DLQ topics.
3. Start the application **in the background** so logs remain readable while it runs: `./gradlew run > app.log 2>&1 &` (or `mvn exec:java`, or the harness's background mode).
4. Tail `app.log` and verify `State transition from REBALANCING to RUNNING` appears within ~30 seconds. If it does not, read the actual error and resolve it before continuing — do **not** hand off an application that has not started.
5. If sample data was requested: produce records (see [Schema-Aware Producers](#schema-aware-producers)) and verify they appear on the output topic (see [Consuming Output](#consuming-output)).
6. Review logs — confirm no deserialization exceptions and no rebalancing loops.
7. Stop the application and run `docker compose down` (or leave the environment running if the user wants to continue iterating — ask first).

Explicitly state in the handoff that you observed the `RUNNING` state (and that records were processed, if step 5 was executed).

### Confluent Cloud

A full end-to-end run is usually not possible because the cluster and Schema Registry API keys belong to the user. **Do not fabricate a successful run.** Select the branch that matches the actual situation:

**A. Real CC creds are available** (user pasted them, pointed you at a real `.env`, or you have creds for a sandbox cluster):

1. Verify `confluent` CLI auth if you'll use it: `confluent login`, then `confluent environment use <env-id>` and `confluent kafka cluster use <cluster-id>`
2. `./create-topics.sh --cloud` — pre-create topics
3. `./gradlew run` (auto-loads `.env`). Watch the log for `State transition from REBALANCING to RUNNING`. Fix any startup error before proceeding.
4. Produce test data: `./gradlew produce` if a sample producer was generated, otherwise see [Schema-Aware Producers](#schema-aware-producers).
5. Verify output — **must include SR credentials for schematized topics**:
   ```bash
   confluent kafka topic consume <output-topic> --from-beginning --print-key \
     --value-format avro \
     --schema-registry-endpoint $SCHEMA_REGISTRY_URL \
     --schema-registry-api-key $SCHEMA_REGISTRY_API_KEY \
     --schema-registry-api-secret $SCHEMA_REGISTRY_API_SECRET
   ```
   Replace `avro` with `protobuf` or `jsonschema` as appropriate.

**B. Credentials are placeholders or absent:**

1. Run `./gradlew build` (compile and unit tests). Report the outcome.
2. Provide the user with the exact commands to run themselves — steps 2–5 above — and describe what a successful result looks like (`State transition from REBALANCING to RUNNING` in the log; records present on the output topic).
3. State plainly: "I couldn't run this against your CC cluster because I don't have your API keys — please run these steps and paste any errors back." Do not imply a runtime verification that did not occur.

See `references/cli-commands.md` for the full CLI reference.

## Schema-Aware Producers

**Never use the plain `kafka-console-producer` for schematized topics** — it writes raw strings that lack the Schema Registry magic byte, which causes `Unknown magic byte!` deserialization errors.

### Local / Confluent Platform

```bash
# Avro
kafka-avro-console-producer --bootstrap-server localhost:9092 \
  --topic input-topic --property schema.registry.url=http://localhost:8081 \
  --property value.schema='<avro-schema>'

# Protobuf
kafka-protobuf-console-producer --bootstrap-server localhost:9092 \
  --topic input-topic --property schema.registry.url=http://localhost:8081 \
  --property value.schema='<protobuf-schema>'

# JSON Schema
kafka-json-schema-console-producer --bootstrap-server localhost:9092 \
  --topic input-topic --property schema.registry.url=http://localhost:8081 \
  --property value.schema='<json-schema>'
```

### Confluent Cloud

```bash
confluent kafka topic produce <topic> --value-format avro \
  --schema '<avro-schema-json>'
# Or with a schema file:
confluent kafka topic produce <topic> --value-format avro \
  --schema @path/to/schema.avsc
```

### Generated SampleDataProducer (recommended)

When the user needs sample data, generate a `SampleDataProducer.java` class along with a dedicated Gradle `produce` task. This approach is more reliable than CLI producers when schemas are complex. Execute it with `./gradlew produce`.

## Consuming Output

### Local / Confluent Platform

```bash
# Avro
# Keys are Serdes.String() in our topologies — override the default key
# deserializer so the consumer doesn't try to Avro-decode a raw UTF-8 key
# (which has no 0x00 magic byte + 4-byte schema ID).
kafka-avro-console-consumer --bootstrap-server broker:29092 \
  --topic output-topic --from-beginning \
  --property schema.registry.url=http://localhost:8081 \
  --property print.key=true \
  --key-deserializer org.apache.kafka.common.serialization.StringDeserializer
```

### Confluent Cloud

```bash
# IMPORTANT: Include SR credentials — without them, Avro/Protobuf/JSON Schema
# data is displayed as raw bytes (unreadable)
confluent kafka topic consume output-topic --from-beginning --print-key \
  --value-format avro \
  --schema-registry-endpoint <SR_URL> \
  --schema-registry-api-key <SR_KEY> \
  --schema-registry-api-secret <SR_SECRET>
```

## Resetting Application State

During development, schema changes or malformed data can corrupt internal state. Follow this procedure to perform a complete reset.

### Prerequisites

The `kafka-streams-application-reset` tool is bundled with Apache Kafka.

If it is not available:
- **Apache Kafka:** Download from https://kafka.apache.org/downloads — the tool is at `bin/kafka-streams-application-reset.sh`
- **Confluent Platform:** The tool is at `$CONFLUENT_HOME/bin/kafka-streams-application-reset`
- **Confluent Cloud users:** The Apache Kafka download is still required to obtain this tool. It connects to your CC cluster via a `client.properties` file.

### Reset Steps

1. **Stop all instances of the application**

2. **Reset consumer offsets and internal topics:**

   **Local (no auth):**
   ```bash
   kafka-streams-application-reset \
     --application-id <app-id> \
     --bootstrap-server localhost:9092 \
     --input-topics <topic1>,<topic2>
   ```

   **Confluent Cloud or secured clusters:**
   ```bash
   kafka-streams-application-reset \
     --application-id <app-id> \
     --bootstrap-server <bootstrap-servers> \
     --input-topics <topic1>,<topic2> \
     --command-config client.properties
   ```

   Create `client.properties` for CC:
   ```properties
   security.protocol=SASL_SSL
   sasl.mechanism=PLAIN
   sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required \
     username='<CLUSTER_API_KEY>' password='<CLUSTER_API_SECRET>';
   ```

3. **Delete stale schemas** on changelog/repartition subjects if you changed your POJOs:
   ```bash
   # List subjects
   curl -u <SR_KEY>:<SR_SECRET> <SR_URL>/subjects | grep <app-id>
   # Soft + hard delete each stale subject
   curl -X DELETE -u <SR_KEY>:<SR_SECRET> <SR_URL>/subjects/<subject>?permanent=false
   curl -X DELETE -u <SR_KEY>:<SR_SECRET> <SR_URL>/subjects/<subject>?permanent=true
   ```

4. **Clean up local state stores:**
   ```bash
   # Default location:
   rm -rf /tmp/kafka-streams/<application-id>
   # Or whatever state.dir is configured to in application.properties
   ```
   - **Multi-node deployments (K8s, ECS, etc.):** Local state must be cleared on every node. For Kubernetes StatefulSets, wipe the PVC on each pod or redeploy using a new `application.id`.

5. **Restart the application** — it will re-process from the beginning

### When to Reset

- Schema changes to POJOs used in state stores (these cause deserialization errors during changelog replay)
- State corruption from bad test data
- Switching between `json.value.type` configurations
- After deleting and recreating topics (stale schema ID references persist)

### Alternative: Fresh application.id

As an alternative to a full reset, increment the `application.id` (e.g., `my-app-v2` to `my-app-v3`). This produces new consumer groups and internal topics from scratch, sidestepping any existing state corruption. The old internal topics become orphaned and should be removed at a later point.

### Full Teardown

For demos or development environments, use the generated `teardown.sh` script to remove all topics, internal topics, and local state with a single command. See `scripts/teardown.sh` for the template.

Include this reset procedure in the generated README for every stateful application.
