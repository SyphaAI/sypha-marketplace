# Java Oracle JDBC

## Overview

Apply these skills when developing Java applications that connect to Oracle Database using the Oracle JDBC Thin driver.

Begin here when you need to select the correct `ojdbc` artifact, construct a JDBC URL, run SQL safely, set up UCP pooling, or get a Java service production-ready with Oracle Database.

## JDBC Skill Map

| Need | Use |
|------|-----|
| Choose `ojdbc17`, `ojdbc11`, or UCP artifacts; configure Maven or Gradle | [JDBC Dependencies](java-oracle-jdbc/dependencies.md) |
| Build JDBC URLs; use Easy Connect, EZConnect+, TNS aliases, wallets, or TLS | [JDBC Connections](java-oracle-jdbc/connections.md) |
| Run queries, DML, batch operations, binds, and PL/SQL calls | [JDBC SQL and PL/SQL](java-oracle-jdbc/sql.md) |
| Configure UCP, Spring Boot datasource settings, security, and production practices | [JDBC Pooling and Production](java-oracle-jdbc/pooling-production.md) |

## Quick Defaults

- Use `ojdbc17` for applications targeting JDK 17 or later.
- Keep `ojdbc` and `ucp` artifacts pinned to the same version.
- Express JDBC URLs in `jdbc:oracle:thin:@//host:port/service_name` form for Easy Connect.
- Use `PreparedStatement` or Oracle named binds when handling user input.
- Use UCP or a framework-managed pool for production services.
- Configure wallets or TLS when connecting to Autonomous Database or secured deployments.

## Related Skills

- [Connection Pooling](connection-pooling.md)
- [Transaction Management](transaction-management.md)
- [SQL Injection Avoidance](../sql-dev/sql-injection-avoidance.md)
- [Network Security](../security/network-security.md)

## Sources

- [Oracle AI Database JDBC Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjdbc/index.html)
- [Oracle AI Database UCP Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjucp/index.html)
- [Oracle Net Services Administrator's Guide 26ai - Configuring the Easy Connect Naming Method](https://docs.oracle.com/en/database/oracle/oracle-database/26/netag/configuring-easy-connect-naming-method.html)
- [Oracle JDBC Downloads](https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html)
- [Spring Boot Oracle Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/application-properties.html#appendix.application-properties.data)
