# SQLcl Output Formatting

## Overview

SQLcl provides substantially richer output formatting capabilities than SQL*Plus. The `SET SQLFORMAT` command governs the overall output style — ranging from human-readable terminal output to machine-readable CSV, JSON, and XML. Supporting commands such as `COLUMN`, `SET PAGESIZE`, `SET LINESIZE`, `SPOOL`, and `SET WRAP` give granular control over how data is displayed.

The appropriate format depends on the intended use:
- **Interactive work**: `ANSICONSOLE` or `DEFAULT` with suitable line sizes
- **Data export to spreadsheets or ETL tools**: `CSV` or `DELIMITED`
- **API payloads or NoSQL ingestion**: `JSON`
- **Database migration / data loading**: `INSERT` or `LOADER`
- **Legacy fixed-width systems**: `FIXED`

---

## SET SQLFORMAT — Output Format Modes

### DEFAULT

The standard SQL*Plus-style output with column headers and column-aligned data:

```sql
SET SQLFORMAT DEFAULT

SELECT employee_id, first_name, last_name, salary
FROM employees
WHERE department_id = 90;
```

Output:
```
EMPLOYEE_ID FIRST_NAME           LAST_NAME                     SALARY
----------- -------------------- ------------------------- ----------
        100 Steven               King                           24000
        101 Neena                Kochhar                        17000
        102 Lex                  De Haan                        17000

3 rows selected.
```

### ANSICONSOLE

Enhanced terminal output featuring automatic column-width sizing, color highlighting, and improved readability. Recommended for interactive sessions:

```sql
SET SQLFORMAT ANSICONSOLE
```

ANSICONSOLE automatically sizes column widths to match actual data values (not the declared column size), applies color to NULL values and column headers, and renders a styled row-count summary. It is the most readable format for interactive terminal use.

Set it as the default in `login.sql`:

```sql
-- ~/login.sql
SET SQLFORMAT ANSICONSOLE
```

### CSV

Comma-separated values with a header row. This is the most portable format for data exchange:

```sql
SET SQLFORMAT CSV

SELECT employee_id, first_name, last_name, hire_date, salary
FROM employees
WHERE department_id = 90;
```

Output:
```
"EMPLOYEE_ID","FIRST_NAME","LAST_NAME","HIRE_DATE","SALARY"
"100","Steven","King","17-JUN-03","24000"
"101","Neena","Kochhar","21-SEP-05","17000"
"102","Lex","De Haan","13-JAN-01","17000"
```

All values are enclosed in quotes by default. NULL values appear as empty quoted strings `""`.

Control CSV quoting and delimiter behavior:

```sql
-- Change delimiter to pipe
SET SQLFORMAT DELIMITED | " "

-- Custom delimiter (semicolon), custom quote character
SET SQLFORMAT DELIMITED ; '
```

### JSON

Produces a JSON document with a `results` array that contains column metadata and row data:

```sql
SET SQLFORMAT JSON

SELECT employee_id, first_name, salary FROM employees WHERE ROWNUM <= 2;
```

Output:
```json
{"results":[{"columns":[{"name":"EMPLOYEE_ID","type":"NUMBER"},{"name":"FIRST_NAME","type":"VARCHAR2"},{"name":"SALARY","type":"NUMBER"}],"items":[
{"EMPLOYEE_ID":100,"FIRST_NAME":"Steven","SALARY":24000}
,{"EMPLOYEE_ID":101,"FIRST_NAME":"Neena","SALARY":17000}
]}]}
```

For a cleaner JSON structure (data only, without metadata):

```sql
SET SQLFORMAT JSON-FORMATTED
```

This produces pretty-printed JSON:

```json
{
  "results" : [ {
    "columns" : [...],
    "items" : [ {
      "EMPLOYEE_ID" : 100,
      "FIRST_NAME" : "Steven",
      "SALARY" : 24000
    } ]
  } ]
}
```

### XML

Renders query results as an XML document:

```sql
SET SQLFORMAT XML

SELECT employee_id, first_name FROM employees WHERE ROWNUM <= 2;
```

Output:
```xml
<?xml version='1.0' encoding='UTF-8'?>
<results>
  <result>
    <EMPLOYEE_ID>100</EMPLOYEE_ID>
    <FIRST_NAME>Steven</FIRST_NAME>
  </result>
  <result>
    <EMPLOYEE_ID>101</EMPLOYEE_ID>
    <FIRST_NAME>Neena</FIRST_NAME>
  </result>
</results>
```

### INSERT

Generates a SQL INSERT statement for each row. Useful for copying data between schemas or producing seed data scripts:

```sql
SET SQLFORMAT INSERT

SELECT employee_id, first_name, last_name, salary FROM employees WHERE department_id = 90;
```

Output:
```sql
INSERT INTO EMPLOYEES (EMPLOYEE_ID,FIRST_NAME,LAST_NAME,SALARY) VALUES (100,'Steven','King',24000);
INSERT INTO EMPLOYEES (EMPLOYEE_ID,FIRST_NAME,LAST_NAME,SALARY) VALUES (101,'Neena','Kochhar',17000);
INSERT INTO EMPLOYEES (EMPLOYEE_ID,FIRST_NAME,LAST_NAME,SALARY) VALUES (102,'Lex','De Haan',17000);
```

Combine with SPOOL to produce an executable import script:

```sql
SET SQLFORMAT INSERT
SET FEEDBACK OFF
SET HEADING OFF
SPOOL /tmp/seed_employees.sql
SELECT employee_id, first_name, last_name, salary FROM employees WHERE department_id = 90;
SPOOL OFF
SET FEEDBACK ON
SET SQLFORMAT DEFAULT
```

### LOADER

Produces output in SQL*Loader pipe-delimited format, compatible with the `sqlldr` utility:

```sql
SET SQLFORMAT LOADER
SELECT employee_id, first_name, last_name FROM employees WHERE ROWNUM <= 3;
```

Output:
```
100|"Steven"|"King"|
101|"Neena"|"Kochhar"|
102|"Lex"|"De Haan"|
```

### FIXED

Fixed-width output in which each column occupies exactly the width of its declared data type. Useful for legacy mainframe-style integrations:

```sql
SET SQLFORMAT FIXED
SELECT employee_id, first_name FROM employees WHERE ROWNUM <= 2;
```

Output (fixed-width, space-padded):
```
100       Steven
101       Neena
```

### DELIMITED

Custom delimiter and optional enclosing character:

```sql
-- Pipe-delimited, double-quote enclosed
SET SQLFORMAT DELIMITED | "

-- Tab-delimited (use actual tab character or \t in some shells)
SET SQLFORMAT DELIMITED "	"

-- Semicolon-delimited, single-quote enclosed
SET SQLFORMAT DELIMITED ; '
```

---

## COLUMN Command

The `COLUMN` command controls the formatting of individual output columns. It functions across all format modes but is most relevant for `DEFAULT` and `ANSICONSOLE`.

### Basic Column Formatting

```sql
-- Set column display width
COLUMN first_name FORMAT A20

-- Set numeric format mask
COLUMN salary FORMAT $999,999.99

-- Set column heading
COLUMN employee_id HEADING "Emp|ID"      -- | creates multi-line heading

-- Wrap long values
COLUMN job_id FORMAT A10 WRAP

-- Truncate long values
COLUMN description FORMAT A30 TRUNCATE

-- Hide a column (suppress from output but keep in SELECT list for ORDER BY)
COLUMN big_col NOPRINT

-- Clear column formatting
COLUMN first_name CLEAR

-- Show current column settings
COLUMN
COLUMN salary
```

### Common Format Models

```sql
-- Integer
COLUMN count_col FORMAT 9,999,999

-- Currency
COLUMN amount    FORMAT $999,999,999.99

-- Fixed-precision decimal
COLUMN ratio     FORMAT 999.9999

-- Date formatted as string (use TO_CHAR in query or set NLS_DATE_FORMAT)
ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD';
```

### Saving and Restoring Column Settings

Column settings remain active for the duration of the session unless explicitly cleared. Save them to a file to reuse across sessions:

```sql
-- Defined in a startup or report script
COLUMN employee_id  HEADING "ID"        FORMAT 99999
COLUMN first_name   HEADING "First"     FORMAT A15
COLUMN last_name    HEADING "Last"      FORMAT A20
COLUMN salary       HEADING "Salary"    FORMAT $999,999.99
COLUMN hire_date    HEADING "Hired"     FORMAT A12
```

---

## SET PAGESIZE and LINESIZE

### PAGESIZE

Specifies how many lines are printed per page. Column headers are reprinted at the start of each new page:

```sql
SET PAGESIZE 50         -- Print headers every 50 lines
SET PAGESIZE 0          -- No pagination, no header repetition (also hides initial header)
SET PAGESIZE 50000      -- Effectively unlimited, headers printed once at top
```

For data exports, combine `SET PAGESIZE 0` with `SET HEADING OFF` to suppress all headers.
For readable reports, use `SET PAGESIZE 50` or `SET PAGESIZE 100`.

### LINESIZE

Sets the maximum width of each output line:

```sql
SET LINESIZE 80         -- Default (too narrow for modern screens)
SET LINESIZE 200        -- Better for wide tables
SET LINESIZE 32767      -- Maximum; effectively disables wrapping
```

For terminal output, align LINESIZE with your terminal width:

```sql
-- Auto-detect terminal width
SET LINESIZE WINDOW
```

### WRAP

Determines behavior when output exceeds LINESIZE:

```sql
SET WRAP ON             -- Wrap to next line (default)
SET WRAP OFF            -- Truncate to LINESIZE
```

---

## SPOOL — Capturing Output to File

### Basic Spooling

```sql
SPOOL /path/to/output.txt
-- Run your queries here
SELECT * FROM employees;
SPOOL OFF
```

`SPOOL OFF` closes and flushes the file. `SPOOL OUT` directs output to the system's default print command (Unix: `lp`).

### Append Mode

```sql
SPOOL /path/to/output.txt APPEND
-- Appends to existing file rather than overwriting
SELECT * FROM new_data;
SPOOL OFF
```

### Create Mode

```sql
SPOOL /path/to/output.txt CREATE
-- Fails if file already exists (prevents accidental overwrites)
```

### Data Export Pattern

Full pattern for a clean data export:

```sql
SET SQLFORMAT CSV
SET FEEDBACK OFF
SET HEADING ON
SET ECHO OFF
SET PAGESIZE 0
SET LINESIZE 32767
SET TRIMSPOOL ON        -- Remove trailing spaces from spooled lines
SPOOL /tmp/employees_export.csv
SELECT employee_id, first_name, last_name, email, hire_date, salary, department_id
FROM employees
ORDER BY employee_id;
SPOOL OFF
SET FEEDBACK ON
SET SQLFORMAT DEFAULT
```

### Multiple Reports in One Session

```sql
-- Report 1: Headcount by department
SET SQLFORMAT DEFAULT
SPOOL /tmp/headcount_report.txt
SELECT d.department_name, COUNT(e.employee_id) AS headcount
FROM departments d LEFT JOIN employees e ON d.department_id = e.department_id
GROUP BY d.department_name
ORDER BY headcount DESC;
SPOOL OFF

-- Report 2: High earners CSV
SET SQLFORMAT CSV
SPOOL /tmp/high_earners.csv
SELECT employee_id, first_name, last_name, salary
FROM employees WHERE salary > 15000
ORDER BY salary DESC;
SPOOL OFF
SET SQLFORMAT DEFAULT
```

---

## Output Encoding

SQLcl uses the JVM's default charset for file output. For UTF-8 output (recommended when working with international data):

```shell
# Set JVM charset before starting SQLcl
export JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8"
sql username/password@service
```

Alternatively, configure this in SQLcl's Java options file (`sqlcl.conf` or through the wrapper script).

---

## NULL Value Display

Configure how NULL values appear in output:

```sql
SET NULL "[NULL]"       -- Display as [NULL]
SET NULL "N/A"          -- Display as N/A
SET NULL ""             -- Display as empty (default)
```

In CSV and JSON formats, NULLs follow format-specific conventions (an empty field in CSV, `null` in JSON).

---

## Formatting for Downstream Consumption

### ETL / Data Pipeline Pattern

```sql
-- Suppress all noise, output clean CSV
SET SQLFORMAT CSV
SET FEEDBACK OFF
SET ECHO OFF
SET VERIFY OFF
SET HEADING ON
SET PAGESIZE 0
SET TRIMSPOOL ON

SPOOL /data/staging/employees.csv
SELECT
    employee_id,
    first_name,
    last_name,
    TO_CHAR(hire_date, 'YYYY-MM-DD') AS hire_date,
    salary,
    department_id
FROM employees;
SPOOL OFF
```

### Reporting / Human-readable Pattern

```sql
-- Formatted report with title and totals
SET SQLFORMAT DEFAULT
SET LINESIZE 120
SET PAGESIZE 60
SET FEEDBACK ON
SET HEADING ON
TTITLE CENTER "Employee Compensation Report" SKIP 1 CENTER "Fiscal Year 2025"
BTITLE CENTER "Confidential - Internal Use Only"

COLUMN first_name   HEADING "First Name"    FORMAT A15
COLUMN last_name    HEADING "Last Name"     FORMAT A20
COLUMN department   HEADING "Department"    FORMAT A25
COLUMN salary       HEADING "Salary"        FORMAT $999,999.99
COLUMN commission   HEADING "Commission"    FORMAT $99,999.99 NULL "None"

BREAK ON department SKIP 1
COMPUTE SUM OF salary ON department

SPOOL /tmp/comp_report.txt
SELECT d.department_name AS department,
       e.first_name,
       e.last_name,
       e.salary,
       e.commission_pct * e.salary AS commission
FROM employees e
JOIN departments d ON e.department_id = d.department_id
ORDER BY d.department_name, e.last_name;
SPOOL OFF

-- Reset title and break settings
TTITLE OFF
BTITLE OFF
CLEAR BREAKS
CLEAR COMPUTES
```

### JSON for API/REST Pattern

```sql
SET SQLFORMAT JSON-FORMATTED
SET FEEDBACK OFF
SET HEADING OFF
SET ECHO OFF

SPOOL /tmp/api_payload.json
SELECT employee_id, first_name, last_name, email, job_id, salary
FROM employees
WHERE department_id = &dept_id;
SPOOL OFF
```

---

## Tips for Readable Terminal Output

- Use `SET SQLFORMAT ANSICONSOLE` as your default interactive format — it sizes columns to fit actual data values rather than the declared type width, substantially reducing wasted whitespace.
- Set `SET LINESIZE WINDOW` so the line width tracks your terminal automatically.
- Enable `SET TIMING ON` during interactive work to display query execution time after each statement.
- For wide tables, combine `SET WRAP OFF` with `SET LINESIZE 300` to keep each row on a single line and scroll horizontally.
- Apply `COLUMN ... FORMAT A30 TRUNCATE` to very long text columns that are not the primary focus of your query.
- Use `CLEAR COLUMNS` to reset all `COLUMN` formatting in one step, which is helpful when transitioning between reports.

---

## Best Practices

- Always enable `SET TRIMSPOOL ON` when spooling to files. Without it, output lines are padded to LINESIZE with spaces, resulting in bloated and poorly formatted files.
- Align LINESIZE with your terminal width for interactive use. 80 characters is too narrow for most modern content; 200 is a safe general-purpose value.
- For automated exports, explicitly declare every relevant format variable at the top of the script rather than depending on session defaults. Other users or CI/CD runners may have a different `login.sql`.
- Apply `TO_CHAR(date_col, 'YYYY-MM-DD')` to date columns in CSV exports. The default Oracle date format (`17-JUN-03`) is not ISO 8601 and may be rejected by downstream parsers.
- Verify SPOOL output in a temporary location before writing to the final destination to confirm encoding, delimiters, and quoting are correct.

---

## Common Mistakes and How to Avoid Them

**Mistake: Feedback rows appearing in CSV output**
`3 rows selected.` will be appended to your CSV file. Always set `SET FEEDBACK OFF` before spooling CSV data.

**Mistake: Column headers wrapped across multiple lines**
When LINESIZE is narrower than the total column width, headers wrap onto additional lines. Increase LINESIZE or use shorter column aliases in your query.

**Mistake: Numbers formatted as scientific notation**
Very large or very small numbers may render as `1.23E+10`. Correct this with `SET NUMFORMAT 999999999999` or apply `COLUMN col_name FORMAT 99999999999`.

**Mistake: Date columns in wrong format for downstream tools**
Always apply `TO_CHAR(col, 'YYYY-MM-DD')` or execute `ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'` before exporting date data.

**Mistake: SPOOL file with ANSICONSOLE ANSI escape codes**
If `SQLFORMAT ANSICONSOLE` is set in `login.sql` and you forget to switch to `DEFAULT` before spooling, the output file will contain ANSI color escape sequences. Always switch to `DEFAULT` or `CSV` before issuing `SPOOL`.

**Mistake: `SET PAGESIZE 0` removing the header from CSV output**
In `DEFAULT` format, `PAGESIZE 0` suppresses headers. In `CSV` format, the header row is governed by `SET HEADING`. Use `SET HEADING ON` together with `SET PAGESIZE 0` for a headered CSV file without page breaks.

---

## Sources

- [Oracle SQLcl 25.2 User's Guide](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.2/sqcug/oracle-sqlcl-users-guide.pdf)
- [SQLcl: Format Query Results with SET SQLFORMAT — ORACLE-BASE](https://oracle-base.com/articles/misc/sqlcl-format-query-results-with-the-set-sqlformat-command)
- [SQLcl Formatting Options — oracle-db-tools GitHub](https://github.com/oracle/oracle-db-tools/blob/master/sqlcl/FORMATTING.md)
- [Working with Oracle SQLcl (19.4 reference for SQLFORMAT values)](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/19.4/sqcug/working-sqlcl.html)
