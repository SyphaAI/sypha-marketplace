# Tables — Java SDK Quick Reference

> Distilled from **azure-data-tables-java**. Complete patterns (typed entities,
> batch transactions, OData filters, Cosmos DB Table API)
> are available in the **azure-data-tables-java** plugin skill if installed.

## Install
```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-data-tables</artifactId>
    <version>12.6.0-beta.1</version>
</dependency>
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-identity</artifactId>
</dependency>
```

## Quick Start

> **Auth:** `DefaultAzureCredential` is intended for local development. See [auth-best-practices.md](../auth-best-practices.md) for production credential patterns.

```java
import com.azure.data.tables.TableServiceClientBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
var serviceClient = new TableServiceClientBuilder()
    .endpoint("<table-account-url>")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
```

## Best Practices
- Partition Key Design: select keys that spread load evenly across partitions
- Batch Operations: use transactions to perform atomic multi-entity updates
- Query Optimization: always include a PartitionKey filter in queries
- Select Projection: retrieve only the properties needed to improve performance
- Entity Size: keep entities below 1MB (Storage) or 2MB (Cosmos)
