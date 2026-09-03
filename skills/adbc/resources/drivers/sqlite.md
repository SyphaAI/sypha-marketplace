# sqlite

## Installing the Driver

To install the SQLite ADBC driver using dbc, run:

```sh
dbc install sqlite
```

## Connecting

To connect, provide a `uri` option. It can be a filename, a [SQLite URI filename](https://www.sqlite.org/c3ref/open.html#urifilenamesinsqlite3open), or left out altogether to get an in-memory database.

Valid URIs:

- `:memory:` - in-memory database (shared across connections)
- `/path/to/database.db` - file path
- `file:/path/to/database.db` - URI filename
- `file:/path/to/database.db?mode=ro` - URI filename with parameters

Leaving out the `uri` option gives the default: an in-memory database shared by all connections.

## More Information

If needed, more detailed documentation is available at https://arrow.apache.org/adbc/current/driver/sqlite.html.
