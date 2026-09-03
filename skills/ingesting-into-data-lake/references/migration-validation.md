# Migration Validation Checklist

Execute every check listed below after migration. None may be skipped.

## 1. Row Count Match

```sql
SELECT 'source' AS tbl, COUNT(*) AS cnt
FROM "<source_catalog>"."<source_db>"."<source_table>"
UNION ALL
SELECT 'target' AS tbl, COUNT(*) AS cnt
FROM "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
```

Counts must be an exact match unless a WHERE filter was applied during migration. If filtering was used, document the anticipated difference.

## 2. Schema Comparison

```sql
-- Source schema
DESCRIBE "<source_catalog>"."<source_db>"."<source_table>"

-- Target schema
DESCRIBE "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
```

Verify:

- All expected columns are present
- Column order matches (or is acceptable if reordered)
- Types are compatible — minor promotions such as int->bigint are acceptable
- No unexpected columns have been added or dropped

## 3. Null Count Comparison

```sql
-- Run for each column, or generate dynamically
SELECT
    COUNT(*) - COUNT(col1) AS col1_nulls,
    COUNT(*) - COUNT(col2) AS col2_nulls
FROM "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
```

Run the same query against the source and compare. Null counts must match.

## 4. Boundary Value Check

```sql
SELECT
    MIN(numeric_col) AS min_val,
    MAX(numeric_col) AS max_val,
    MIN(date_col) AS min_date,
    MAX(date_col) AS max_date
FROM "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
```

Compare against the source. Min/max values must match, accounting for any WHERE filters applied during migration.

## 5. Distinct Count Check

```sql
SELECT
    COUNT(DISTINCT key_col) AS distinct_keys
FROM "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
```

Compare against the source. Any discrepancy indicates that duplicates were introduced or rows were lost.

## 6. Partition Verification (if partitioned)

```sql
SELECT <partition_expression>, COUNT(*) AS row_count
FROM "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
GROUP BY 1
ORDER BY 1
```

Confirm that partition distribution looks reasonable and that no partitions are absent.

## 7. Sample Row Comparison

```sql
-- Pick a specific key value and compare full rows
SELECT * FROM "<source_catalog>"."<source_db>"."<source_table>"
WHERE key_col = '<known_value>'

SELECT * FROM "s3tablescatalog/<bucket>"."<namespace>"."<target_table>"
WHERE key_col = '<known_value>'
```

Spot-check 3-5 specific rows. Every column value must match between source and target.

## Pass Criteria

| Check | Pass condition |
|-------|---------------|
| Row count | Exact match (or documented delta if filtered) |
| Schema | All columns present with compatible types |
| Null counts | Match within tolerance (0 difference expected) |
| Boundary values | Match exactly |
| Distinct counts | Match exactly |
| Partitions | All expected partitions present |
| Sample rows | All values match |
