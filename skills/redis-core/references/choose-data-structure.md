# Choose the Right Data Structure

Picking the Redis data type that fits your use case is fundamental to performance and efficient memory use.

| Use Case | Recommended Type | Why |
|----------|------------------|-----|
| Counters, simple values | String | Atomic, fast operations |
| Object with fields | Hash | Efficient memory use, partial updates, expiration at the field level |
| Queue, recent items | List | Push/pop at either end in O(1) |
| Unique items, membership | Set | Add/remove/check in O(1) |
| Rankings, ranges | Sorted Set | Ordering by score |
| Nested/hierarchical data | JSON | Queries by path, nested structures, geospatial indexing via RQE |
| Event logs, messaging | Stream | Persistent, with consumer groups |
| Similarity search | Vector Set | Vector storage native to Redis, with built-in HNSW indexing |

**Incorrect:** Reaching for strings for everything.

**Python** (redis-py):
```python
# Storing object as JSON string loses atomic field updates
redis.set("user:1001", json.dumps({"name": "Alice", "email": "alice@example.com"}))

# To update email, must fetch, parse, modify, and rewrite entire object
user = json.loads(redis.get("user:1001"))
user["email"] = "new@example.com"
redis.set("user:1001", json.dumps(user))
```

**Java** (Jedis):
```java
// Bad: Storing as delimited string requires manual parsing
jedis.set("bicycle", "Deimos;Ergonom;Enduro bikes;4972");
String bike = jedis.get("bicycle");
String[] fields = bike.split(";");
String model = fields[0];  // Fragile and error-prone
```

**Correct:** Model objects with fields as a Hash.

**Python** (redis-py):
```python
# Hash allows atomic field updates
redis.hset("user:1001", mapping={"name": "Alice", "email": "alice@example.com"})

# Update single field without touching others
redis.hset("user:1001", "email", "new@example.com")
```

**Java** (Jedis):
```java
import java.util.Map;
import java.util.HashMap;

// Good: Hash models properties naturally
Map<String, String> hashFields = new HashMap<>();
hashFields.put("model", "Deimos");
hashFields.put("brand", "Ergonom");
hashFields.put("type", "Enduro bikes");
hashFields.put("price", "4972");

jedis.hset("bicycle", hashFields);

// Read individual field
String model = jedis.hget("bicycle", "model");
```

Reference: [Choosing the Right Data Type](https://redis.io/docs/latest/develop/data-types/compare-data-types/)
