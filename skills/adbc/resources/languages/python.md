# python

## Notes

If the user has `uv` installed, prefer it. For scripts, favor declaring dependencies with PEP 723 style comments at the top:

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "dependency-name",
# ]
# ///
```

and then run the script with `uv run script.py`.

## Suggested Packages

- adbc-driver-manager
- dotenv
- pandas
- pyarrow

## Usage

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = ["adbc-driver-manager>=1.9.0", "pyarrow>=20.0.0"]
# ///

from adbc_driver_manager import dbapi
import pyarrow.parquet as pq

# Load driver and connect to database
with dbapi.connect(driver="sqlite", db_kwargs={"uri": ":memory:"}) as con:
    with con.cursor() as cursor:
        # Execute a query
        cursor.execute("SELECT 41")
        print(cursor.fetch_arrow_table())

        # Execute a query with a bind parameter
        cursor.execute("SELECT ? + 1 AS the_answer", parameters=(41,))
        print(cursor.fetch_arrow_table())

        # Ingest a Parquet file and read it back
        penguins = pq.read_table("../penguins.parquet")
        cursor.adbc_ingest("penguins", penguins)

        # Important! dbapi does not autocommit by default so we should commit
        con.commit()

        cursor.execute("SELECT COUNT(*) AS total_rows FROM penguins")
        print(cursor.fetch_arrow_table())

        # List all catalogs
        print(con.adbc_get_objects(depth="catalogs").read_all())

        # List all schemas in a specific catalog
        print(con.adbc_get_objects(depth="db_schemas", catalog_filter="main").read_all())

        # List all tables in a specific schema
        print(con.adbc_get_objects(depth="tables", catalog_filter="main", db_schema_filter="").read_all())
```

## Connection Profiles

Introduced in version 1.11.0; earlier versions do not have this feature.

Rather than hardcoding the driver and options, connect through a named profile using a `profile://` URI:

```python
with dbapi.connect("profile://mydb_dev") as con:
    with con.cursor() as cursor:
        cursor.execute("SELECT 1")
        print(cursor.fetch_arrow_table())
```

To override individual options coming from the profile, pass `db_kwargs`:

```python
with dbapi.connect("profile://mydb_dev", db_kwargs={"uri": "file::memory:"}) as con:
    ...
```

## More information

If needed, more detailed documentation is available at https://arrow.apache.org/adbc/current/python/index.html.
