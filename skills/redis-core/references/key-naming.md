# Use Consistent Key Naming Conventions

Well-organized key names make code easier to maintain and debug, and they enable efficient key scanning.

**Correct:** Separate segments with colons and keep the hierarchy consistent.

```
# Pattern: service:entity:id:attribute
user:1001:profile
user:1001:settings
order:2024:items
cache:api:users:list
session:abc123
```

**Python** (redis-py):
```python
# Good: Short, meaningful key
redis.set("product:8361", cached_html)
page = redis.get("product:8361")
```

**Java** (Jedis):
```java
// Good: Short, meaningful key derived from URL
jedis.set("product:8361", "<some cached HTML>");
String page = jedis.get("product:8361");
```

**Incorrect:** Very long keys, spaces, or inconsistent naming.

```
# These cause confusion and waste memory
User_1001_Profile
my key with spaces
com.mycompany.myapp.production.users.profile.data.1001
```

**Java** (Jedis):
```java
// Bad: Using full URL as key wastes memory and slows comparisons
jedis.set("http://www.verylongurlkey.com/store/products/product.html?id=8361",
          "<some cached HTML>");
```

**Key naming tips:**
- Keep keys readable yet short—they take up memory
- For multi-tenant applications, consider prefixing keys
- Rather than using an entire URL or long string, extract a short identifier from it
- When values are large binaries, consider keying on a hash digest instead of the value itself
- Stick to consistent separators (colons are the convention)

Reference: [Redis Keys](https://redis.io/docs/latest/develop/use/keyspace/)
