# JDBC Pooling and Production

## Overview

Apply this skill when configuring Oracle JDBC for production services. It addresses UCP, Spring Boot datasource configuration, connection pool security, credential management, tracing, and operational best practices.

For driver artifacts, begin with [JDBC Dependencies](dependencies.md). For JDBC URLs, begin with [JDBC Connections](connections.md).

## UCP Connection Pool

```java
import java.sql.Connection;
import oracle.ucp.jdbc.PoolDataSource;
import oracle.ucp.jdbc.PoolDataSourceFactory;

PoolDataSource pds = PoolDataSourceFactory.getPoolDataSource();
pds.setConnectionFactoryClassName("oracle.jdbc.pool.OracleDataSource");
pds.setURL("jdbc:oracle:thin:@//localhost:1521/freepdb1");
pds.setUser("hr");
pds.setPassword("password");
pds.setInitialPoolSize(2);
pds.setMinPoolSize(2);
pds.setMaxPoolSize(20);
pds.setConnectionPoolName("HRPool");

try (Connection conn = pds.getConnection()) {
    // use conn
}
```

Align the pool size with the database service limits and the application's concurrency profile. Pools that are too large can heighten contention and complicate failure recovery.

## Spring Boot DataSource Configuration

Spring Boot defaults to HikariCP. For a standard Spring Boot application using the Oracle JDBC driver:

```yaml
spring:
  datasource:
    url: jdbc:oracle:thin:@//localhost:1521/freepdb1
    username: hr
    password: password
    driver-class-name: oracle.jdbc.OracleDriver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 2
```

Use the Oracle production POM when you deliberately want Oracle's production dependency bundle:

```xml
<dependency>
    <groupId>com.oracle.database.jdbc</groupId>
    <artifactId>ojdbc17-production</artifactId>
    <version>23.26.2.0.0</version>
    <type>pom</type>
</dependency>
```

## Credential Management

- Never hardcode passwords in Java source.
- Keep credentials out of version-controlled configuration files.
- Use Oracle Wallet for wallet-based deployments.
- Store production credentials in platform secret stores such as OCI Vault or another approved enterprise secret manager.
- Rotate credentials through deployment automation rather than manual code changes.

Wallet-based configuration:

```java
import oracle.jdbc.pool.OracleDataSource;

System.setProperty("oracle.net.tns_admin", "/path/to/wallet");

OracleDataSource ods = new OracleDataSource();
ods.setURL("jdbc:oracle:thin:@myatp_high?TNS_ADMIN=/path/to/wallet");
ods.setUser("username");
ods.setConnectionProperty("oracle.net.wallet_password", "walletPassword");
```

## Network Security

- Use TCPS/TLS for production connections where the deployment requires it.
- Enforce server identity verification with TLS security attributes when mandated by policy.
- Prefer service names and managed connect descriptors for production database services.
- Configure connection timeouts so outages fail in a predictable, bounded manner.

Example TCPS descriptor:

```java
String url = "jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCPS)(HOST=db-host)(PORT=2484))(CONNECT_DATA=(SERVICE_NAME=service_name)))";
```

## Least Privilege

Create database users with only the privileges the application actually needs.

```sql
CREATE USER app_user IDENTIFIED BY "secure_password";
GRANT CREATE SESSION TO app_user;
GRANT SELECT, INSERT, UPDATE ON needed_table TO app_user;
GRANT EXECUTE ON needed_procedure TO app_user;
```

Avoid overly broad privileges such as `SELECT ANY TABLE` and `EXECUTE ANY PROCEDURE` for application schemas.

## Auditing and Traceability

Populate client information on database sessions so they can be traced in monitoring, AWR, ASH, and audit workflows.

```java
import oracle.jdbc.OracleConnection;

OracleConnection oraConn = conn.unwrap(OracleConnection.class);
oraConn.setClientInfo("OCSID.MODULE", "YourAppName");
oraConn.setClientInfo("OCSID.ACTION", "SpecificOperation");
oraConn.setClientInfo("OCSID.CLIENTID", "endUserIdentifier");
```

These values are surfaced in session metadata fields such as module, action, and client identifier.

## Data Protection

- Consider Transparent Data Encryption (TDE) to protect sensitive data at rest.
- Use Oracle Data Redaction when query output must obscure sensitive values for certain users.
- Apply application-layer encryption to sensitive values only when the architecture demands it, using approved cryptographic libraries and key management practices.

Example data redaction policy:

```sql
BEGIN
  DBMS_REDACT.ADD_POLICY(
    object_schema => 'HR',
    object_name => 'EMPLOYEES',
    column_name => 'SSN',
    policy_name => 'REDACT_SSN_POLICY',
    function_type => DBMS_REDACT.PARTIAL,
    expression => 'SYS_CONTEXT(''USERENV'',''SESSION_USER'') NOT IN (''HR_MANAGER'')'
  );
END;
```

## Pool Security

- Validate connections before use when the pool or framework supports it.
- Configure appropriate idle, borrow, and abandoned connection timeout values.
- Use separate pools for distinct privilege levels when a single service handles meaningfully different classes of work.
- Roll back any failed transactions before returning connections to the pool.
- Do not share privileged maintenance credentials with regular application traffic.

UCP with connection factory properties:

```java
PoolDataSource pds = PoolDataSourceFactory.getPoolDataSource();
pds.setConnectionFactoryClassName("oracle.jdbc.pool.OracleDataSource");
pds.setURL(secureUrl);
pds.setUser(username);
pds.setConnectionFactoryProperties(java.util.Collections.singletonMap(
    "oracle.net.wallet_location",
    "(SOURCE=(METHOD=FILE)(METHOD_DATA=(DIRECTORY=/path/to/wallet)))"
));
```

## Dependency Security

- Keep the JDBC driver current through routine patching cycles.
- Track CVEs affecting Oracle JDBC and related libraries.
- Incorporate dependency scanning tools into CI/CD pipelines.
- Keep `ojdbc` and `ucp` artifacts pinned to the same version.

## Best Practices

- Use UCP for Oracle-aware production pooling when your stack does not already supply an approved pool.
- HikariCP works well for Spring Boot applications when it satisfies service requirements.
- Size pools conservatively, based on measured concurrency.
- Set client info (`OCSID.MODULE`, `OCSID.ACTION`, `OCSID.CLIENTID`) to support traceability.
- Use try-with-resources so borrowed connections are reliably returned to the pool.
- Use bind variables for user-supplied values; see [JDBC SQL and PL/SQL](sql.md).
- Do not log credentials, wallet paths that expose sensitive locations, or full connect descriptors containing secrets.

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Hardcoded credentials | Secret exposure | Use secret management or wallet-based configuration |
| Oversized pool | More contention and unstable failover | Size pools from measured service demand |
| Not closing connections | Pool exhaustion | Use try-with-resources |
| No client metadata | Harder production diagnosis | Set module, action, and client identifier |
| Driver and UCP version mismatch | Compatibility surprises | Keep Oracle artifacts on the same version |
| Broad database privileges | Larger blast radius | Grant only required privileges |

## Oracle Version Notes (19c vs 26ai)

- The examples reference the Oracle AI Database 26ai JDBC/UCP RU line.
- Oracle Database 26ai JDBC drivers are certified for Oracle Database 26ai, 21c, and 19c servers.
- Easy Connect Plus is available from Oracle Database 19c onward.

## Related Skills

- [JDBC Dependencies](dependencies.md)
- [JDBC Connections](connections.md)
- [JDBC SQL and PL/SQL](sql.md)
- [Connection Pooling](../connection-pooling.md)
- [Network Security](../../security/network-security.md)
- [Privilege Management](../../security/privilege-management.md)
- [Java Oracle JDBC Overview](../java-oracle-jdbc.md)

## Sources

- [Oracle AI Database JDBC Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjdbc/index.html)
- [Oracle AI Database UCP Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjucp/index.html)
- [Oracle Net Services Administrator's Guide 26ai - Configuring the Easy Connect Naming Method](https://docs.oracle.com/en/database/oracle/oracle-database/26/netag/configuring-easy-connect-naming-method.html)
- [Oracle JDBC Downloads](https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html)
- [Spring Boot Oracle Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/application-properties.html#appendix.application-properties.data)
