# JDBC Dependencies for Oracle Database

## Overview

Use this skill to select the Oracle JDBC driver and associated artifacts for a Java application connecting to Oracle Database.

Oracle ships the JDBC Thin driver (`ojdbc`) as a pure-Java JAR, so no Oracle Client installation is needed for standard JDBC Thin connections. Oracle also supplies UCP (Universal Connection Pool) for production-grade connection pooling.

## Driver and JDK Selection

| JAR | JDK Compatibility |
|-----|-------------------|
| `ojdbc17.jar` | JDK 17, 19, 21, 25 |
| `ojdbc11.jar` | JDK 11, 21 |
| `ojdbc8.jar` | JDK 8, 11 |

Use the matching UCP artifact for the JDBC driver line:

| JDBC artifact | UCP artifact |
|---------------|--------------|
| `ojdbc17` | `ucp17` |
| `ojdbc11` | `ucp11` |
| `ojdbc8` | `ucp` |

Always keep `ojdbc` and `ucp` artifacts on the same version.

## Maven

For JDK 17+ applications:

```xml
<dependency>
    <groupId>com.oracle.database.jdbc</groupId>
    <artifactId>ojdbc17</artifactId>
    <version>23.26.2.0.0</version>
</dependency>

<dependency>
    <groupId>com.oracle.database.jdbc</groupId>
    <artifactId>ucp17</artifactId>
    <version>23.26.2.0.0</version>
</dependency>
```

For JDK 11 applications:

```xml
<dependency>
    <groupId>com.oracle.database.jdbc</groupId>
    <artifactId>ojdbc11</artifactId>
    <version>23.26.2.0.0</version>
</dependency>

<dependency>
    <groupId>com.oracle.database.jdbc</groupId>
    <artifactId>ucp11</artifactId>
    <version>23.26.2.0.0</version>
</dependency>
```

For applications that deliberately use Oracle's production dependency bundle:

```xml
<dependency>
    <groupId>com.oracle.database.jdbc</groupId>
    <artifactId>ojdbc17-production</artifactId>
    <version>23.26.2.0.0</version>
    <type>pom</type>
</dependency>
```

## Gradle

For JDK 17+ applications:

```groovy
implementation 'com.oracle.database.jdbc:ojdbc17:23.26.2.0.0'
implementation 'com.oracle.database.jdbc:ucp17:23.26.2.0.0'
```

For JDK 11 applications:

```groovy
implementation 'com.oracle.database.jdbc:ojdbc11:23.26.2.0.0'
implementation 'com.oracle.database.jdbc:ucp11:23.26.2.0.0'
```

## Dependency Practices

- Declare JDBC and UCP versions explicitly unless your platform enforces a controlled BOM strategy.
- Update the JDBC driver through your standard dependency patching process, particularly for security and compatibility fixes.
- Where practical, keep JDBC, UCP, ONS, and other Oracle database client artifacts from the same release line.
- Choose `ojdbc17` for new JDK 17+ services unless a platform constraint dictates `ojdbc11`.
- Do not use outdated drivers such as `ojdbc6` or `ojdbc7`; they lack current fixes and features.

## Oracle Version Notes (19c vs 26ai)

- The examples reference the Oracle AI Database 26ai JDBC/UCP RU line.
- Oracle Database 26ai JDBC drivers are certified for use with Oracle Database 26ai, 21c, and 19c servers.
- Accessing newer server capabilities such as JSON Relational Duality Views and `VECTOR` requires a compatible database release alongside a current JDBC driver line.

## Related Skills

- [JDBC Connections](connections.md)
- [JDBC Pooling and Production](pooling-production.md)
- [Java Oracle JDBC Overview](../java-oracle-jdbc.md)

## Sources

- [Oracle AI Database JDBC Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjdbc/index.html)
- [Oracle AI Database UCP Developer's Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jjucp/index.html)
- [Oracle JDBC Downloads](https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html)
