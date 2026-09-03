# flightsql

## Installing the Driver

To install the Flight SQL ADBC driver using dbc, run:

```sh
dbc install flightsql
```

## Connecting

To connect, pass a `uri` option containing a gRPC URI:

```text
grpc://host:port
grpc+tls://host:port
```

`grpc://` is for unencrypted connections, while `grpc+tls://` is for connections encrypted with TLS.

## Authentication

Several authentication methods are available in the driver:

- **Username/Password**: Provide the `username` and `password` options on the database.
- **Bearer Token**: Assign `Bearer <token>` to the `adbc.flight.sql.authorization_header` option.
- **Custom Headers**: Provide options prefixed with `adbc.flight.sql.rpc.call_header.<header_name>` (header names must be lowercase).

## TLS Options

- `adbc.flight.sql.client_option.tls_skip_verify` - Set to `true` to bypass verification of the server certificate.
- `adbc.flight.sql.client_option.tls_root_certs` - Supply replacement root certificates for server verification.
- `adbc.flight.sql.client_option.tls_override_hostname` - Substitute a different hostname for TLS verification.
- `adbc.flight.sql.client_option.mtls_cert_chain` - Client certificate used for mTLS.
- `adbc.flight.sql.client_option.mtls_private_key` - Client private key used for mTLS.

## More Information

If needed, more detailed documentation is available at https://arrow.apache.org/adbc/current/driver/flight_sql.html.
