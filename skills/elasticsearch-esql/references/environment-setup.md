# Environment Configuration

The Elasticsearch connection is established through environment variables. Run `node scripts/esql.js test` to confirm the connection is working. If the test fails, present the setup options below to the user and stop. Do not proceed with any further exploration until a successful connection test has been completed.

> **Elastic Cloud Serverless:** After connecting, examine the response from `GET /`. If `build_flavor` equals `”serverless”`, do **not** rely on `version.number` to determine which ES|QL features are permitted — Serverless follows the current GA and preview ES|QL releases, and the reported version tracks the main-line / next-minor line (semver-only clients may receive it as “latest”). Use `build_flavor` for detection and feature gating instead. For the complete rules covering self-managed and snapshot builds, see **Cluster Detection** in [SKILL.md](../SKILL.md) and the **Serverless** callout in [ES|QL Version History](esql-version-history.md).

## Option 1: Elastic Cloud (recommended for production)

```bash
export ELASTICSEARCH_CLOUD_ID="deployment-name:base64encodedcloudid"
export ELASTICSEARCH_API_KEY="base64encodedapikey"
```

## Option 2: Direct URL with API Key

```bash
export ELASTICSEARCH_URL="https://elasticsearch:9200"
export ELASTICSEARCH_API_KEY="base64encodedapikey"
```

## Option 3: Basic Authentication

```bash
export ELASTICSEARCH_URL="https://elasticsearch:9200"
export ELASTICSEARCH_USERNAME="elastic"
read -r -s -p "Elasticsearch password: " ELASTICSEARCH_PASSWORD
printf '\n'
export ELASTICSEARCH_PASSWORD
```

## Option 4: Local Development with start-local

For local development and testing, [start-local](https://github.com/elastic/start-local) can spin up Elasticsearch and Kibana containers using Docker or Podman. It downloads code and creates containers, volumes, credentials, and local files: get the user's explicit consent for the reviewed source/ref and those side-effects before downloading or running it. Never pipe a network response directly into a shell.

Pin a specific release or commit, review the script, and validate it against a checksum sourced from a trusted release page or an organizational security review:

```bash
START_LOCAL_REF="<PINNED_RELEASE_OR_COMMIT>"
EXPECTED_SHA256="<TRUSTED_SHA256>"
DOWNLOAD_DIR=$(mktemp -d)
SCRIPT="$DOWNLOAD_DIR/start-local.sh"

curl --fail --location --proto '=https' --tlsv1.2 \
  --output "$SCRIPT" \
  "https://raw.githubusercontent.com/elastic/start-local/${START_LOCAL_REF}/start-local.sh"
chmod 0600 "$SCRIPT"

# Review the complete file and its requested Docker/Podman resources.
less "$SCRIPT"
printf '%s  %s\n' "$EXPECTED_SHA256" "$SCRIPT" | sha256sum --check --strict

# Run only after checksum verification and a second explicit execution consent.
sh "$SCRIPT"
rm -f "$SCRIPT"
rmdir "$DOWNLOAD_DIR"
```

Do not run the script if a trusted expected checksum cannot be obtained or if verification fails. Instead, follow the manual, pinned installation steps from the official repository and have the downloaded files reviewed before use.

Once installation finishes, Elasticsearch is available at `http://localhost:9200` and Kibana at `http://localhost:5601`. The script creates a random password for the `elastic` user along with an API key; both are stored in the `.env` file within the `elastic-start-local` folder. Keep that file at mode `0600` and exclude it from version control.

To set up the environment variables for this skill, source the `.env` file and export the connection settings:

```bash
source elastic-start-local/.env
export ELASTICSEARCH_URL="$ES_LOCAL_URL"
export ELASTICSEARCH_API_KEY="$ES_LOCAL_API_KEY"
```

Then run `node scripts/esql.js test` to confirm the connection is working.

## Private CA certificates

Always keep TLS verification enabled. For a development cluster whose certificate is signed by a private CA, direct Node.js to the reviewed CA bundle:

```bash
export NODE_EXTRA_CA_CERTS="/path/to/private-ca-bundle.pem"
```
