# Oracle Virtual Columns

## Overview

A **virtual column** is a column that holds no physical data on disk. Its value comes from a deterministic expression that Oracle evaluates on demand whenever the column is referenced — whether in a query, an index, a constraint, or a partition key.

Virtual columns were introduced in Oracle 11g Release 1 and offer a way to surface derived data as first-class column members without the storage cost, trigger-based maintenance burden, or inline-expression verbosity.

**Situations where virtual columns are useful:**
- Surfacing a frequently used computed expression under a named column
- Indexing a complex expression without creating a dedicated function-based index
- Partitioning on a computed value
- Enforcing business rules through check constraints applied to derived values
- Providing stable interfaces for views and applications as underlying logic evolves

---

## Defining Virtual Columns

### Basic Syntax

```sql
column_name [data_type] [GENERATED ALWAYS] AS (expression) [VIRTUAL]
```

- `GENERATED ALWAYS AS (expression)` is mandatory syntax.
- The `VIRTUAL` keyword is optional but recommended for clarity.
- The data type is optional; Oracle infers it from the expression. Explicit types must be compatible with the expression result.

### Simple Virtual Column

```sql
CREATE TABLE employees (
    employee_id   NUMBER(6)     NOT NULL,
    first_name    VARCHAR2(50)  NOT NULL,
    last_name     VARCHAR2(50)  NOT NULL,
    salary        NUMBER(10,2)  NOT NULL,
    commission_pct NUMBER(3,2),

    -- Fully-qualified name for display; no stored data
    full_name     VARCHAR2(101) GENERATED ALWAYS AS (first_name || ' ' || last_name) VIRTUAL,

    -- Annual salary including commission
    annual_comp   NUMBER        GENERATED ALWAYS AS (
        salary * 12 * NVL(1 + commission_pct, 1)
    ) VIRTUAL,

    CONSTRAINT pk_employees PRIMARY KEY (employee_id)
);
```

### Adding a Virtual Column to an Existing Table

```sql
ALTER TABLE employees
ADD (
    salary_band VARCHAR2(10) GENERATED ALWAYS AS (
        CASE
            WHEN salary < 30000  THEN 'LOW'
            WHEN salary < 80000  THEN 'MEDIUM'
            WHEN salary < 150000 THEN 'HIGH'
            ELSE                      'EXECUTIVE'
        END
    ) VIRTUAL
);
```

### Querying Virtual Columns

From a query's perspective, virtual columns are indistinguishable from stored columns:

```sql
SELECT employee_id, full_name, salary, annual_comp, salary_band
FROM   employees
WHERE  salary_band = 'HIGH'
ORDER  BY annual_comp DESC;
```

Oracle evaluates the expression inline without persisting the result. The `annual_comp` predicate is computed per row during the scan.

---

## Function-Based Virtual Columns

Virtual columns may invoke **deterministic** PL/SQL functions:

```sql
CREATE OR REPLACE FUNCTION fiscal_year(p_date IN DATE)
RETURN NUMBER DETERMINISTIC AS
BEGIN
    -- Fiscal year starts April 1
    RETURN CASE
        WHEN EXTRACT(MONTH FROM p_date) >= 4
        THEN EXTRACT(YEAR FROM p_date)
        ELSE EXTRACT(YEAR FROM p_date) - 1
    END;
END fiscal_year;
/

CREATE TABLE sales_orders (
    order_id       NUMBER         NOT NULL,
    order_date     DATE           NOT NULL,
    customer_id    NUMBER         NOT NULL,
    total_amount   NUMBER(12,2)   NOT NULL,

    -- Virtual column using a deterministic function
    fiscal_yr      NUMBER         GENERATED ALWAYS AS (fiscal_year(order_date)) VIRTUAL,

    -- Built-in function: truncate to month for time-series grouping
    order_month    DATE           GENERATED ALWAYS AS (TRUNC(order_date, 'MM')) VIRTUAL,

    CONSTRAINT pk_sales_orders PRIMARY KEY (order_id)
);
```

**The function MUST be declared `DETERMINISTIC`.** Using a non-deterministic function as the virtual column expression will cause Oracle to raise an error or yield inconsistent results when the column is indexed.

---

## Indexing Virtual Columns

One of the most valuable use cases is creating a B-tree index directly on a virtual column. The result is functionally equivalent to a function-based index, but with improved usability.

```sql
-- Index on a virtual column for salary band queries
CREATE INDEX idx_emp_salary_band ON employees (salary_band);

-- Composite index: fiscal year + customer for reporting queries
CREATE INDEX idx_orders_fiscal_cust ON sales_orders (fiscal_yr, customer_id);

-- Query that uses the virtual column index (optimizer can use the index)
SELECT customer_id, COUNT(*), SUM(total_amount)
FROM   sales_orders
WHERE  fiscal_yr = 2025
GROUP  BY customer_id;
```

### Verifying Index Usage on Virtual Columns

```sql
EXPLAIN PLAN FOR
    SELECT employee_id, full_name
    FROM   employees
    WHERE  salary_band = 'EXECUTIVE';

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
-- Should show: INDEX RANGE SCAN on IDX_EMP_SALARY_BAND
```

---

## Virtual Columns as Partition Keys

Virtual columns are especially powerful as **partition keys**, letting you partition on a derived value without denormalizing data.

```sql
-- Partition a large transaction table by fiscal year
CREATE TABLE financial_transactions (
    txn_id        NUMBER         NOT NULL,
    txn_date      DATE           NOT NULL,
    account_id    NUMBER         NOT NULL,
    amount        NUMBER(15,2)   NOT NULL,
    txn_type      VARCHAR2(20),

    -- Virtual column used as the partition key
    txn_fiscal_yr NUMBER         GENERATED ALWAYS AS (fiscal_year(txn_date)) VIRTUAL
)
PARTITION BY RANGE (txn_fiscal_yr) (
    PARTITION p_fy2022 VALUES LESS THAN (2023),
    PARTITION p_fy2023 VALUES LESS THAN (2024),
    PARTITION p_fy2024 VALUES LESS THAN (2025),
    PARTITION p_fy2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN (MAXVALUE)
);
```

With this design:
- A query `WHERE txn_date BETWEEN DATE '2024-04-01' AND DATE '2025-03-31'` triggers partition pruning when the optimizer can resolve `fiscal_year(txn_date)` to a range.
- More reliably, query directly on `txn_fiscal_yr = 2024` to guarantee partition pruning.

```sql
-- Direct partition pruning via virtual column
SELECT SUM(amount)
FROM   financial_transactions
WHERE  txn_fiscal_yr = 2024
  AND  txn_type = 'DEBIT';
```

---

## Virtual Columns with Check Constraints

```sql
CREATE TABLE orders (
    order_id       NUMBER PRIMARY KEY,
    order_date     DATE NOT NULL,
    ship_date      DATE,
    order_amount   NUMBER(12,2) NOT NULL,
    discount_pct   NUMBER(4,2) DEFAULT 0,

    -- Virtual column
    net_amount     NUMBER GENERATED ALWAYS AS (order_amount * (1 - discount_pct/100)) VIRTUAL,

    -- Check constraint on the virtual column
    CONSTRAINT chk_net_positive CHECK (net_amount > 0),
    CONSTRAINT chk_ship_after_order CHECK (ship_date IS NULL OR ship_date >= order_date)
);
```

---

## Viewing Virtual Column Metadata

```sql
-- List virtual columns in a table
SELECT column_name,
       data_type,
       data_length,
       nullable,
       virtual_column,
       data_default          -- stores the expression
FROM   user_tab_columns
WHERE  table_name    = 'EMPLOYEES'
  AND  virtual_column = 'YES';

-- Expression details for virtual columns
SELECT column_name, data_default
FROM   user_tab_cols
WHERE  table_name     = 'EMPLOYEES'
  AND  virtual_column  = 'YES';

-- Check if any indexes are on virtual columns
SELECT ic.index_name, ic.column_name, tc.virtual_column
FROM   user_ind_columns ic
JOIN   user_tab_cols    tc ON tc.table_name  = ic.table_name
                           AND tc.column_name = ic.column_name
WHERE  ic.table_name    = 'EMPLOYEES'
  AND  tc.virtual_column = 'YES';
```

---

## Limitations and Gotchas

### What Expressions Are Allowed

Virtual column expressions **must**:
- Be deterministic (identical inputs must always yield identical output)
- Be self-contained within the row (only columns from the same row may be referenced)
- Rely on built-in SQL functions or deterministic PL/SQL functions
- Not reference other virtual columns in the same table (Oracle 11g/12c restriction; relaxed in later releases — verify your version)
- Not contain subqueries, aggregate functions, or `ROWNUM`/`ROWID`/`LEVEL`

### Storage and DML Behavior

```sql
-- You CANNOT insert into or update a virtual column
-- This will raise ORA-54013
INSERT INTO employees (employee_id, first_name, last_name, salary, full_name)
VALUES (1001, 'Jane', 'Smith', 75000, 'Jane Smith');  -- ERROR

-- Correct: omit virtual columns from INSERT
INSERT INTO employees (employee_id, first_name, last_name, salary)
VALUES (1001, 'Jane', 'Smith', 75000);

-- You CAN reference virtual columns in SELECT and WHERE
SELECT * FROM employees WHERE full_name = 'Jane Smith';
```

### Statistics and Virtual Columns

```sql
-- DBMS_STATS can gather statistics on virtual columns,
-- but the METHOD_OPT default ('FOR ALL COLUMNS') includes them.
-- If the expression is complex, stat gathering may be slower.
-- You can exclude virtual columns explicitly:
BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(
        ownname     => 'APPSCHEMA',
        tabname     => 'EMPLOYEES',
        method_opt  => 'FOR ALL REAL COLUMNS SIZE AUTO',  -- skip virtual columns
        cascade     => TRUE
    );
END;
/
```

### Export and Import Considerations

Virtual column expressions are persisted as metadata in the data dictionary. Data Pump (`expdp`/`impdp`) exports these expressions as DDL. Keep in mind:
- Any user-defined PL/SQL function referenced by the expression must already exist in the target schema before the table is imported.
- If the function signature differs between export and import, the virtual column may be invalid after import.

### Virtual Columns in External Tables

Virtual columns are **not supported** on external tables or on object-relational tables (tables containing `REF` columns in certain configurations). Attempting to add one raises `ORA-30553`.

### Performance Consideration: Expression Evaluation Cost

Virtual columns are re-evaluated on every reference in a query unless an index covers the column. On a table with millions of rows and a complex PL/SQL function as the expression, a full-table scan will invoke the function repeatedly. **Index any virtual column** that appears in a WHERE clause predicate.

---

## Best Practices

- **Encapsulate expressions in `DETERMINISTIC` PL/SQL functions** rather than embedding complex logic directly in the column definition. This improves readability, simplifies expression changes (a recompile is all that is needed), and keeps DDL clean.
- **Index virtual columns used in WHERE clauses and JOIN conditions.** Without an index, Oracle must evaluate the expression for every row during a full scan.
- **Name virtual columns descriptively** to differentiate them from stored columns. Some teams append a suffix such as `_V` or `_CALC` (e.g., `ANNUAL_COMP_V`) to indicate to developers that no physical storage backs the column.
- **Use virtual columns as partition keys** rather than introducing redundant denormalized columns, eliminating the risk of inconsistency between the stored column and the base data.
- **Test expression changes thoroughly.** Altering a virtual column's expression leaves dependent indexes stale; they must be explicitly rebuilt. Oracle does not invalidate or rebuild them automatically.
- **Document the business rule behind each virtual column** in the column's comment:

```sql
COMMENT ON COLUMN employees.salary_band IS
    'Derived salary classification: LOW (<30K), MEDIUM (30K-80K), HIGH (80K-150K), EXECUTIVE (150K+). Virtual — not stored.';
```

---

## Common Mistakes and How to Avoid Them

**Mistake 1: Using a non-deterministic function**
Oracle may permit creation in some configurations but produce incorrect results once the column is indexed, because the index value may diverge from the runtime value. Always mark functions `DETERMINISTIC` explicitly and confirm they genuinely are (e.g., they must not call `SYSDATE`, `DBMS_RANDOM`, or query other tables).

**Mistake 2: Expecting DML to populate virtual columns**
Developers unfamiliar with virtual columns sometimes include them in INSERT or UPDATE statements. Doing so raises `ORA-54013: INSERT operation disallowed on virtual columns`. Applications must be written to exclude virtual column names from all DML.

**Mistake 3: Modifying the underlying function without rebuilding indexes**
Changing `fiscal_year()` to adopt a different fiscal calendar leaves the index `idx_orders_fiscal_cust` containing values computed by the previous function. You must execute `ALTER INDEX ... REBUILD` after any change to a function referenced by a virtual column index.

**Mistake 4: Sorting on an unindexed virtual column**
Ordering by an unindexed virtual column forces Oracle to evaluate the expression for every row prior to sorting. On large tables this results in costly full scans combined with sort operations. Always review execution plans.

**Mistake 5: Reading a virtual column inside the same table's trigger**
`BEFORE INSERT OR UPDATE` triggers fire before the virtual column value is available. Attempting to read a virtual column inside such a trigger may yield NULL or stale data. Reference the underlying base column expressions directly in trigger logic instead.

---


## Oracle Version Notes (19c vs 26ai)

- The baseline guidance in this file applies to Oracle Database 19c unless a newer minimum version is explicitly stated.
- Features tagged as 21c, 23c, or 23ai can be treated as Oracle Database 26ai-capable; maintain 19c-compatible alternatives for mixed-version environments.
- In dual-support environments, validate syntax and package behavior against both 19c and 26ai, as defaults and deprecations can vary by release update.

## Sources

- [Oracle Database SQL Language Reference: Virtual Columns 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TABLE.html)
- [Oracle Database Administrator's Guide: Managing Tables — Virtual Columns 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-tables.html)
- [Oracle Database VLDB and Partitioning Guide: Partitioning by Virtual Column](https://docs.oracle.com/en/database/oracle/oracle-database/19/vldbg/partition-virtual-column.html)
