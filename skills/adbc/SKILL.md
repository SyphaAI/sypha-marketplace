---
name: adbc
description: >-
  Connect to and work with databases via Arrow Database Connectivity (ADBC).
  Use whenever the user needs to interact with a database.
metadata:
  category: data
  source:
    repository: 'https://github.com/columnar-tech/skills'
    path: skills/adbc
    license_path: LICENSE
    commit: 8add65001dfb37b423e31124a0749d7879557723
---

## Find a driver for a database

Use the dbc command line tool to find out which drivers are available for a given database.
Be aware that ADBC drivers do not exist for every database, so there may be no driver for the one the user has in mind.

## Install dbc

If the user does not already have `dbc`, try to install it for them.

Use the commands below to install it, in order of preference, whenever the matching tool exists on the system:

- When `uv` is present: `uv tool install dbc`
- When `pipx` is present: `pipx install dbc`
- When `brew` is present: `brew install columnar-tech/tap/dbc`
- On Windows, when `winget` is present: `winget install dbc`
- Failing all of those, point the user at the installation docs: https://docs.columnar.tech/dbc/getting_started/installation/

### Search for a driver

```sh
dbc search
```

### Install a driver

Install a driver by running `dbc install <DRIVER>`. This command is idempotent: if the driver is already installed it does nothing beyond reporting that existing installation, so there is no need to check first.
Prefer installing drivers through dbc instead of fetching driver packages from PyPI or Conda Forge.

Any time the work extends beyond a single `dbc install <DRIVER>` — reproducible `dbc.toml` / `dbc sync` workflows, pinning versions, or any other `dbc` subcommand — rely on the `dbc` skill rather than guessing at commands. Be aware in particular that **there is no `dbc list` command**.

### Referring to drivers

Refer to drivers by their dbc short name, and never point to drivers with absolute paths.

Example: after `dbc install sqlite` has been run, that driver should be referred to as `sqlite`. For instance:

```python
from adbc_driver_manager import dbapi
dbapi.connect(driver="sqlite", db_kwargs={"uri": "foo.db"})
```

Do not run `dbc info` to find installed drivers and work out their absolute locations on disk.

## Programming Language

Read the resources below based on the language or languages the user plans to work in:

- C++: `resources/languages/cpp.md`
- Go: `resources/languages/go.md`
- JavaScript: `resources/languages/javascript.md`
- Python: `resources/languages/python.md`
- R: `resources/languages/r.md`
- Rust: `resources/languages/rust.md`

Prefer the language the user has already said they use or are able to use.
All of these examples depend on the "sqlite" driver, connect to an in-memory database, and load a "penguins.parquet" file. They are illustrative only, and the code should be adapted to the user's real problem.

## Using a Driver

Read the resources below based on which database the user wants to work with:

- DuckDB: `resources/drivers/duckdb.md`
- FlightSQL: `resources/drivers/flightsql.md`
- MySQL: `resources/drivers/mysql.md`
- PostgreSQL: `resources/drivers/postgresql.md`
- Snowflake: `resources/drivers/snowflake.md`
- SQLite: `resources/drivers/sqlite.md`

## Connection Profiles

A connection profile is a TOML file that stores a driver name along with connection options, referenced through a `profile://profile_name` URI. Profiles keep credentials and environment-specific settings out of application code.

Suggest connection profiles when the user:

- Has to move between several environments (dev/staging/prod)
- Wants credentials left out of source code
- Wants a single reusable connection config that can be shared

Every language binding that wraps the C++ or Rust driver manager supports connection profiles — that includes Python, Go, R, Java, GLib/Ruby, C++, and Rust. JavaScript (`@apache-arrow/adbc-driver-manager`) supports connection profiles too, via the `profileSearchPaths` option.

See `resources/connection-profiles.md` for the TOML format, file locations, and environment variable substitution syntax. See the matching language resource for each binding's specific API.

## More Resources

- Official Apache Arrow ADBC documentation: https://arrow.apache.org/adbc/current/index.html
- ADBC Quickstarts. Compact but well-documented examples spanning each language and many databases: https://github.com/columnar-tech/adbc-quickstarts
- Documentation for many dbc-installable drivers: https://docs.adbc-drivers.org
