# AI Vector Search in Oracle

Oracle 26ai ships with native AI Vector Search, which lets vector embeddings be stored, indexed, and queried directly alongside relational data. This makes similarity search, retrieval-augmented generation (RAG), and hybrid AI+SQL workloads possible without a separate vector database.

Vector support debuted in Oracle 23ai and is fully available in Oracle 26ai.

## The VECTOR Data Type

```sql
-- Minimal runnable example with a 3-dimensional vector column
CREATE TABLE documents (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content     VARCHAR2(4000),
  source      VARCHAR2(255),
  embedding   VECTOR(3, FLOAT32)
);

-- Insert a vector
INSERT INTO documents (content, source, embedding)
VALUES (
  'Oracle Database supports native vector search.',
  'docs',
  TO_VECTOR('[0.023, -0.047, 0.112]')
);

-- Production embedding columns typically use dimensions such as 768, 1024, 1536, or 3072
```

### Supported Dimension Sizes and Storage Formats

| Format | Description | Use Case |
|---|---|---|
| `FLOAT32` | 32-bit floating point | Default; good balance of precision and size |
| `FLOAT64` | 64-bit double precision | Maximum precision |
| `INT8` | 8-bit integer (quantized) | Compact storage, faster search, slight precision loss |
| `*` (flexible) | Accepts any format | Use when format varies by source |

```sql
-- Flexible dimension/format column (accepts any embedding)
embedding VECTOR(*, *)

-- Fixed 768 dimensions, 8-bit quantized (e.g., compact models)
embedding VECTOR(768, INT8)
```

## Vector Distance Functions

Oracle offers `VECTOR_DISTANCE()` along with shorthand operators for performing similarity searches.

```sql
-- Find the 5 most similar documents to a query vector
SELECT id, content,
       VECTOR_DISTANCE(embedding, :query_vector, COSINE) AS distance
FROM   documents
ORDER  BY distance
FETCH  FIRST 5 ROWS ONLY;
```

### Distance Metrics

| Metric | Function Constant | Best For |
|---|---|---|
| Cosine similarity | `COSINE` | Text embeddings (most common) |
| Euclidean (L2) | `EUCLIDEAN` or `L2` | Image embeddings, spatial data |
| Dot product | `DOT` | When vectors are pre-normalized |
| Manhattan (L1) | `L1_DISTANCE` | Sparse vectors |
| Hamming | `HAMMING` | Binary/bit vectors |

```sql
-- Shorthand operators (introduced in Oracle 23ai)
-- <=> : cosine distance
-- <-> : euclidean distance
-- <#> : negative dot product

SELECT id, content
FROM   documents
ORDER  BY embedding <=> :query_vector
FETCH  FIRST 10 ROWS ONLY;
```

## Vector Indexes

Without an index, Oracle falls back to an exact (brute-force) scan. For large datasets, create a vector index to enable approximate nearest neighbor (ANN) search.

### HNSW Index (Hierarchical Navigable Small World)

Well-suited to static or slowly changing datasets. Delivers the highest query performance.

```sql
CREATE VECTOR INDEX docs_hnsw_idx
ON documents (embedding)
ORGANIZATION INMEMORY NEIGHBOR GRAPH
DISTANCE COSINE
WITH TARGET ACCURACY 95;
```

### IVF Index (Inverted File)

A better fit for datasets that receive frequent inserts. Partitions the vector space using clustering.

```sql
CREATE VECTOR INDEX docs_ivf_idx
ON documents (embedding)
ORGANIZATION NEIGHBOR PARTITIONS
DISTANCE COSINE
WITH TARGET ACCURACY 90
PARAMETERS (TYPE IVF, NEIGHBOR PARTITIONS 64);
```

### Index Accuracy vs. Performance Trade-off

```sql
-- Higher accuracy = slower build, slower query, but fewer missed results
WITH TARGET ACCURACY 99   -- near-exact, slower
WITH TARGET ACCURACY 80   -- faster, some recall loss
```

## Combining Vector Search with Relational Filters

A core strength of Oracle is the ability to combine vector search and SQL predicates in a single query.

```sql
-- Semantic search filtered by relational conditions
SELECT d.id,
       d.content,
       d.source,
       VECTOR_DISTANCE(d.embedding, :query_vec, COSINE) AS score
FROM   documents d
WHERE  d.source = 'docs'                    -- relational filter
  AND  d.created_date >= SYSDATE - 30       -- date filter
ORDER  BY score
FETCH  FIRST 5 ROWS ONLY;
```

```sql
-- Join vector results with relational data
SELECT p.product_name,
       p.price,
       VECTOR_DISTANCE(p.description_vec, :query_vec, COSINE) AS relevance
FROM   products p
JOIN   categories c ON p.category_id = c.id
WHERE  c.name = 'Electronics'
  AND  p.in_stock = 'Y'
ORDER  BY relevance
FETCH  FIRST 10 ROWS ONLY;
```

## RAG Pattern: Retrieval-Augmented Generation

A standard RAG pipeline using Oracle looks like this:

```sql
-- Step 1: Store chunked document embeddings
INSERT INTO doc_chunks (doc_id, chunk_seq, chunk_text, embedding)
SELECT doc_id,
       chunk_seq,
       chunk_text,
       TO_VECTOR(embedding_json)
FROM   staging_chunks;

-- Step 2: At query time, find relevant chunks
SELECT chunk_text
FROM   doc_chunks
ORDER  BY embedding <=> :user_query_embedding
FETCH  FIRST 5 ROWS ONLY;

-- Step 3: Pass retrieved chunks + user question to LLM (via SELECT AI or app layer)
```

## Checking Vector Index Usage

```sql
-- Confirm index is being used in execution plan
EXPLAIN PLAN FOR
SELECT id FROM documents
ORDER BY embedding <=> :q FETCH FIRST 5 ROWS ONLY;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
-- Look for: VECTOR INDEX HNSW SCAN or VECTOR INDEX IVF SCAN

-- Monitor vector index memory
SELECT index_name,
       num_vectors,
       ROUND(allocated_bytes / 1024 / 1024 / 1024, 2) AS allocated_gb,
       ROUND(used_bytes / 1024 / 1024 / 1024, 2) AS used_gb,
       default_accuracy
FROM   v$vector_index;
```

## Multi-Vector Queries

Queries can span multiple VECTOR columns or fuse several similarity searches together.

```sql
-- Find documents similar to BOTH a text query AND an image query
-- (cross-modal search: text + image embeddings in same row)
SELECT doc_id, title,
       text_embedding  <=> :query_text_vec  AS text_dist,
       image_embedding <=> :query_image_vec AS image_dist
FROM   documents
ORDER  BY (text_embedding  <=> :query_text_vec) * 0.6 +
          (image_embedding <=> :query_image_vec) * 0.4   -- weighted combination
FETCH  FIRST 10 ROWS ONLY;

-- Reciprocal Rank Fusion (RRF) — combine rankings from two searches
WITH text_search AS (
  SELECT doc_id,
         ROW_NUMBER() OVER (ORDER BY embedding <=> :query_vec) AS rn
  FROM   documents
  FETCH  FIRST 100 ROWS ONLY
),
keyword_search AS (
  SELECT doc_id,
         ROW_NUMBER() OVER (ORDER BY score(1) DESC) AS rn
  FROM   documents
  WHERE  CONTAINS(content, :keywords, 1) > 0
  FETCH  FIRST 100 ROWS ONLY
)
SELECT COALESCE(t.doc_id, k.doc_id) AS doc_id,
       1/(60 + NVL(t.rn, 100)) + 1/(60 + NVL(k.rn, 100)) AS rrf_score
FROM   text_search t
FULL   JOIN keyword_search k ON t.doc_id = k.doc_id
ORDER  BY rrf_score DESC
FETCH  FIRST 10 ROWS ONLY;
```

## Hybrid Vector Search

Hybrid vector search is appropriate when retrieval must combine semantic similarity with keyword or structured filtering. Oracle supports this both as an application-level query pattern and as a first-class hybrid index path.

```sql
CREATE HYBRID VECTOR INDEX docs_hybrid_idx ON doc_chunks(chunk_text)
PARAMETERS('MODEL my_embedding_model');
```

Use `DBMS_HYBRID_VECTOR.SEARCH` to query hybrid indexes when a single call must combine vector and text criteria.

```sql
SELECT DBMS_HYBRID_VECTOR.SEARCH(
         json('{ "hybrid_index_name" : "docs_hybrid_idx",
                 "vector" : { "search_text" : "invoice payment dispute" },
                 "text"   : { "contains"    : "customer AND overdue" },
                 "return" : { "topN"        : 10 }
               }'))
FROM dual;
```

Apply `text.contains` or `text.search_text` for lexical constraints. Use `filter_by` for business predicates such as status, region, or price. Set vector `filter_type` only when adjusting how filtering interacts with vector index evaluation; it is distinct from a business filter.

## Bulk Load: Disable Index, Load, Rebuild

When ingesting millions of vectors, drop the vector index beforehand, perform the load, then rebuild it.

```sql
-- 1. Drop the vector index before bulk load
DROP INDEX doc_chunks_hnsw_idx;

-- 2. Bulk load vectors
INSERT INTO doc_chunks (doc_id, chunk_seq, chunk_text, embedding)
SELECT doc_id, chunk_seq, chunk_text, embedding FROM staging_chunks;
COMMIT;

-- 3. Rebuild the HNSW index after load (much faster than incremental updates)
CREATE VECTOR INDEX doc_chunks_hnsw_idx ON doc_chunks(embedding)
ORGANIZATION INMEMORY NEIGHBOR GRAPH
DISTANCE COSINE
WITH TARGET ACCURACY 95;

-- Why: HNSW indexes are built in-memory; inserting into an existing HNSW index
-- one row at a time during bulk load is ~10x slower than post-load rebuild
```

## HNSW Index Memory Sizing

```sql
-- Check current vector index memory allocation
SHOW PARAMETER vector_memory_size;

-- Estimate required memory for HNSW index
-- Rule of thumb: dimensions × 4 bytes × num_vectors × 1.3 (overhead factor)
-- Example: 1536 dims × 4B × 1M vectors × 1.3 ≈ ~8 GB
SELECT index_name,
       num_vectors,
       embedding_dimension_count,
       ROUND(allocated_bytes / 1024 / 1024 / 1024, 2) AS allocated_gb,
       ROUND(used_bytes / 1024 / 1024 / 1024, 2) AS used_gb
FROM   v$vector_index
ORDER  BY index_name;

-- If VECTOR_MEMORY_SIZE is too small, HNSW falls back to disk (much slower)
-- Increase (requires restart or ALTER SYSTEM):
ALTER SYSTEM SET vector_memory_size = 8G SCOPE = SPFILE;
```

## V$VECTOR_INDEX Monitoring

```sql
-- Monitor HNSW index memory and accuracy
SELECT index_name,
       num_vectors,
       default_accuracy,
       accuracy_num_neighbors,
       ROUND(allocated_bytes / 1024 / 1024 / 1024, 2) AS allocated_gb,
       ROUND(used_bytes / 1024 / 1024 / 1024, 2) AS used_gb
FROM   v$vector_index
ORDER  BY index_name;

-- Check if index is fully loaded into memory
SELECT index_name,
       CASE WHEN used_bytes > 0 THEN 'ALLOCATED' ELSE 'NOT ALLOCATED' END AS storage_mode
FROM   v$vector_index;
```

## Parallel Vector Index Creation

```sql
-- Create HNSW index with parallelism (faster for large datasets)
CREATE VECTOR INDEX doc_chunks_hnsw_idx ON doc_chunks(embedding)
ORGANIZATION INMEMORY NEIGHBOR GRAPH
DISTANCE COSINE
WITH TARGET ACCURACY 95
PARALLEL 4;   -- use 4 parallel workers

-- After creation, index maintenance is single-threaded (DML inserts are serial)
-- Check index creation progress in V$SESSION_LONGOPS
SELECT sid, serial#, opname, target, sofar, totalwork,
       ROUND(sofar/totalwork*100, 1) AS pct_done
FROM   v$session_longops
WHERE  opname LIKE '%VECTOR INDEX%'
  AND  totalwork > 0;
```

## Best Practices

- Prefer `FLOAT32` over `FLOAT64` unless you have a compelling reason — it cuts storage in half with negligible quality impact for most models
- Align the distance metric with your embedding model's training objective (cosine is the norm for text models)
- Start with `TARGET ACCURACY 95` and lower it only if query latency is unacceptable
- Always pair vector search with relational predicates to narrow the search space
- For RAG: chunk documents at roughly 500 tokens with 10–20% overlap to maximize retrieval quality
- Periodically rebuild or reindex HNSW when the dataset changes substantially (IVF tolerates inserts more gracefully)
- Keep the original text alongside the embedding — it is required when supplying context to an LLM

## Common Mistakes

**Wrong distance metric for the model** — applying `EUCLIDEAN` to a cosine-trained embedding model meaningfully degrades result quality. Consult your model's documentation to confirm the correct metric.

**Embedding dimension mismatch** — `text-embedding-3-small` produces 1536 dims; `text-embedding-3-large` can produce up to 3072. Declare the exact dimension in the column type.

**No relational pre-filter** — scanning 10M vectors to retrieve a single user's 1000 documents squanders resources. Always add `WHERE user_id = :uid` before the vector sort.

**Skipping the vector index** — on tables exceeding 100K rows, an unindexed vector search becomes a full scan of every vector. Always create a HNSW or IVF index for production workloads.

**Storing embeddings as VARCHAR2/CLOB** — pre-23ai workarounds serialized vectors as JSON arrays. Migrate to the native `VECTOR` type to gain proper indexing and distance function support.

## Oracle Version Notes (19c vs 26ai)

- **19c**: No native VECTOR type; workarounds relied on VARCHAR2/CLOB with similarity calculated externally
- **23ai**: VECTOR data type introduced; HNSW and IVF indexes added; `VECTOR_DISTANCE()` and shorthand operators available
- **26ai**: Full production support; improved index performance; `DBMS_VECTOR`, `DBMS_VECTOR_CHAIN`, and `DBMS_HYBRID_VECTOR` for pipeline automation and hybrid retrieval; `SELECT AI` integration included

## See Also

- [SELECT AI in Oracle 26ai](../features/select-ai.md) — Natural language to SQL using vector-powered context
- [DBMS_VECTOR and DBMS_VECTOR_CHAIN](../features/dbms-vector.md) — Automated embedding generation and RAG pipelines
- [AI Profiles and Provider Configuration](../features/ai-profiles.md) — Connecting Oracle to OpenAI, Cohere, OCI GenAI

## Sources

- [Oracle AI Vector Search User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/23/vecse/)
- [VECTOR Data Type — Oracle SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/data-types.html)
- [VECTOR_DISTANCE Function](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/VECTOR_DISTANCE.html)
- [CREATE HYBRID VECTOR INDEX](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-hybrid-vector-index.html)
- [DBMS_HYBRID_VECTOR](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/dbms_hybrid_vector-vecse.html)
- [Oracle AI Vector Search Blog](https://blogs.oracle.com/database/post/oracle-ai-vector-search)
