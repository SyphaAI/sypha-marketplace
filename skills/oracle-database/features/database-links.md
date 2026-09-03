# Oracle Database Links

## Overview

A **database link** (dblink) is a named connection descriptor stored in a local Oracle database that allows SQL statements to reference objects in a remote database as though they were local. A database link holds the connection information (host, port, service name) and — depending on the link type — the remote credentials used to open the session.

Database links are a built-in Oracle feature that predates most distributed database technology, and they remain a practical solution for cross-database queries, distributed DML, and replication scenarios within an Oracle estate.

**When database links are appropriate:**
- Ad-hoc queries spanning two Oracle databases on the same trusted network
- Scheduled batch jobs that aggregate data from multiple Oracle sources
- Replication and synchronization between Oracle databases (commonly via materialized views)
- Migration scenarios where data must be read from a legacy database during cut-over

**When database links are NOT appropriate:**
- High-frequency OLTP queries — network round-trip overhead compounds rapidly
- Cross-database joins on large tables — the volume of data transferred is uncontrolled
- Direct connections to non-Oracle databases (use heterogeneous services or generic connectivity instead)
- Situations that require strong security isolation — dblinks carry implicit trust

---

## Types of Database Links

### Fixed User Link

The link always connects to the remote database under a specific, hardcoded user. Regardless of which local user executes a query through the link, the remote credentials embedded in the link are used.

```sql
CREATE DATABASE LINK sales_db_link
CONNECT TO remote_user IDENTIFIED BY "remote_password"
USING 'SALESDB';   -- TNS service name or connect string
```

### Connected User Link

The link connects to the remote database as the **same user** who is currently authenticated on the local database. The remote database must have a corresponding account.

```sql
CREATE DATABASE LINK hr_db_link
CONNECT TO CURRENT_USER
USING 'HRDB';
```

Connected user links are more secure than fixed user links because no credentials are embedded in the database, and each local user operates under their own set of remote privileges.

### Shared Database Link

A **shared link** reuses one remote database session across multiple local sessions. This lowers connection overhead on the remote database at the expense of slightly more complex connection management.

```sql
CREATE SHARED DATABASE LINK shared_dw_link
CONNECT TO dw_query_user IDENTIFIED BY "dw_password"
USING 'DWDB';
```

### Public vs Private Links

By default, a database link is **private** — accessible only to the user who created it. A **public** link is available to any user in the database.

```sql
-- Private link (owned by current user only)
CREATE DATABASE LINK my_private_link
CONNECT TO remote_user IDENTIFIED BY "password"
USING 'REMOTEDB';

-- Public link (accessible by all database users)
CREATE PUBLIC DATABASE LINK corp_shared_link
CONNECT TO reporting_user IDENTIFIED BY "rpt_password"
USING 'REPORTDB';
-- Requires CREATE PUBLIC DATABASE LINK privilege
```

---

## TNS Connection Options

The `USING` clause accepts either a TNS alias (resolved via `tnsnames.ora` or LDAP) or an inline Easy Connect string:

```sql
-- Easy Connect string (no tnsnames.ora entry required)
CREATE DATABASE LINK remote_via_ezconnect
CONNECT TO app_user IDENTIFIED BY "password"
USING '//db-host.company.com:1521/ORCL';

-- Full inline descriptor (TNS descriptor syntax)
CREATE DATABASE LINK remote_full_descriptor
CONNECT TO app_user IDENTIFIED BY "password"
USING '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=db-host.company.com)(PORT=1521))
        (CONNECT_DATA=(SERVICE_NAME=ORCL)))';

-- TNS alias from tnsnames.ora
CREATE DATABASE LINK remote_via_tns
CONNECT TO app_user IDENTIFIED BY "password"
USING 'PROD_DB';
```

---

## Using Database Links in Queries

Once created, reference a remote object by appending `@<link_name>` to its name:

### SELECT Across a Database Link

```sql
-- Select from a remote table
SELECT employee_id, last_name, salary
FROM   employees@hr_db_link
WHERE  department_id = 90;

-- Join local and remote tables
SELECT l.order_id,
       l.order_date,
       r.customer_name,
       r.email
FROM   orders         l
JOIN   customers@crm_db_link r ON r.customer_id = l.customer_id
WHERE  l.order_date > SYSDATE - 30;

-- Use a synonym to hide the link name from application code
CREATE SYNONYM remote_customers FOR customers@crm_db_link;

SELECT * FROM remote_customers WHERE country_code = 'US';
```

### DML Across a Database Link

Oracle allows INSERT, UPDATE, DELETE, and MERGE operations on remote tables through database links:

```sql
-- Insert into a remote table
INSERT INTO archive_orders@archive_db_link (order_id, order_date, amount)
SELECT order_id, order_date, amount
FROM   orders_local
WHERE  order_date < ADD_MONTHS(SYSDATE, -24);

-- Update a remote record
UPDATE customer_flags@crm_db_link
SET    is_active = 0
WHERE  last_order_date < ADD_MONTHS(SYSDATE, -12);

-- MERGE across a database link
MERGE INTO product_catalog@dw_db_link target
USING (SELECT product_id, product_name, unit_price FROM products_local) src
ON    (target.product_id = src.product_id)
WHEN MATCHED THEN
    UPDATE SET target.unit_price = src.unit_price
WHEN NOT MATCHED THEN
    INSERT (product_id, product_name, unit_price)
    VALUES (src.product_id, src.product_name, src.unit_price);

COMMIT;
```

### Calling Remote Procedures

```sql
-- Execute a stored procedure on the remote database
BEGIN
    archive_pkg.purge_old_records@archive_db_link(p_cutoff_date => ADD_MONTHS(SYSDATE, -36));
END;
/
```

---

## Two-Phase Commit (Distributed Transactions)

When a single Oracle transaction modifies data on **multiple databases** through database links, Oracle uses **two-phase commit (2PC)** to guarantee atomicity across all sites.

### How 2PC Works in Oracle

1. **Prepare phase:** The local database (coordinator) queries each remote database (participant) to determine whether it is ready to commit.
2. **Commit phase:** If every participant reports ready, the coordinator directs all sites to commit. If any participant reports not ready (or times out), all sites roll back.

The coordinator records the 2PC decision in `DBA_2PC_PENDING` before the final commit or rollback, allowing the transaction to be resolved manually if a participant becomes unreachable.

```sql
-- Distributed transaction touching two databases
BEGIN
    -- Local insert
    INSERT INTO local_orders (order_id, amount) VALUES (9001, 1500.00);

    -- Remote insert (triggers 2PC coordination)
    INSERT INTO order_archive@archive_db_link (order_id, amount) VALUES (9001, 1500.00);

    COMMIT;  -- Oracle negotiates 2PC automatically
END;
/
```

### Monitoring and Resolving In-Doubt Transactions

```sql
-- View in-doubt distributed transactions
SELECT local_tran_id, global_tran_id, state, mixed, host, db_user, advice
FROM   dba_2pc_pending;

-- Manually force commit of an in-doubt transaction (use only when instructed)
-- This is only safe when you have confirmed the remote side committed
COMMIT FORCE '10.13.3.10.1';  -- use the local_tran_id from DBA_2PC_PENDING

-- Manually force rollback
ROLLBACK FORCE '10.13.3.10.1';

-- Clean up after resolution
DELETE FROM dba_2pc_pending WHERE local_tran_id = '10.13.3.10.1';
EXEC DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY('10.13.3.10.1');
```

**Important:** Never force-commit or force-rollback a distributed transaction manually without first confirming the state of the remote participant. Forcing the wrong outcome produces data inconsistencies that are difficult to detect and correct.

---

## Performance Implications

### The Remote-First Execution Problem

Oracle's optimizer plans distributed queries using local statistics. It frequently underestimates remote table sizes because those statistics are not always up to date. This can lead the optimizer to retrieve large result sets across the network rather than applying filters on the remote side.

```sql
-- PROBLEMATIC: Oracle may push the join to the remote side, fetching all of
-- 'orders' (potentially millions of rows) across the network
SELECT o.order_id, c.customer_name
FROM   orders          o
JOIN   customers@remote_db c ON c.customer_id = o.customer_id
WHERE  o.order_date > SYSDATE - 7;

-- BETTER: Force the filtering to happen locally first, then join to remote
SELECT o.order_id, c.customer_name
FROM   (SELECT order_id, customer_id FROM orders WHERE order_date > SYSDATE - 7) o
JOIN   customers@remote_db c ON c.customer_id = o.customer_id;
```

### The `DRIVING_SITE` Hint

The `DRIVING_SITE` hint directs Oracle to execute the join at the specified database location, minimizing data movement:

```sql
-- Execute the query at the remote site (remote data is large; local filter is selective)
SELECT /*+ DRIVING_SITE(c) */
       o.order_id, c.customer_name
FROM   orders          o
JOIN   customers@remote_db c ON c.customer_id = o.customer_id
WHERE  c.country_code = 'US';
```

### Using DB Links with Materialized Views for Performance

Rather than issuing live queries through a database link, consider pulling data into a local MV:

```sql
-- Create a local MV that refreshes from the remote database daily
CREATE MATERIALIZED VIEW mv_remote_customers
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
SELECT customer_id, customer_name, country_code, email
FROM   customers@crm_db_link;

-- Schedule refresh via DBMS_SCHEDULER
BEGIN
    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'REFRESH_REMOTE_CUSTOMERS_MV',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN DBMS_MVIEW.REFRESH(''MV_REMOTE_CUSTOMERS'', ''C''); END;',
        repeat_interval => 'FREQ=DAILY;BYHOUR=3;BYMINUTE=0;BYSECOND=0',
        enabled         => TRUE
    );
END;
/
```

---

## Managing Database Links

```sql
-- View database links owned by current user
SELECT db_link, username, host, created
FROM   user_db_links
ORDER  BY db_link;

-- View all database links (DBA view)
SELECT owner, db_link, username, host, created
FROM   dba_db_links
ORDER  BY owner, db_link;

-- Test a database link
SELECT * FROM dual@hr_db_link;
-- Expected result: one row, column X = 'X'

-- Check current session's open database link connections
SELECT db_link
FROM   v$dblink;

-- Close an open database link without disconnecting the session
ALTER SESSION CLOSE DATABASE LINK hr_db_link;

-- Drop a database link
DROP DATABASE LINK hr_db_link;
DROP PUBLIC DATABASE LINK corp_shared_link;
```

---

## Security Risks and Best Practices

### Risks

1. **Credential exposure:** Fixed user links store the remote password in encrypted but accessible form in `SYS.LINK$`. A DBA with `SELECT ANY DICTIONARY` access can potentially extract link credentials. This is a widely known concern — treat fixed user link credentials as shared secrets with a limited lifetime.

2. **Privilege escalation:** A user with access to a database link that targets a remote DBA account can execute arbitrary DDL on the remote database.

3. **Audit blind spots:** DML executed through a database link is logged in the remote database's audit trail under the remote link user, not the local user who initiated it. This breaks end-to-end accountability unless both sides are audited and the records are correlated.

4. **Lateral movement:** A compromised application schema that has access to a fixed user dblink becomes a pivot point into a second database.

### Best Practices

- **Prefer connected user links** over fixed user links in user-facing applications. Each local user's identity propagates to the remote database, preserving audit trails and enforcing remote-side row-level security.
- **Create dedicated remote users for database links** and grant them only the minimum required privileges (SELECT on specific tables, not CONNECT RESOURCE or DBA).
- **Rotate fixed user link passwords on a schedule.** Use Oracle Vault or a secrets manager. To update the password, recreate the link:

```sql
-- Recreate a database link to update the password
DROP DATABASE LINK old_link;
CREATE DATABASE LINK old_link
CONNECT TO remote_user IDENTIFIED BY "new_password"
USING 'REMOTEDB';
```

- **Audit database link usage.** Enable fine-grained auditing or Oracle Audit Vault to record all cross-database operations.

```sql
-- Enable audit for database link operations
AUDIT SELECT TABLE, INSERT TABLE, UPDATE TABLE, DELETE TABLE
BY ACCESS
WHENEVER SUCCESSFUL;
```

- **Never create public database links that point to privileged remote accounts.** Any database user — including accounts created by application frameworks, tooling, or an attacker — can use a public link.
- **Review `DBA_DB_LINKS` on a regular basis.** Remove links that are no longer active. An unused link pointing to a decommissioned system is a latent security and connectivity liability.
- **Firewall remote database ports** so that only the Oracle listener port is reachable, and only from the specific source database hosts. Database link connections use standard Oracle Net, so standard network controls apply.
- **Use Oracle Network Encryption (ASO/TLS)** for database link traffic on untrusted networks. Database link traffic is transmitted in cleartext by default.

```sql
-- sqlnet.ora on the client (initiating) side
-- Add: SQLNET.ENCRYPTION_CLIENT = REQUIRED
-- SQLNET.ENCRYPTION_TYPES_CLIENT = (AES256)
```

---

## Common Mistakes and How to Avoid Them

**Mistake 1: Using fixed user links that target powerful accounts**
A fixed user link pointing to a `DBA` or `CONNECT RESOURCE` account gives anyone who can access that link full control over the remote database. Always create a minimal-privilege remote account specifically for dblink use.

**Mistake 2: Live cross-database joins in OLTP code paths**
Every row fetched through a database link incurs a network round-trip. A join that scans 100,000 remote rows transfers the entire result set over the network. Audit all production code paths that contain `@link_name` and replace high-frequency paths with scheduled MV refreshes or local copies.

**Mistake 3: Ignoring `DBA_2PC_PENDING` entries**
Unresolved in-doubt transactions accumulate in `DBA_2PC_PENDING` and hold resources (locks, rollback segment entries). Set up a monitoring alert for a non-empty `DBA_2PC_PENDING`. The RECO (Recoverer) process resolves them automatically once connectivity returns, but some cases require manual intervention.

**Mistake 4: Creating public database links in multi-tenant environments**
In an Oracle Multitenant (CDB/PDB) environment, a public database link in a PDB is accessible to every user of that PDB. Apply the same level of caution to public links as you would to granting DBA to public. Prefer private links or application-level connection management.

**Mistake 5: Not testing links after network or firewall changes**
Database link failures appear as `ORA-12170: TNS:Connect timeout` or `ORA-12541: TNS:no listener` at query execution time, not at link creation time. After any network change, test all active links with `SELECT * FROM dual@<link_name>`.

**Mistake 6: Storing the link password in application scripts**
Some teams create database links through scripts with hardcoded passwords. Those scripts frequently end up committed to version control. Use environment variables or Oracle Vault to supply credentials at deployment time, and never commit connection scripts that contain embedded passwords.

---


## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; keep 19c-compatible alternatives for mixed-version estates.
- For dual-support environments, test syntax and package behavior in both 19c and 26ai because defaults and deprecations can differ by release update.

## Sources

- [Oracle Database Administrator's Guide: Managing Distributed Databases — Database Links 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-a-distributed-database.html)
- [Oracle Database SQL Language Reference: CREATE DATABASE LINK 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-DATABASE-LINK.html)
- [Oracle Database Heterogeneous Connectivity User's Guide 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/heter/index.html)
