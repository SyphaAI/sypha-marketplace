# snowflake

## Installing the Driver

To install the Snowflake ADBC driver using dbc, run:

```sh
dbc install snowflake
```

## Before Connecting: Determine the Auth Method and Parameters

Snowflake offers multiple authentication methods, and each one requires different parameters. Before any code gets written:

1. **Check for a connection profile.** If the user has one (see `resources/connection-profiles.md`), prefer `profile://<name>` and skip everything else.
2. **Check the environment** for the common Snowflake variables (listed below), including any `.env` file that exists. If enough of them are set to unambiguously satisfy one auth method, read them at runtime (e.g., `os.environ`) — never hardcode the values.
3. **Ask the user** for whatever required parameters are missing, and ask which auth method they want if it is still unclear. Never fabricate or substitute placeholder values for accounts, usernames, passwords, keys, or tokens.

### Common Environment Variables (Snowflake convention; not read automatically by the driver)

- `SNOWFLAKE_ACCOUNT` — account identifier
- `SNOWFLAKE_URL` — full account URL (alternative to `SNOWFLAKE_ACCOUNT`)
- `SNOWFLAKE_USER` — username
- `SNOWFLAKE_PASSWORD` — password
- `SNOWFLAKE_AUTHENTICATOR` — auth method override
- `SNOWFLAKE_PRIVATE_KEY_PATH` — PEM-encoded RSA private key path (JWT auth)
- `SNOWFLAKE_PAT` or `SNOWFLAKE_AUTH_TOKEN` — programmatic access token (PAT auth)
- `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`, `SNOWFLAKE_ROLE`

## Connection Styles

Choose **one** style and stick with it. Combining them (a `uri` alongside extra `adbc.snowflake.sql.*` options) works in principle but is discouraged — the connection config ends up split between two places, and it becomes easy to specify the auth info ambiguously (e.g., `authenticator` in the URI *and* `adbc.snowflake.sql.auth_type` as an option).

### URI style

Set the `uri` option:

```text
snowflake://[user[:password]@]<host>/[database][?param1=value1&...]
```

For `<host>`, either the bare account identifier (e.g., `myorg-account123`) or the full hostname (e.g., `myorg-account123.snowflakecomputing.com`) works. The bare form is the recommended one.

URI query parameters: `warehouse`, `role`, `authenticator`, `token` (for PAT), plus the `adbc.snowflake.sql.*` options below as `&key=value` pairs. The auth method is given via `?authenticator=<value>` (see table below).

### Options style

Leave out `uri` and provide these keys directly:

| Key | Purpose |
| --- | --- |
| `adbc.snowflake.sql.account` | Account identifier |
| `username` | Username |
| `password` | Password (secret) |
| `adbc.snowflake.sql.auth_type` | Auth method (see table below) |
| `adbc.snowflake.sql.client_option.jwt_private_key` | Path to a PEM-encoded RSA private key file (JWT auth) |
| `adbc.snowflake.sql.client_option.jwt_private_key_pkcs8_value` | PEM private key contents given inline (secret; JWT auth) |
| `adbc.snowflake.sql.client_option.jwt_private_key_pkcs8_password` | Passphrase for an encrypted PKCS8 private key (secret; JWT auth) |
| `adbc.snowflake.sql.client_option.auth_token` | Token value (PAT, OAuth, and other token-based auth methods) |
| `adbc.snowflake.sql.client_option.okta_url` | Okta endpoint URL (Okta auth) |
| `adbc.snowflake.sql.client_option.identity_provider` | Identity provider for Workload Identity Federation (`auth_wif`) |
| `adbc.snowflake.sql.client_option.ocsp_fail_open_mode` | Behavior of OCSP fail-open (certificate revocation checks) |
| `adbc.snowflake.sql.db` | Default database |
| `adbc.snowflake.sql.schema` | Default schema |
| `adbc.snowflake.sql.warehouse` | Default warehouse |
| `adbc.snowflake.sql.role` | Default role |
| `adbc.snowflake.sql.client_option.tls_skip_verify` | `"true"` disables TLS verification (not for production) |

The keys below are rarely required — set them only when the default host construction must be overridden (for instance, to hit a non-standard region endpoint or a private/proxy URL):

| Key | Purpose |
| --- | --- |
| `adbc.snowflake.sql.region` | Region override |
| `adbc.snowflake.sql.uri.protocol` | `http` or `https` override |
| `adbc.snowflake.sql.uri.port` | Port override |
| `adbc.snowflake.sql.uri.host` | Host override |

### Auth method value mapping

The same auth methods go by different value names in the two styles:

| Auth method | Options: `adbc.snowflake.sql.auth_type` | URI: `authenticator` |
| --- | --- | --- |
| Username / password (default) | `auth_snowflake` | `snowflake` |
| JWT key pair | `auth_jwt` | `snowflake_jwt` |
| Programmatic access token (PAT) | `auth_pat` | `programmatic_access_token` |
| OAuth | `auth_oauth` | `oauth` |
| External browser (SSO) | `auth_ext_browser` | `externalbrowser` |
| Okta | `auth_okta` | `okta_endpoint` |
| Username / password + MFA | `auth_mfa` | `username_password_mfa` |
| Workload Identity Federation | `auth_wif` | *(consult upstream docs)* |

The auth info has to line up with the style in use: with `uri` set, `authenticator` belongs in the URI query string; with options, set `adbc.snowflake.sql.auth_type`.

## Auth Methods and Their Required Parameters

### 1. Username / Password (default)

- `adbc.snowflake.sql.account`
- `username`
- `password`

Since `auth_snowflake` is the default, the auth marker can be omitted. URI equivalent: `snowflake://<user>:<password>@<account>/[database]`.

Under `auth_snowflake`, a programmatic access token (PAT) may also be passed as the `password` — the driver accepts it where a regular password would go. This is an alternative to the `auth_pat` method described below.

### 2. JWT Key Pair (RSA private key)

- `adbc.snowflake.sql.account`
- `username`
- Auth marker: `auth_type=auth_jwt` (options) or `authenticator=snowflake_jwt` (URI)
- Exactly one source for the private key:
  - `adbc.snowflake.sql.client_option.jwt_private_key` — path to a PEM-encoded RSA private key file, **or**
  - `adbc.snowflake.sql.client_option.jwt_private_key_pkcs8_value` — the PEM contents inline (secret)
- `adbc.snowflake.sql.client_option.jwt_private_key_pkcs8_password` — passphrase used to decrypt the private key when it is encrypted (secret; needed only for encrypted keys)

### 3. Programmatic Access Token (PAT)

- `adbc.snowflake.sql.account`
- `username`
- Auth marker: `auth_type=auth_pat` (options) or `authenticator=programmatic_access_token` (URI)
- Token delivery:
  - Options style: `adbc.snowflake.sql.client_option.auth_token` = `<PAT>`
  - URI style: `&token=<url-encoded PAT>` in the query string

### 4. Other Authenticators

`auth_oauth`, `auth_ext_browser` (SSO via browser), `auth_okta`, `auth_mfa`, and `auth_wif` (Workload Identity Federation) each come with their own required parameters — refer to https://docs.adbc-drivers.org/drivers/snowflake/index.html and get the specific values (e.g., OAuth token, Okta URL) from the user instead of guessing option keys.

## Selecting a Database

When no database was given via the URI or `adbc.snowflake.sql.db`, enumerate the available databases with `AdbcConnectionGetObjects` at `depth="catalogs"`, then run `USE DATABASE <NAME>`. The schema, warehouse, and role can likewise be changed with `USE SCHEMA`, `USE WAREHOUSE`, and `USE ROLE`.

## Ingesting Data

The `catalog_name` / `db_schema_name` kwargs on `adbc_ingest` are not supported by the Snowflake driver (it raises `NOT_IMPLEMENTED: Unknown statement option 'adbc.ingest.target_catalog'`). Instead, configure the target database and schema on the connection — either through `adbc.snowflake.sql.db` / `adbc.snowflake.sql.schema` (or the URI path), or by issuing `USE DATABASE` / `USE SCHEMA` before ingesting — and give `adbc_ingest` only the unqualified table name.

`adbc_ingest` keeps Arrow field names exactly as-is — its behavior matches the double-quoted `CREATE TABLE` exception covered in "Identifiers and Case" below. When the Arrow schema contains lowercase fields (e.g., `country`, `user_id`), the resulting Snowflake columns are stored in lowercase and **must be referenced with double quotes** in every query that follows (`SELECT "country" FROM t`, not `SELECT country` or `SELECT COUNTRY`). To end up with conventional uppercase columns referencable without quotes, rename the Arrow fields to uppercase before the `adbc_ingest` call.

## Identifiers and Case

Unquoted identifiers are stored and resolved by Snowflake as uppercase. Double-quoted identifiers keep their case and resolve exactly as written, by default. Consequently, names coming back from metadata APIs such as `AdbcConnectionGetObjects`, along with plain column names in query results, should be treated as the stored Snowflake identifier form.

In a typical Snowflake database, objects and columns were created unquoted, so expect uppercase names like `C_CUSTKEY` rather than `c_custkey`. Never depend on the case the user happened to type in SQL; compare against the stored identifier form, or apply a consistent normalization.

Exception: when a table or column was created using double quotes, for example `CREATE TABLE "MyTable" ("id" INT)`, Snowflake stores those names precisely as `MyTable` and `id`, and SQL has to reference them double-quoted with the exact case: `SELECT "id" FROM "MyTable"`.

## More Information

If needed, more detailed documentation is available at https://docs.adbc-drivers.org/drivers/snowflake/index.html.
