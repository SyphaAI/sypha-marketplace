# postgresql

## Installing the Driver

To install the PostgreSQL ADBC driver using dbc, run:

```sh
dbc install postgresql
```

## Connecting

Use a standard PostgreSQL [connection URI](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING) to connect:

```text
postgresql://[user[:password]@][host[:port]][/dbname][?param1=value1&...]
```

Examples:

- `postgresql://localhost:5432/mydb`
- `postgresql://user:pass@localhost:5432/mydb`
- `postgresql://user:pass@localhost/mydb?sslmode=require`

## Selecting a database

The connection URI determines the database. Switching to another database means opening a new connection with a different URI.

To list the databases that are available, call `AdbcConnectionGetObjects` with `depth` set to "catalogs".

## More Information

If needed, more detailed documentation is available at https://arrow.apache.org/adbc/current/driver/postgresql.html.
