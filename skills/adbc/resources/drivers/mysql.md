# mysql

## Installing the Driver

To install the MySQL ADBC driver using dbc, run:

```sh
dbc install mysql
```

## Connecting

Use this URI syntax to connect:

```text
mysql://[user[:[password]]@]host[:port][/schema][?attribute1=value1&...]
```

Examples:

- `mysql://localhost/mydb`
- `mysql://user:pass@localhost:3306/mydb`
- `mysql://user:pass@host/db?charset=utf8mb4&timeout=30s`
- `mysql://user@(/path/to/socket.sock)/db` (Unix domain socket)
- `mysql://user@localhost/mydb (no password)`

The `schema` part maps to the MySQL database name. Any reserved characters appearing in URI elements need to be URI-encoded (e.g. `@` becomes `%40`).

The [Go MySQL DSN format](https://github.com/go-sql-driver/mysql?tab=readme-ov-file#dsn-data-source-name) also works with this driver, though standard URIs are the recommended choice.

## Selecting a database

When no `schema` was included in the connection URI earlier, select a database by executing:

```sql
USE <NAME>
```

To list the databases that are available, call `AdbcConnectionGetObjects` with `depth` set to "catalogs".

## More Information

If needed, more detailed documentation is available at https://docs.adbc-drivers.org/drivers/mysql/index.html.
