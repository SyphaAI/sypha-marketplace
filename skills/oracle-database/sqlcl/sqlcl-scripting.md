# SQLcl Scripting with JavaScript

## Overview

SQLcl provides a built-in JavaScript scripting environment that allows you to blend JavaScript logic with SQL execution. This enables you to build full automation workflows directly inside SQLcl: loop over query results, transform data, write files, invoke Java classes, and coordinate multi-step database operations from a single script.

The behavior of the JavaScript engine varies based on the SQLcl distribution and the Java runtime present in your environment. For broadest compatibility, stick to conservative JavaScript syntax unless you have confirmed that newer language features work on the specific SQLcl/JDK combination you are targeting.

---

## The `script` Command

The `script` command serves as the entry point for running JavaScript within SQLcl. It operates in two modes:

### Inline Script (Interactive)

```sql
script
var result = util.executeQuery("SELECT SYSDATE FROM DUAL");
print(result);
/
```

The block ends with a line that contains only `/`.

### Script File

```sql
script /path/to/myscript.js
```

Or from the command line:

```shell
sql username/password@service @script.sql
```

Where `script.sql` contains:

```sql
script /path/to/myscript.js
exit
```

---

## The `ctx` Object and Implicit Globals

SQLcl makes several global objects available inside the JavaScript engine:

| Object | Description |
|---|---|
| `ctx` | The SQLcl context object (primary API) |
| `util` | Utility functions for query execution and output |
| `args` | Array of command-line arguments passed to the script |
| `print()` | Write a line to standard output |
| `sqlcl` | Alias for `ctx` in some versions |

The `ctx` object is the primary interface. Key methods include:

```javascript
ctx.write("text\n");                    // Write to output (no newline added)
ctx.getOutputStream();                  // Get raw output stream
ctx.getProperty("sqlcl.version");       // Read SQLcl internal properties
```

The `util` object offers the functions you will use most frequently:

```javascript
util.execute("SQL statement");           // Execute DML/DDL, returns void
util.executeQuery("SELECT ...");         // Execute query, returns ResultSet-like object
util.executeReturnListofList("SELECT ...");  // Returns array of arrays
util.executeReturnList("SELECT ...");    // Returns array of row objects
util.print("line\n");                    // Print to output
util.getConnection();                    // Get the underlying JDBC connection
```

---

## Running SQL from JavaScript

### Execute DML or DDL

```javascript
// Execute any statement that does not return rows
util.execute("CREATE TABLE temp_log (id NUMBER, msg VARCHAR2(200))");
util.execute("INSERT INTO temp_log VALUES (1, 'Test message')");
util.execute("COMMIT");
util.execute("DROP TABLE temp_log PURGE");
```

### Execute a Query and Iterate Results

The most widely used pattern relies on `executeReturnListofList`, which gives back a 2D JavaScript array:

```javascript
var rows = util.executeReturnListofList("SELECT table_name, num_rows FROM user_tables ORDER BY 1");

// Row 0 is the column headers
var headers = rows[0];
print(headers.join("\t"));

// Rows 1+ are data
for (var i = 1; i < rows.length; i++) {
    print(rows[i].join("\t"));
}
```

### Execute a Query as Named Objects

`executeReturnList` produces an array of objects whose properties correspond to column names:

```javascript
var rows = util.executeReturnList("SELECT employee_id, first_name, last_name, salary FROM employees WHERE department_id = 90");

for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    print("Employee: " + row.FIRST_NAME + " " + row.LAST_NAME + " | Salary: " + row.SALARY);
}
```

Note: Column names in the returned objects are always uppercase.

### Bind Variables in Queries

Supply JDBC-style `?` placeholders together with an array of bind values:

```javascript
var deptId = 50;
var rows = util.executeReturnListofList(
    "SELECT employee_id, first_name FROM employees WHERE department_id = ?",
    [deptId]
);
for (var i = 1; i < rows.length; i++) {
    print(rows[i][0] + " - " + rows[i][1]);
}
```

---

## Accessing Java Classes from JavaScript

The SQLcl scripting environment lets you instantiate Java classes directly from JavaScript:

```javascript
// Import Java classes
var File       = Java.type("java.io.File");
var FileWriter = Java.type("java.io.FileWriter");
var ArrayList  = Java.type("java.util.ArrayList");

// Check if a file exists
var f = new File("/tmp/myfile.txt");
print("Exists: " + f.exists());

// Read a file line by line
var BufferedReader = Java.type("java.io.BufferedReader");
var FileReader     = Java.type("java.io.FileReader");
var br = new BufferedReader(new FileReader("/tmp/input.csv"));
var line;
while ((line = br.readLine()) != null) {
    print(line);
}
br.close();
```

---

## Reading and Writing Files

### Writing a File

```javascript
var FileWriter     = Java.type("java.io.FileWriter");
var BufferedWriter = Java.type("java.io.BufferedWriter");

var outputPath = "/tmp/schema_report.txt";
var bw = new BufferedWriter(new FileWriter(outputPath));

var rows = util.executeReturnListofList("SELECT object_type, object_name, status FROM user_objects ORDER BY 1, 2");

for (var i = 1; i < rows.length; i++) {
    bw.write(rows[i].join(",") + "\n");
}

bw.flush();
bw.close();
print("Report written to: " + outputPath);
```

### Reading a File

```javascript
var Files   = Java.type("java.nio.file.Files");
var Paths   = Java.type("java.nio.file.Paths");

var content = new java.lang.String(Files.readAllBytes(Paths.get("/tmp/input.sql")));
print(content);
```

### Appending to a File

```javascript
var FileWriter     = Java.type("java.io.FileWriter");
var BufferedWriter = Java.type("java.io.BufferedWriter");

// Second argument `true` enables append mode
var bw = new BufferedWriter(new FileWriter("/tmp/audit.log", true));
bw.write(new java.util.Date() + " - Operation completed\n");
bw.close();
```

---

## Practical Automation Examples

### Schema Object Inventory Report

```javascript
// schema_inventory.js
// Produces a CSV report of all user objects with status and size info

var FileWriter     = Java.type("java.io.FileWriter");
var BufferedWriter = Java.type("java.io.BufferedWriter");
var bw = new BufferedWriter(new FileWriter("/tmp/schema_inventory.csv"));

// Header
bw.write("OBJECT_TYPE,OBJECT_NAME,STATUS,LAST_DDL_TIME\n");

var sql = "SELECT object_type, object_name, status, " +
          "TO_CHAR(last_ddl_time,'YYYY-MM-DD HH24:MI:SS') AS last_ddl " +
          "FROM user_objects " +
          "ORDER BY object_type, object_name";

var rows = util.executeReturnListofList(sql);

for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    bw.write(r[0] + "," + r[1] + "," + r[2] + "," + (r[3] || "") + "\n");
}

bw.flush();
bw.close();
print("Schema inventory written to /tmp/schema_inventory.csv");
print("Total objects: " + (rows.length - 1));
```

### Data Export to JSON

```javascript
// export_to_json.js
// Export a table to a JSON file

var table  = "EMPLOYEES";
var output = "/tmp/employees.json";

var rows = util.executeReturnList("SELECT * FROM " + table);
var FileWriter     = Java.type("java.io.FileWriter");
var BufferedWriter = Java.type("java.io.BufferedWriter");
var bw = new BufferedWriter(new FileWriter(output));

bw.write("[\n");

for (var i = 0; i < rows.length; i++) {
    var row   = rows[i];
    var keys  = Object.keys(row);
    var parts = [];

    for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var val = row[key];
        if (val === null || val === undefined) {
            parts.push('"' + key + '": null');
        } else if (typeof val === "number") {
            parts.push('"' + key + '": ' + val);
        } else {
            // Escape quotes in string values
            var escaped = String(val).replace(/"/g, '\\"');
            parts.push('"' + key + '": "' + escaped + '"');
        }
    }

    var comma = (i < rows.length - 1) ? "," : "";
    bw.write("  {" + parts.join(", ") + "}" + comma + "\n");
}

bw.write("]\n");
bw.flush();
bw.close();
print("Exported " + rows.length + " rows to " + output);
```

### Batch Update with Progress Reporting

```javascript
// batch_update.js
// Process rows in batches and report progress

var batchSize = 1000;
var processed = 0;
var errors    = 0;

// Get IDs to process
var ids = util.executeReturnListofList(
    "SELECT id FROM orders WHERE status = 'PENDING' AND ROWNUM <= 10000"
);

print("Processing " + (ids.length - 1) + " rows...");

for (var i = 1; i < ids.length; i++) {
    try {
        util.execute("UPDATE orders SET status = 'PROCESSING', updated_dt = SYSDATE WHERE id = " + ids[i][0]);
        processed++;

        if (processed % batchSize === 0) {
            util.execute("COMMIT");
            print("Committed batch: " + processed + " rows processed");
        }
    } catch (e) {
        errors++;
        print("ERROR on row " + ids[i][0] + ": " + e.message);
    }
}

// Final commit
util.execute("COMMIT");
print("Done. Processed: " + processed + " | Errors: " + errors);
```

### Dynamic DDL Generation

```javascript
// gen_ddl.js
// Generate CREATE TABLE DDL for all tables with a specific prefix

var prefix = args.length > 0 ? args[0] : "APP_";
var outFile = "/tmp/ddl_" + prefix + ".sql";

var FileWriter     = Java.type("java.io.FileWriter");
var BufferedWriter = Java.type("java.io.BufferedWriter");
var bw = new BufferedWriter(new FileWriter(outFile));

var tables = util.executeReturnListofList(
    "SELECT table_name FROM user_tables WHERE table_name LIKE '" + prefix + "%' ORDER BY 1"
);

for (var i = 1; i < tables.length; i++) {
    var tname = tables[i][0];
    // Use the SQLcl DDL command by executing it through the context
    var ddlRows = util.executeReturnListofList("SELECT DBMS_METADATA.GET_DDL('TABLE', '" + tname + "') AS ddl FROM DUAL");
    if (ddlRows.length > 1) {
        bw.write("-- Table: " + tname + "\n");
        bw.write(ddlRows[1][0] + "\n/\n\n");
    }
}

bw.flush();
bw.close();
print("DDL written to " + outFile);
```

### Email-style HTML Report

```javascript
// html_report.js
// Generate an HTML summary of database health metrics

var outFile = "/tmp/db_health.html";
var FileWriter     = Java.type("java.io.FileWriter");
var BufferedWriter = Java.type("java.io.BufferedWriter");
var bw = new BufferedWriter(new FileWriter(outFile));

function writeRow(bw, cells) {
    bw.write("  <tr>");
    for (var i = 0; i < cells.length; i++) {
        bw.write("<td>" + (cells[i] !== null ? cells[i] : "NULL") + "</td>");
    }
    bw.write("</tr>\n");
}

bw.write("<html><body><h1>Database Health Report</h1>\n");
bw.write("<p>Generated: " + new java.util.Date() + "</p>\n");

// Invalid objects
bw.write("<h2>Invalid Objects</h2>\n");
bw.write("<table border='1'><tr><th>Type</th><th>Name</th><th>Status</th></tr>\n");
var invalid = util.executeReturnListofList(
    "SELECT object_type, object_name, status FROM user_objects WHERE status != 'VALID' ORDER BY 1, 2"
);
if (invalid.length <= 1) {
    bw.write("  <tr><td colspan='3'>No invalid objects</td></tr>\n");
} else {
    for (var i = 1; i < invalid.length; i++) {
        writeRow(bw, invalid[i]);
    }
}
bw.write("</table>\n");

bw.write("</body></html>\n");
bw.flush();
bw.close();
print("Report written to " + outFile);
```

---

## Calling Scripts from the Command Line

### Passing a Script via SQL Wrapper File

Create `run_script.sql`:

```sql
script /path/to/myscript.js
exit
```

Then run:

```shell
sql username/password@service @run_script.sql
```

### Passing Arguments to JavaScript

Arguments provided after the script file name are accessible through the `args` array:

```sql
-- run_export.sql
script /path/to/export.js
exit
```

```shell
sql username/password@service @run_export.sql
```

To feed arguments into the JS script, define them as SQL substitution variables and reference `&1` etc. within the JS:

```javascript
// In JS, read a substitution variable set by SQL
var tableName = "EMPLOYEES"; // hard-coded or read from args
```

A cleaner alternative is to define `DEFINE` variables before invoking the script:

```sql
-- caller.sql
DEFINE TABLE_NAME = EMPLOYEES
DEFINE OUTPUT_DIR = /tmp
script /path/to/export.js
exit
```

Then in JavaScript:

```javascript
// These come through because SQLcl performs substitution before passing to JS
// Or use ctx to get defined variables
```

---

## Best Practices

- Always close file handles (`bw.close()` / `br.close()`) within the script. JavaScript in SQLcl has no automatic resource management equivalent to Java's try-with-resources, so leaving handles open can leak resources.
- Choose `util.executeReturnListofList` when you need to process column headers together with row data. Choose `util.executeReturnList` when you prefer named field access and do not need the header row.
- Keep business logic in JavaScript and data access in SQL. Avoid assembling complex SQL strings via string concatenation; use parameterized queries with `?` bind variables to guard against SQL injection.
- For long-running scripts, commit in batches (every 500–1000 rows) to prevent large undo segments and minimize lock contention.
- In batch scripts, wrap individual row operations in try/catch blocks so that a single failure does not abort the entire run.
- Verify scripts interactively against a small number of rows before executing against full production datasets. Use `WHERE ROWNUM <= 10` during development.
- Favor conservative JavaScript syntax when scripts must run across multiple SQLcl environments. If newer language features are required, confirm they work on the exact SQLcl and Java runtime combination used in production.

---

## Common Mistakes and How to Avoid Them

**Mistake: Accessing column names in lowercase**
`executeReturnList` returns objects with UPPERCASE column names. `row.first_name` evaluates to `undefined`; use `row.FIRST_NAME` instead.

**Mistake: Omitting the `/` terminator after an inline script block**
An inline `script` block must be closed with a `/` on a line by itself. Leaving it out causes SQLcl to hang waiting for additional input.

**Mistake: Assigning `util.execute(...)` to a variable and inspecting the return value**
`util.execute()` returns void for DML/DDL statements. Use `util.executeReturnListofList` or `util.executeReturnList` whenever you need result data.

**Mistake: Ignoring NULL values in result sets**
NULL columns in query results are returned as JavaScript `null`. Concatenating null into a string produces the literal `"null"`. Always check `if (val !== null)` before working with values.

**Mistake: Loading large result sets into memory**
Both `executeReturnListofList` and `executeReturnList` pull the complete result set into a JavaScript array. For tables with millions of rows, this will exhaust memory. Process data in batches using `WHERE ROWNUM <= N` or use cursor-based approaches through the raw JDBC connection.

**Mistake: Assuming a uniform JavaScript engine version**
Not every SQLcl environment exposes the same JavaScript feature set. When a script depends on newer syntax, validate it against the specific SQLcl and Java runtime combination used in the target environment.

---

## Sources

- [Oracle oracle-db-tools SQLcl Scripting Guide (GitHub)](https://github.com/oracle/oracle-db-tools/blob/master/sqlcl/SCRIPTING.md)
- [How to run JavaScript in Oracle SQLcl with Java 17 — ThatJeffSmith](https://www.thatjeffsmith.com/archive/2022/04/running-javascript-in-oracle-sqlcl-22-1/)
- [Oracle SQLcl 25.2 User's Guide](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.2/sqcug/oracle-sqlcl-users-guide.pdf)
- [SQLcl Release Notes 25.2.1 — Java 17/21 requirement](https://www.oracle.com/tools/sqlcl/sqlcl-relnotes-25.2.1.html)
