# Section Definitions

This file specifies the rule categories for Postgres best practices. Rules are assigned to sections automatically based on their filename prefix.

Treat the examples below as illustrative only. Substitute each section with the actual rule categories for Postgres best practices.

---

## 1. Query Performance (query)
**Impact:** CRITICAL
**Description:** Slow queries, absent indexes, and suboptimal query plans. Represents the most frequent source of Postgres performance degradation.

## 2. Connection Management (conn)
**Impact:** CRITICAL
**Description:** Connection pooling, connection limits, and serverless strategies. Essential for applications that require high concurrency or run in serverless environments.

## 3. Security & RLS (security)
**Impact:** CRITICAL
**Description:** Row-Level Security policies, privilege management, and authentication patterns.

## 4. Schema Design (schema)
**Impact:** HIGH
**Description:** Table structure, index strategies, partitioning, and data type selection. Establishes the foundation for sustained long-term performance.

## 5. Concurrency & Locking (lock)
**Impact:** MEDIUM-HIGH
**Description:** Transaction management, isolation levels, deadlock prevention, and lock contention patterns.

## 6. Data Access Patterns (data)
**Impact:** MEDIUM
**Description:** Eliminating N+1 queries, batch operations, cursor-based pagination, and efficient data retrieval.

## 7. Monitoring & Diagnostics (monitor)
**Impact:** LOW-MEDIUM
**Description:** Leveraging pg_stat_statements, EXPLAIN ANALYZE, metrics collection, and performance diagnostics.

## 8. Advanced Features (advanced)
**Impact:** LOW
**Description:** Full-text search, JSONB optimization, PostGIS, extensions, and other advanced Postgres capabilities.
