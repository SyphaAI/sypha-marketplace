# Multilingual Engine JavaScript in the Database

## Overview

Oracle AI Database Multilingual Engine (MLE) enables you to store and execute JavaScript directly inside the database. Per the Oracle AI Database JavaScript Developer's Guide for 26ai, MLE supports JavaScript for:

- Stored procedures
- Stored functions (UDF)
- Code within a PL/SQL package namespace
- Anonymous, dynamic code snippets run through `DBMS_MLE`

MLE JavaScript is available when connecting via a dedicated server connection on Linux x86-64 or Linux for Arm (aarch64), including dedicated connections that leverage Database Resident Connection Pooling (DRCP). Shared server connections are not compatible with MLE.

The JavaScript implementation conforms to ECMAScript 2023. The runtime requires Linux x86-64 or Linux aarch64; MLE is unavailable on other platforms. Dynamic MLE execution via `dbms_mle` is available in Oracle Database 21c on Linux x86-64. Oracle 19c and earlier releases do not include MLE.

TypeScript can also be used alongside JavaScript in the database. TypeScript source must be transpiled to JavaScript before it can be loaded. TypeScript type declarations for MLE are published on [GitHub](https://github.com/oracle-samples/mle-modules)

MLE/JavaScript is a "pure" JavaScript implementation of the ECMAScript 2023 standard. Node-specific modules and most browser APIs are unavailable. <https://oracle-samples.github.io/mle-modules/> lists the available built-in modules. TypeScript is not directly supported; a transpilation step is always necessary.

---

## Core Building Blocks

### MLE Modules

Use `CREATE MLE MODULE` to store JavaScript source code as a persistent schema object.

```sql
CREATE OR REPLACE MLE MODULE hello_world_module
LANGUAGE JAVASCRIPT AS

    export function greet(str){
        console.log(`Hello, ${str}`);
    }
/
```

Key points from the docs:

- Module names must be unique within the schema.
- ECMAScript syntax is required.
- MLE objects share namespace rules with tables, views, sequences, private synonyms, PL/SQL packages, functions, procedures, and cache groups.
- `CREATE OR REPLACE MLE MODULE` retains previously granted privileges.
- `IF NOT EXISTS` is supported and is mutually exclusive with `OR REPLACE`.
- If the JavaScript source contains syntax errors, the module is still created but exists in an invalid state.
- Modules are expected to be UTF-8 encoded
- When creating MLE modules, you should author JavaScript files to ease integration with existing toolchains. JavaScript files can be loaded into the database using SQLcl's `mle create-module` command. This is the recommended approach to avoid encoding issues and work around size limitations.
- JavaScript code should be stored either as a `.js` or `.ts` file
- Modules are incompatible with Edition Based Redefinition. When multiple editions are needed, a PL/SQL call specification must be created for each new edition
- Modules can be developed in-house or downloaded from third-party repositories
- Third-party module dependencies are best resolved using bundlers such as esbuild, rollup, etc.

### MLE Environments

Use `CREATE MLE ENV` to configure import mappings and JavaScript language options.

```sql
CREATE OR REPLACE MLE ENV po_env
IMPORTS (
    'po_module' MODULE PO_MODULE
);
```

Environment basics:

- Environments are schema objects stored in the data dictionary.
- `CREATE MLE ENV IF NOT EXISTS myEnv;` is supported.
- `CREATE MLE ENV MyEnvDuplicate CLONE MyEnv` produces a point-in-time copy.
- Import mappings must not conflict with built-in module names such as `mle-js-oracledb`, `mle-js-bindings`, `mle-js-plsqltypes`, `mle-js-fetch`, `mle-encode-base64`, `mle-js-encodings`, and `mle-js-plsql-ffi`.
- `CREATE MLE ENV` fails if an imported module does not exist or is inaccessible.

### Call Specifications

Use PL/SQL `CREATE FUNCTION ... AS MLE MODULE ...` or `CREATE PROCEDURE ... AS MLE MODULE ...` to expose JavaScript exports to SQL and PL/SQL.

```sql
CREATE OR REPLACE PROCEDURE
    GREET(str in VARCHAR2)
    AS MLE MODULE jsmodule
    SIGNATURE 'greet(string)';
/

CREATE OR REPLACE FUNCTION CONCATENATE(str1 in VARCHAR2, str2 in VARCHAR2)
    RETURN VARCHAR2
    AS MLE MODULE jsmodule
    SIGNATURE 'concat(string, string)';
/
```

Important behavior:

- The `MLE MODULE` clause requires the module to reside in the same schema as the call specification.
- The optional `ENV` clause selects an environment; when omitted, the default environment is used.
- The `SIGNATURE` clause maps the PL/SQL entry point to the exported JavaScript function.
- The `SIGNATURE` clause may omit parameter types, falling back to default PL/SQL-to-MLE type mappings.
- `AUTHID CURRENT_USER` and `AUTHID DEFINER` behave identically to those clauses on PL/SQL units.
- `AUTHID` defaults to definer's rights when not specified.

### Inline JavaScript functions and procedures

Inline MLE call specifications embed JavaScript code directly within `CREATE FUNCTION` and `CREATE PROCEDURE` DDL statements, letting you define the JavaScript logic inside the database object rather than deploying a separate module. They suit simple, one-off functionality, whereas module-based call specifications are preferable for larger or reusable code.

```sql
CREATE OR REPLACE FUNCTION date_to_epoch (
  "theDate" TIMESTAMP WITH TIME ZONE
)
RETURN NUMBER
AS MLE LANGUAGE JAVASCRIPT
{{
  const d = new Date(theDate);

  //check if the input parameter turns out to be an invalid date
  if (isNaN(d)){
    throw new Error(`${theDate} is not a valid date`);
  }

  //Date.prototype.getTime() returns the number of milliseconds
  //for a given date since epoch, which is defined as midnight
  //on January 1, 1970, UTC
  return d.getTime();
}};
/
```

Important behavior:

- Use `MLE LANGUAGE JAVASCRIPT` to designate the function or procedure as JavaScript, and wrap the JavaScript body in paired delimiters such as `{{ ... }}`. The delimiters must match and may not be reserved words or a dot.
- Use `MLE LANGUAGE JAVASCRIPT PURE` to disable database access
- PL/SQL arguments are automatically converted to JavaScript types and passed into the JavaScript body. Parameter names are mapped to JavaScript names, and unquoted names become uppercase.
- For functions, the JavaScript return value is converted back to the PL/SQL return type. Procedures have no return value.
- Syntax is validated at compile time. If the JavaScript contains errors, the object can still be created but remains invalid until corrected.
- Inline call specs support `OR REPLACE`, `IF NOT EXISTS`, schema qualification, parameter declarations, `AUTHID`, and `PURE`. `DETERMINISTIC` applies only to functions.
- Inline call specs cannot import MLE modules, whether built-in or custom. Instead, they rely on prepopulated JavaScript global variables to access built-in module functionality.

When to use inline vs. module-based call specs

Inline call specs are the faster option for a single JavaScript function or procedure with minimal setup. Module-based call specs offer greater flexibility when imports, code reuse, or more complex logic are required. Every variable defined in global scope is accessible within inline functions/procedures. External modules are not.

### Handling of PL/SQL OUT and IN OUT Parameters in MLE/JavaScript

Oracle MLE JavaScript functions support `OUT` and `IN OUT` parameters, similar to PL/SQL call specifications. In JavaScript, these parameters are passed as wrapper objects, so the function must read and modify the underlying value through the `value` property rather than through pass-by-reference directly. The call specification uses `InOut<T>` or `Out<T>` in the `SIGNATURE`, and `DBMS_MLE` does not use these wrappers.

---

## Dynamic JavaScript Execution with `DBMS_MLE`

Dynamic execution is an alternative to storing code in MLE modules. Oracle documents that JavaScript code can be supplied inline as `VARCHAR2` or as `CLOB` for larger snippets, then executed via the `DBMS_MLE` PL/SQL package.

```sql
SET SERVEROUTPUT ON;
DECLARE
    l_ctx     dbms_mle.context_handle_t;
    l_snippet CLOB;
BEGIN
    l_ctx := dbms_mle.create_context(environment => 'PURE_ENV');
    l_snippet := q'~
        console.log('Hello World, this is dynamic MLE execution');
    ~';
    dbms_mle.eval(l_ctx, 'JAVASCRIPT', l_snippet);
    dbms_mle.drop_context(l_ctx);
EXCEPTION
    WHEN OTHERS THEN
        dbms_mle.drop_context(l_ctx);
        RAISE;
END;
/
```

Documented characteristics:

- `DBMS_MLE` facilitates data exchange between PL/SQL and JavaScript.
- JavaScript can invoke PL/SQL through built-in JavaScript modules.
- Dynamic execution intermixes PL/SQL setup with JavaScript runtime execution.
- `EXECUTE DYNAMIC MLE` must be granted before a user can call `DBMS_MLE`.
- Applications should avoid using `DBMS_MLE` directly; modules/environments and inline call specs are preferred
- Use DBMS_MLE to let a developer test a snippet

---

## Using the MLE JavaScript SQL Driver

The built-in `mle-js-oracledb` driver is modeled after `node-oracledb`, but Oracle documents several notable differences. The module does not need to be imported because the `session` object, which enables database interaction, is available in global scope. This session variable is equivalent to node-oracledb's `const result = connection.execute()` construct. Because all MLE/JavaScript code executes inside the database, there is no need to establish a connection as you would in node-oracledb.

```sql
create or replace mle module purchase_order_module
language javascript as

/**
 * A simple function accepting a purchase Order (as per chapter 4 in the Oracle Database
 * JSON Developer's Guide) and checking whether its value is high enough to merit the
 * addition of a free item
 *
 * @param {object} po the purchase order to be checked
 * @param {object} freeItem which item to add to the order free of charge
 * @param {number} threshold the minimum order value before a free item can be added
 * @param {boolean} a flag indicating whether the free item was successfully added
 * @returns {object} the potentially updated purchaseOrder
 * @throws exceptions in case
 *         - any of the mandatory parameters is null
 *         - in the absence of line items
 *         - if the free item has already been added to the order
 */
export function addFreeItem(po, freeItem, threshold, itemAdded) {

    // sanity checking
    if (po == null || freeItem == null || threshold == null) {
        throw new Error(`mandatory parameter either not provided or null`);
    }

    // ensure there are line items provided by the purchase order
    if (po.LineItems === undefined) {
        throw new Error(`PO number ${po.PONumber} does not contain any line items`);
    }

    // bail out if the free Item has already been added to the purchase order
    if (po.LineItems.find(({ Part }) => Part.Description === freeItem.Part.Description)) {
        throw new Error(`${freeItem.Part.Description} has already been added to order ${po.PONumber}`);
    }

    // In, Out, and InOut Parameters are implemented using special interfaces, see
    // https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/and-parameters.html
    itemAdded.value = false;

    // get the total order value
    const poValue = po.LineItems
        .map(x => x.Part.UnitPrice * x.Quantity)
        .reduce(
            (accumulator, currentValue) => accumulator + currentValue, 0
        );

    // add a free item to the purchase order if its value
    // exceeds the threshold
    if ( poValue > threshold ) {

        // update the ItemNumber
        freeItem.ItemNumber = (po.LineItems.length + 1)
        po.LineItems.push(freeItem);
        itemAdded.value = true;
    }

    return po;
}
/
```

The guide also documents globally available symbols for MLE JavaScript SQL driver code:

- `oracledb`
- `session`
- `soda`
- `plsffi`
- `OracleNumber`
- `OracleClob`
- `OracleBlob`
- `OracleTimestamp`
- `OracleTimestampTZ`
- `OracleDate`
- `OracleIntervalDayToSecond`
- `OracleIntervalYearToMonth`

Key differences from `node-oracledb`:

- The API is synchronous by default.
- A promise-based interface is not provided.
- Use `oracledb.defaultConnection()` to retrieve the current session connection.
- `oracledb.createConnection`, connection pools, and `connection.close()` are not supported.
- `connection.execute()`, `connection.executeMany()`, `connection.commit()`, and `connection.rollback()` return results or throw exceptions rather than using callbacks or promises.
- The auto-commit feature is not implemented; if specified on `connection.execute()`, the parameter is silently ignored.

Unsupported SQL driver data types documented by Oracle:

- `LONG`
- `LONG RAW`
- `XMLType`
- `BFILE`
- `REF CURSOR`

Additional documented features not available in the MLE JavaScript SQL driver:

- `connection.break`
- `connection.createLob`
- `property oracledb.lobPrefetchSize`
- `constant oracledb.BLOB`
- `constant oracledb.CLOB`
- `connection.queryStream()`
- `resultSet.toQueryStream()`
- Continuous Query Notification (CQN)
- `Connection.subscribe()`
- `Connection.unsubscribe()`
- All Continuous Query Notification constants in the `oracledb` class
- All Subscription constants in the `oracledb` class

---

## Working with SODA Collections in MLE JavaScript

Oracle documents SODA for MLE JavaScript as the in-database document API for create, read, update, and delete operations on collections. When using the MLE JavaScript SQL driver, the global `soda` symbol is already available and represents a `SodaDatabase`, so most code can work directly with collections without additional connection setup. If the explicit driver flow is needed, `oracledb.defaultConnection().getSodaDatabase()` returns the same starting point.

```javascript
/**
 * Retrieve a purchase order by ID
 * @param {number} id the purchase order's ID
 * @returns {object} the purchase order as retrieved from the database
 * @throws an exception if the collection cannot be opened for reading
 */
export function getPurchaseOrder(id) {
    const collection = soda.openCollection("exampleCollection");

    if (collection === null) {
        throw new Error("failed to open the collection for reading");
    }

    const data = collection.find().filter({ _id: id }).getOne().getContent();

    return data;
}

/**
 * Process a purchase order
 * @param {object} po the purchase order to process
 * @throws an exception if the validation fails
 */
export function savePurchaseOrder(po) {

    const collection = soda.createCollection("exampleCollection");

    if (collection === null) {
        throw new Error("failed to open the collection for reading");
    }

    // simulate some kind of validation. Assume, for example,
    // you need at least one line item and a customer name
    // this would be more sophisticated in real life.
    if ("customer" in po && po.lineItems.length > 0) {

        collection.insertOne(po);
    } else {
        throw new Error("error storing the purchase order: document failed validation");
    }
}
```

Documented SODA capabilities:

- `soda.createCollection()` creates a collection and opens it if one with the same name already exists.
- Collection names are case-sensitive.
- Unless custom metadata is supplied, default collection metadata is applied. By default, collections store JSON documents and automatically generate keys and version information.
- `soda.openCollection()` returns `null` when a collection does not exist, rather than throwing an error.
- `soda.getCollectionNames()` can enumerate all collections, optionally constrained with parameters such as `limit` and `startsWith`.
- `soda.createDocument()` can produce a `SodaDocument`, but Oracle positions `insertOne()` and `insertOneAndGet()` as the standard path for most applications.
- `insertOne()` inserts a document, while `insertOneAndGet()` also returns generated metadata such as key and version, but not the document content.
- `save()` and `saveAndGet()` behave like insert operations unless a client-assigned key already exists, in which case the existing document is replaced.
- `find()` returns a `SodaOperation` used through method chaining. Common nonterminal operations include `key()`, `keys()`, `filter()`, `skip()`, `limit()`, and `version()`.
- Common terminal operations include `getOne()`, `getCursor()`, `count()`, `replaceOne()`, `replaceOneAndGet()`, and `remove()`.
- Query-by-example filters (`filter()`) support structured JSON searches, including comparisons and logical operators.
- `replaceOne()` requires a document selected by key. Oracle documents that `save()` differs because it can insert when the target key does not yet exist.
- `remove()` returns a result object with a `count` field so you can confirm how many documents were deleted.
- `createIndex()` and `dropIndex()` manage collection indexes. Oracle documents B-tree indexes for specific JSON fields and JSON search indexes for ad hoc and full-text search.
- `getDataGuide()` returns a `SodaDocument` describing the current JSON structure of a collection, but requires a JSON-only collection with a JSON search index configured with `"dataguide": "on"`.
- `SodaDocumentCursor` objects returned by `getCursor()` must be closed to release resources.
- SODA transactions follow the same rules as the MLE JavaScript SQL driver: there is no `autoCommit`, so changes must be explicitly committed or rolled back.
- `SodaCollection.drop()` drops the collection and its metadata. Oracle explicitly advises against dropping the underlying table with SQL because doing so leaves SODA metadata behind.
- Oracle documents both inline call specifications and module-based call specifications for invoking SODA-enabled JavaScript from SQL and PL/SQL.

---

## Security and Privileges

Oracle separates privileges for dynamic execution from those for creating schema objects.

### Documented Privileges

```sql
GRANT EXECUTE DYNAMIC MLE TO <role | user>
GRANT CREATE MLE TO <role | user>
GRANT CREATE PROCEDURE TO <role | user>
GRANT CREATE ANY MLE TO <role | user>
GRANT DROP ANY MLE TO <role | user>
GRANT ALTER ANY MLE TO <role | user>
GRANT CREATE ANY PROCEDURE TO <role | user>
GRANT COLLECT DEBUG INFO ON <module> TO <role | user>
```

Documented notes:

- `EXECUTE DYNAMIC MLE` is required for `DBMS_MLE` dynamic execution.
- `CREATE MLE` is required to create modules and environments in your own schema.
- `CREATE PROCEDURE` is also required when exposing JavaScript through call specifications.
- For SODA usage in MLE JavaScript, Oracle documents granting `SODA_APP`.
- `CREATE ANY MLE`, `DROP ANY MLE`, and `ALTER ANY MLE` are powerful privileges intended only for trusted users.
- Starting with Oracle AI Database 26ai, Oracle documents `DB_DEVELOPER_ROLE` as a convenient way to grant common developer privileges in local development databases.
- For development databases ONLY, all required privileges can be granted using the `db_developer_role`

### `MLE_PROG_LANGUAGES`

Oracle documents the initialization parameter `MLE_PROG_LANGUAGES` with values `ALL`, `JAVASCRIPT`, or `OFF`.

Documented behavior:

- It can be set at CDB, PDB, or session level.
- If disabled at CDB level, it cannot be enabled at PDB or session level.
- If disabled at PDB level, it cannot be enabled at session level.
- In 26ai, MLE supports JavaScript as its sole language, so `ALL` and `JAVASCRIPT` have equivalent effect.
- Setting it to `OFF` prevents JavaScript code from executing but does not prevent creation or modification of existing code.

---

## Execution Contexts and `PURE`

MLE uses execution contexts to isolate runtime state such as global variables. Oracle documents:

- Session state does not persist beyond the database session.
- State can be discarded with `DBMS_SESSION.reset_package()`.
- Context reuse depends on the MLE module, environment, and the invoking user.
- Separate execution contexts are created to prevent information leakage and unintended side effects.

For restricted execution, use `PURE`. When using MLE modules, an appropriate MLE Env is required:

```sql
CREATE OR REPLACE MLE ENV pure_env
IMPORTS( 'pure_mod' MODULE pure_mod) PURE;

CREATE OR REPLACE PROCEDURE helloWorld
AS
MLE MODULE pure_mod
ENV pure_env
SIGNATURE 'helloWorld';
/
```

For inline call specifications you can add the PURE keyword directly:

```sql
create or replace function epoch_to_date(
    "p_epoch" number
) return date
as mle language javascript PURE
{{
    let d = new Date(0);
    d.setUTCSeconds(p_epoch);
    return d;
}};
/
```

You can also specify the PURE keyword for dynamic MLE:

```sql
declare
    l_ctx     dbms_mle.context_handle_t;
    l_snippet clob;
begin
    -- to specify pure execution with DBMS_MLE, make sure you use
    -- an MLE environment that has been created with the pure keyword
    l_ctx := dbms_mle.create_context(
        environment => 'PURE_ENV'
    );
    l_snippet := q'~

(async () => {

    const { string2JSON } = await import ('common');

    console.log(JSON.stringify(string2JSON('a=1;b=2')));

}) ()

    ~';
    dbms_mle.eval(l_ctx, 'JAVASCRIPT', l_snippet);
    dbms_mle.drop_context(l_ctx);
exception
    when others then
        dbms_mle.drop_context(l_ctx);
        raise;
end;
/
```

Oracle documents that `PURE`:

- Blocks access to stateful database APIs inside JavaScript, in particular the SQL driver.
- Can be specified on MLE environments, inline call specifications, and used through `DBMS_MLE` via a `PURE` environment.
- Still permits interaction through function arguments, outputs, and exported symbols.
- Still permits supported data types, including reference types such as LOBs passed into MLE.

JavaScript APIs and globals Oracle says are unavailable during `PURE` execution:

- `mle-js-oracledb`
- `mle-js-plsql-ffi`
- `mle-js-fetch`
- `session`
- `soda`
- `plsffi`
- `oracledb`
- `require`

Oracle also documents that APIs that do not interact with database state, such as `mle-js-plsqltypes` and `mle-js-encodings`, remain accessible during `PURE` execution.

---

## Dictionary Views

Oracle documents the following dictionary view families for inspecting MLE metadata:

```sql
SELECT line, text
FROM USER_SOURCE
WHERE name = 'PO_MODULE';

SELECT MODULE_NAME, VERSION, METADATA
FROM USER_MLE_MODULES
WHERE LANGUAGE_NAME='JAVASCRIPT'
/

SELECT ENV_NAME, LANGUAGE_OPTIONS
FROM USER_MLE_ENVS
WHERE ENV_NAME='MYENVOPT'
/

SELECT IMPORT_NAME, MODULE_OWNER, MODULE_NAME
FROM USER_MLE_ENV_IMPORTS
WHERE ENV_NAME='MYFACTORIALENV';
/
```

Use these view families as documented:

- `[USER | ALL | DBA | CDB]_SOURCE`
- `[USER | ALL | DBA | CDB]_MLE_MODULES`
- `[USER | ALL | DBA | CDB]_MLE_ENVS`
- `[USER | ALL | DBA | CDB]_MLE_ENV_IMPORTS`

---

## Best Practices

Based on the Oracle documentation:

- Prefer dedicated server connections; MLE is not supported with shared server.
- Use the PL/SQL Foreign Function Interface (plsffi) whenever you call PL/SQL.
- Always apply and enforce ECMAScript syntax/modules.
- Use modules combined with call specifications for persistent, reusable database APIs.
- Recommend bundlers such as esbuild for complex third-party modules with large dependency trees.
- Use environments to manage import resolution and JavaScript language options.
- Run linting and code analysis before `CREATE MLE MODULE`; the docs explicitly recommend established JavaScript tooling and CI/CD validation. Start by creating the JavaScript file, apply linting and other best practices. Use SQLcl's `mle create-module` command to load the javascript file into the database, except for inline call specifications.
- inline call specifications are always to be created as a SQL file
- Use bind variables in SQL executed from JavaScript.
- Grant the minimum privileges required, especially for `ANY` privileges.
- Use `PURE` for third-party or computational code that must not access database state.
- Use wrapper types such as `oracledb.ORACLE_NUMBER` or `fetchInfo` when precision loss is a concern.
- use the foreign function interface (plsffi) when invoking PL/SQL for a better developer experience.
- Do not use the SODA API unless explicitly requested by the developer.

## Common Mistakes

- Expecting MLE to function with shared server connections.
- Assuming client-driver patterns like connection pools, `connection.close()`, promises, or query streams are available in `mle-js-oracledb`.
- Assuming all Node.js APIs are available. Network and file system access in particular are restricted by design and must be explicitly enabled.
- Forgetting that `AUTHID` defaults to definer's rights on call specifications.
- Omitting `CREATE PROCEDURE` or `CREATE FUNCTION` when creating call specifications that expose JavaScript.
- Using `PURE` and then attempting to access `session`, `oracledb`, `soda`, or `plsffi`.
- Assuming `autoCommit` behaves like `node-oracledb`; Oracle documents that the flag is ignored.
- Assuming all Oracle data types are supported by the MLE SQL driver.
- Using CommonJS modules instead of ECMAScript modules — only ECMAScript is supported.
- MLE is available on Linux x86-64 and aarch64 only. It runs natively on Linux and can be used on macOS via container engines. Windows users should use WSL2.

## Oracle Version Notes (19c vs 26ai)

- Oracle AI Database 26ai has a dedicated JavaScript Developer's Guide for MLE and documents JavaScript as the supported MLE language.
- The fetched 26ai documentation explicitly covers MLE JavaScript modules, environments, call specifications, dynamic execution via `DBMS_MLE`, the `mle-js-oracledb` SQL driver, `PURE` execution, and the `MLE_PROG_LANGUAGES` parameter.
- The fetched 26ai table of contents also shows release-update history for 23.x documentation, indicating MLE JavaScript content exists in later Oracle AI Database releases before 26ai.
- Oracle Database 19c does not support MLE at all.
- Oracle Database 21c only supports dynamic JavaScript execution via `DBMS_MLE`. It does not support modules, environments, or ECMAScript syntax

## Sources

- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/overview-multilingual-engine-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/toc.htm>
- <https://docs.oracle.com/en/database/oracle/oracle-database/23/mlejs/index.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/system-and-object-privileges-required-working-javascript-mle.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/creating-call-specification-mle-module.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/dynamic-javascript-execution.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/security-considerations-mle.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/introduction-javascript-mle-sql-driver.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/api-differences-node-oracledb-and-mle-js-oracledb.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/soda-collections-in-mle-js.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/getting-started-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/creating-document-collection-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/opening-existing-document-collection-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/discovering-existing-collections-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/creating-documents-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/inserting-documents-collections-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/saving-documents-collections-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/finding-documents-collections-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/replacing-documents-collection-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/removing-documents-collection-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/indexing-documents-collection-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/getting-data-guide-collection-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/handling-transactions-soda-database-javascript.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/creating-call-specifications-involving-soda-api.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/managing-javascript-modules-database.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/creating-mle-environments-database.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/restricted-execution-contexts.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/dictionary-views-related-mle-javascript-modules.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/dictionary-views-related-mle-javascript-environments.html>
- <https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/and-parameters.html>
