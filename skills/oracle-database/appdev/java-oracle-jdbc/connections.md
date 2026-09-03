# JDBC Connections for Oracle Database

## Overview

Apply this skill when constructing JDBC connection strings for Oracle Database, covering Easy Connect, Easy Connect Plus, TNS aliases, full connect descriptors, wallets, mTLS, and TLS.

For artifact selection, begin with [JDBC Dependencies](dependencies.md).

## Basic Connection

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

String url = "jdbc:oracle:thin:@//localhost:1521/freepdb1";

try (Connection conn = DriverManager.getConnection(url, "hr", "password");
     Statement stmt = conn.createStatement();
     ResultSet rs = stmt.executeQuery("SELECT sysdate FROM dual")) {
    if (rs.next()) {
        System.out.println(rs.getTimestamp(1));
    }
}
```

Use `jdbc:oracle:thin:@//host:port/service_name` for the standard Easy Connect form.

## Common URL Forms

```text
jdbc:oracle:thin:@//host:1521/service_name
jdbc:oracle:thin:@tns_alias
jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=host)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=service_name)))
```

Use a TNS alias when the application already relies on a managed `tnsnames.ora` or wallet directory. Use a full connect descriptor when explicit control over address, protocol, failover, load balancing, or security attributes is required.

## Easy Connect Plus

Easy Connect eliminates the need for `tnsnames.ora` for straightforward TCP/IP connections. In JDBC URLs, prefix the connect identifier with `//`:

```text
jdbc:oracle:thin:@//host[:port][/service_name]
```

Easy Connect Plus, introduced in Oracle Database 19c, augments the syntax with protocol, multiple hosts or ports, and connect descriptor parameters appended after `?`. Separate name-value pairs with `&`:

```text
jdbc:oracle:thin:@//db-host.example.com:1521/sales
jdbc:oracle:thin:@//db-host.example.com:1521/sales?connect_timeout=1min&transport_connect_timeout=30sec&retry_count=3&retry_delay=2
jdbc:oracle:thin:@//db1.example.com:1521,db2.example.com:1521/sales?load_balance=on&failover=on
jdbc:oracle:thin:@tcps://db-host.example.com:1521/sales?tls_server_dn_match=on
```

Supported EZConnect+ parameters include `CONNECT_TIMEOUT`, `TRANSPORT_CONNECT_TIMEOUT`, `RETRY_COUNT`, `RETRY_DELAY`, `SDU`, `LOAD_BALANCE`, and `FAILOVER`.

## Wallet and mTLS

Autonomous Database and other secured deployments frequently rely on a wallet directory. Direct JDBC to the wallet using `TNS_ADMIN` or the `oracle.net.tns_admin` system property.

```java
import java.sql.Connection;
import oracle.jdbc.pool.OracleDataSource;

System.setProperty("oracle.net.tns_admin", "/path/to/wallet");

OracleDataSource ods = new OracleDataSource();
ods.setURL("jdbc:oracle:thin:@myatp_high?TNS_ADMIN=/path/to/wallet");
ods.setUser("admin");
ods.setPassword("password");

try (Connection conn = ods.getConnection()) {
    // use conn
}
```

For password-protected wallets, supply the wallet password as a connection property:

```java
ods.setConnectionProperty("oracle.net.wallet_password", "walletpassword");
```

Do not hardcode wallet passwords in application source code. Use your deployment platform's secret store or a credential injection mechanism instead.

## TLS Connections

Use `tcps://` for TLS connections and add TLS security attributes when the deployment requires server identity verification.

```text
jdbc:oracle:thin:@tcps://db-host.example.com:1521/sales?tls_server_dn_match=on
```

With a full connect descriptor, use `PROTOCOL=TCPS`:

```java
String url = "jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCPS)(HOST=db-host)(PORT=2484))(CONNECT_DATA=(SERVICE_NAME=service_name)))";
```

## Connection Practices

- Prefer service names over SIDs for contemporary Oracle Database deployments.
- Use Easy Connect for straightforward direct connections.
- Use Easy Connect Plus or connect descriptors when timeouts, failover, load balancing, or TLS settings are needed.
- Use TNS aliases for wallet-based Autonomous Database connections and centrally managed network configuration.
- Configure connect and transport timeouts so connection attempts fail in a predictable, bounded way.
- Avoid embedding credentials directly in JDBC URLs.

## Oracle Version Notes (19c vs 26ai)

- Easy Connect Plus is available from Oracle Database 19c onward.
- Use the basic Easy Connect form when compatibility with older clients is a requirement.
- TLS and wallet settings are governed by the database service, wallet contents, and deployment policy — not solely by the JDBC driver.

## Related Skills

- [JDBC Dependencies](dependencies.md)
- [JDBC Pooling and Production](pooling-production.md)
- [Network Security](../../security/network-security.md)
- [Java Oracle JDBC Overview](../java-oracle-jdbc.md)

## Sources

- [Oracle AI Database JDBC Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjdbc/index.html)
- [Oracle Net Services Administrator's Guide 26ai - Configuring the Easy Connect Naming Method](https://docs.oracle.com/en/database/oracle/oracle-database/26/netag/configuring-easy-connect-naming-method.html)
- [Oracle JDBC Downloads](https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html)
