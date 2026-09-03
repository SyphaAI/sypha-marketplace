# connection-profiles

A connection profile is a TOML file holding a driver name plus connection options. It separates credentials and configuration from application code, so switching environments (dev/staging/prod) requires no code changes. The driver manager resolves profiles during database initialization — before the underlying driver is loaded — which means every language binding built on the C++ or Rust driver manager supports them.

Recommend connection profiles when the user:

- Needs to switch among multiple environments (dev/staging/prod)
- Wants credentials kept out of the source code
- Wants one connection config that can be reused across scripts or tools

## Supported Library Versions

Only newer versions of each language's bindings support connection profiles.

- C++/Go/Python: 1.11.0
- Java: 0.23.0
- JavaScript: no minimum version
- R: 0.23.0
- Rust: 0.23.0

Because the **driver manager** resolves connection profiles before the underlying database driver is loaded, the version requirement is on the driver manager package rather than on any particular database driver.

## TOML format

```toml
profile_version = 1
driver = "adbc_driver_sqlite"

[Options]
uri = ":memory:"
```

- `profile_version` (required): must be `1`
- `driver` (required except when the application provides the driver on its own). Accepted forms:
  - A driver or driver manifest name (e.g., "snowflake"). These match dbc's short names.
  - A path to a shared library (e.g., "/usr/local/lib/libadbc_driver_snowflake.so")
  - A path to a driver manifest (e.g., "/etc/adbc/drivers/snowflake.toml")
- `[Options]` (required, even when empty): key/value pairs handed to `AdbcDatabaseSetOption` prior to init

Environment variable substitution is available in option values:

```toml
[Options]
uri = "postgresql://{{ env_var(DB_HOST) }}/mydb"
password = "{{ env_var(DB_PASSWORD) }}"
```

An environment variable that is not set substitutes as an empty string. Invalid syntax (a malformed `env_var()`) produces an error when the connection is made.

## Connection Profile Locations

A Connection Profile is a TOML file named `<profile_name>.toml`. The driver manager looks for them in:

- Additional Search Paths (when configured through the `additional_profile_search_path_list` option)
- `ADBC_PROFILE_PATH` environment variable (colon-separated on Unix, semicolon-separated on Windows)
- Conda Environment (when built with Conda support and `CONDA_PREFIX` is set): `$CONDA_PREFIX/etc/adbc/profiles/`
- User Configuration Directory:
  - **Linux:** `$XDG_CONFIG_HOME/adbc/profiles` if set, else `~/.config/adbc/profiles/`
  - **macOS:** `~/Library/Application Support/ADBC/Profiles/`
  - **Windows:** `%LOCALAPPDATA%\ADBC\Profiles\`

## Overriding options

Options set directly in code win over options coming from the profile. Treat the profile as a baseline that code-level options can override.
