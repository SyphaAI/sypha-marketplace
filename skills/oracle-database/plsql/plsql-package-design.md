# PL/SQL Package Design

## Overview

Packages serve as the primary building block for modular PL/SQL programming. They collect related procedures, functions, types, variables, and constants into a single named unit. Thoughtfully designed packages enhance maintainability, boost performance (compiled once and loaded once per session), and enforce information hiding through a clear public/private API boundary.

---

## Package Architecture Principles

A package consists of two distinct parts:

- **Package Specification (Spec)**: The public interface — everything that callers are permitted to see and invoke.
- **Package Body**: The implementation — private members and the executable code that backs the spec.

The spec compiles independently. When only the body is modified, dependent objects stay valid, which limits recompilation cascades.

```sql
-- Specification: public API
CREATE OR REPLACE PACKAGE order_mgmt_pkg AS

  -- Public type
  TYPE t_order_status IS TABLE OF VARCHAR2(30) INDEX BY PLS_INTEGER;

  -- Public constants
  c_status_pending   CONSTANT VARCHAR2(10) := 'PENDING';
  c_status_shipped   CONSTANT VARCHAR2(10) := 'SHIPPED';
  c_status_cancelled CONSTANT VARCHAR2(10) := 'CANCELLED';

  -- Public procedures/functions
  PROCEDURE create_order(
    p_customer_id IN  orders.customer_id%TYPE,
    p_order_id    OUT orders.order_id%TYPE
  );

  FUNCTION get_order_status(
    p_order_id IN orders.order_id%TYPE
  ) RETURN VARCHAR2;

  PROCEDURE cancel_order(
    p_order_id IN orders.order_id%TYPE,
    p_reason   IN VARCHAR2 DEFAULT NULL
  );

END order_mgmt_pkg;
/

-- Body: implementation + private members
CREATE OR REPLACE PACKAGE BODY order_mgmt_pkg AS

  -- Private constant (not visible to callers)
  c_max_retries CONSTANT PLS_INTEGER := 3;

  -- Private procedure (not in spec)
  PROCEDURE log_order_event(
    p_order_id IN orders.order_id%TYPE,
    p_event    IN VARCHAR2
  ) IS
    PRAGMA AUTONOMOUS_TRANSACTION;
  BEGIN
    INSERT INTO order_audit_log (order_id, event_time, event_desc)
    VALUES (p_order_id, SYSTIMESTAMP, p_event);
    COMMIT;
  END log_order_event;

  -- Public procedure implementation
  PROCEDURE create_order(
    p_customer_id IN  orders.customer_id%TYPE,
    p_order_id    OUT orders.order_id%TYPE
  ) IS
  BEGIN
    INSERT INTO orders (customer_id, status, created_at)
    VALUES (p_customer_id, c_status_pending, SYSDATE)
    RETURNING order_id INTO p_order_id;

    log_order_event(p_order_id, 'ORDER_CREATED');
    COMMIT;
  END create_order;

  FUNCTION get_order_status(
    p_order_id IN orders.order_id%TYPE
  ) RETURN VARCHAR2 IS
    l_status orders.status%TYPE;
  BEGIN
    SELECT status INTO l_status
    FROM   orders
    WHERE  order_id = p_order_id;
    RETURN l_status;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN NULL;
  END get_order_status;

  PROCEDURE cancel_order(
    p_order_id IN orders.order_id%TYPE,
    p_reason   IN VARCHAR2 DEFAULT NULL
  ) IS
  BEGIN
    UPDATE orders
    SET    status     = c_status_cancelled,
           cancelled_at = SYSDATE,
           cancel_reason = p_reason
    WHERE  order_id = p_order_id;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20001, 'Order not found: ' || p_order_id);
    END IF;

    log_order_event(p_order_id, 'ORDER_CANCELLED');
    COMMIT;
  END cancel_order;

END order_mgmt_pkg;
/
```

---

## Spec vs Body Separation Strategy

| What belongs in SPEC | What belongs in BODY |
|---|---|
| Types used by callers | Private types |
| Public procedure/function signatures | All procedure/function bodies |
| Public constants | Private constants |
| Public variables (avoid if possible) | Private variables |
| Exceptions callers must catch | Private exceptions |
| Cursor declarations callers iterate | All cursor implementations |

**Rule of thumb**: If callers have no need to reference something, keep it in the body. A leaner spec reduces coupling and minimizes unnecessary recompilation.

---

## Designing Public vs Private APIs

### Public API Design Principles

1. **Stable signatures**: Modifying a spec parameter invalidates all dependent objects. Add parameters with default values to remain backward compatible.
2. **Meaningful names**: `process_order` communicates intent far better than `do_stuff`.
3. **Single responsibility**: Each procedure should accomplish exactly one thing.
4. **Return values vs OUT parameters**: Functions that return a single value are more composable. Use procedures with OUT parameters when the operation produces multiple outputs or performs DML.

```sql
-- Good: default parameter allows adding optional behavior
PROCEDURE process_payment(
  p_order_id      IN orders.order_id%TYPE,
  p_amount        IN NUMBER,
  p_currency      IN VARCHAR2 DEFAULT 'USD',  -- added later, no breaking change
  p_send_receipt  IN BOOLEAN  DEFAULT TRUE    -- added later, no breaking change
);
```

### Private Implementation Helpers

Encapsulate implementation details in the body. Promote a member to the spec only when another package genuinely requires direct access to it.

```sql
-- Private helper: validation logic callers never call directly
PROCEDURE validate_order_amount(
  p_amount   IN NUMBER,
  p_currency IN VARCHAR2
) IS
BEGIN
  IF p_amount <= 0 THEN
    RAISE_APPLICATION_ERROR(-20010, 'Amount must be positive');
  END IF;
  IF p_currency NOT IN ('USD', 'EUR', 'GBP') THEN
    RAISE_APPLICATION_ERROR(-20011, 'Unsupported currency: ' || p_currency);
  END IF;
END validate_order_amount;
```

---

## Package Initialization Blocks

A package body may include an optional initialization block that executes exactly once per session — on the first occasion the package is referenced.

```sql
CREATE OR REPLACE PACKAGE BODY config_pkg AS

  g_env_name     VARCHAR2(50);
  g_debug_enabled BOOLEAN;

  -- Initialization block: runs once per session on first package reference
  BEGIN
    -- Load configuration from a settings table
    BEGIN
      SELECT setting_value
      INTO   g_env_name
      FROM   app_settings
      WHERE  setting_name = 'ENVIRONMENT';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        g_env_name := 'UNKNOWN';
    END;

    g_debug_enabled := (g_env_name IN ('DEV', 'TEST'));
  END config_pkg;
/
```

### Package State Pitfalls with Connection Pooling

**This is a critical production concern.** Package-level variables (global state) are scoped to the database session. In connection-pooled environments (JDBC, OCI, DRCP), the same session can be handed to different logical users or requests. Package state set during a prior request may therefore still be present when the connection is reused.

```sql
-- DANGEROUS: package variable holds user-specific state
CREATE OR REPLACE PACKAGE session_context_pkg AS
  g_current_user_id NUMBER;  -- This persists across pool reuse!
  PROCEDURE set_user(p_user_id IN NUMBER);
  FUNCTION  get_user RETURN NUMBER;
END session_context_pkg;
/

-- SAFE ALTERNATIVE: use application context (SYS_CONTEXT)
-- Set at login via a logon trigger or app initialization call
BEGIN
  DBMS_SESSION.SET_CONTEXT(
    namespace => 'APP_CTX',
    attribute => 'USER_ID',
    value     => TO_CHAR(p_user_id)
  );
END;

-- Read anywhere, session-specific, not affected by pooling misconceptions
SELECT SYS_CONTEXT('APP_CTX', 'USER_ID') FROM DUAL;
```

### Safe Use of Package State

Package state is well suited for:
- **Read-only configuration** fetched once from tables (environment flags, lookup maps)
- **Session-scoped caches** where some staleness is acceptable and the session belongs to a single user

```sql
CREATE OR REPLACE PACKAGE BODY lookup_cache_pkg AS

  TYPE t_code_map IS TABLE OF VARCHAR2(200) INDEX BY VARCHAR2(30);
  g_status_map t_code_map;
  g_map_loaded BOOLEAN := FALSE;

  PROCEDURE ensure_loaded IS
  BEGIN
    IF NOT g_map_loaded THEN
      FOR rec IN (SELECT code, description FROM status_codes) LOOP
        g_status_map(rec.code) := rec.description;
      END LOOP;
      g_map_loaded := TRUE;
    END IF;
  END ensure_loaded;

  FUNCTION get_status_desc(p_code IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    ensure_loaded;
    IF g_status_map.EXISTS(p_code) THEN
      RETURN g_status_map(p_code);
    END IF;
    RETURN 'UNKNOWN';
  END get_status_desc;

END lookup_cache_pkg;
/
```

---

## Cohesion and Coupling

- **High cohesion**: Cluster procedures that work on the same data or belong to the same feature domain. `customer_pkg` should contain customer operations, not order processing logic.
- **Low coupling**: Packages must not form circular dependencies. If `pkg_a` calls `pkg_b` and `pkg_b` calls back into `pkg_a`, extract the shared logic into a dedicated base package.

### Detecting Circular Dependencies

```sql
-- Check for circular dependencies in USER_DEPENDENCIES
SELECT referenced_name, name
FROM   user_dependencies
WHERE  type = 'PACKAGE BODY'
  AND  referenced_type IN ('PACKAGE', 'PACKAGE BODY')
ORDER BY referenced_name;
```

---

## Forward Declarations

In a package body, a procedure that appears later in the source cannot be called by an earlier procedure unless a forward declaration is provided:

```sql
CREATE OR REPLACE PACKAGE BODY mutual_pkg AS

  -- Forward declaration allows process_a to call process_b
  -- even though process_b is defined later
  PROCEDURE process_b(p_id IN NUMBER);

  PROCEDURE process_a(p_id IN NUMBER) IS
  BEGIN
    IF p_id > 0 THEN
      process_b(p_id - 1);  -- valid because of forward declaration
    END IF;
  END process_a;

  PROCEDURE process_b(p_id IN NUMBER) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE('Processing: ' || p_id);
    IF p_id > 0 THEN
      process_a(p_id - 1);
    END IF;
  END process_b;

END mutual_pkg;
/
```

---

## Overloading

The same procedure or function name can appear multiple times in a spec as long as each declaration has a distinct parameter signature. Oracle resolves the correct overload at compile time.

```sql
CREATE OR REPLACE PACKAGE format_pkg AS

  -- Overloaded: same name, different parameter types
  FUNCTION format_date(p_date IN DATE)      RETURN VARCHAR2;
  FUNCTION format_date(p_date IN TIMESTAMP) RETURN VARCHAR2;
  FUNCTION format_date(p_date IN DATE, p_fmt IN VARCHAR2) RETURN VARCHAR2;

END format_pkg;
/

CREATE OR REPLACE PACKAGE BODY format_pkg AS

  FUNCTION format_date(p_date IN DATE) RETURN VARCHAR2 IS
  BEGIN
    RETURN TO_CHAR(p_date, 'YYYY-MM-DD');
  END format_date;

  FUNCTION format_date(p_date IN TIMESTAMP) RETURN VARCHAR2 IS
  BEGIN
    RETURN TO_CHAR(p_date, 'YYYY-MM-DD HH24:MI:SS.FF3');
  END format_date;

  FUNCTION format_date(p_date IN DATE, p_fmt IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN TO_CHAR(p_date, p_fmt);
  END format_date;

END format_pkg;
/
```

**Overloading restrictions**: You cannot overload on return type alone. You cannot overload when the signatures differ only in IN versus OUT mode. You cannot overload when parameter types differ only between PLS_INTEGER and NUMBER, as they are subtypes of the same family.

---

## Package Size Guidelines

Large packages are more difficult to maintain and increase compilation times. Consider splitting them when:

| Signal | Action |
|---|---|
| Body exceeds ~1000-1500 lines | Split into sub-packages by feature area |
| Spec has 30+ public members | Review if all are truly public |
| Package mixes multiple domains | Split by domain (customer vs order vs payment) |
| Initialization block hits tables from many schemas | Extract to a dedicated config package |

---

## Best Practices

- Always create the spec before the body. Doing so allows dependent objects to compile against the public interface before the implementation exists.
- Use `NOCOPY` for large IN OUT collection parameters (refer to the performance guide for details).
- Never include DML in a package initialization block — it executes implicitly on first package reference and can cause unexpected commits or locks.
- Prefix package-level (global) variables with `g_` to distinguish them from local variables at a glance.
- Anchor variable declarations to column types using `%TYPE` so that they adapt automatically when the schema changes.
- Add comments to the spec; it functions as the primary API documentation for consumers of the package.

---

## Common Mistakes and Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Public package variables | Callers depend on internal state directly; hard to change | Use getter/setter functions |
| Storing user identity in package globals with connection pooling | State leaks across requests | Use application context (`DBMS_SESSION.SET_CONTEXT`) |
| Circular package dependencies | Cannot compile; maintenance nightmare | Extract shared types/utilities into a separate base package |
| One giant "utils" package | Zero cohesion; everything depends on it | Break into domain-specific packages |
| Business logic in initialization blocks | Runs silently on first reference; hard to debug | Use explicit initialization procedures |
| Recompiling spec for body-only changes | Invalidates all dependent objects | Change body only when logic changes; change spec only when API changes |

---

## Oracle Version Notes (19c vs 26ai)

- Baseline guidance in this file is valid for Oracle Database 19c unless a newer minimum version is explicitly called out.
- Features marked as 21c, 23c, or 23ai should be treated as Oracle Database 26ai-capable features; retain 19c-compatible alternatives for mixed-version estates.
- In dual-support environments, verify syntax and package behaviour in both 19c and 26ai, as defaults and deprecations can vary across release updates.

- **Oracle 12c+**: Invisible columns added to a table do not automatically update `%ROWTYPE` in packages compiled before the column was introduced — an explicit recompile is required.
- **Oracle 18c+**: Restricting access with `ACCESSIBLE BY` (introduced in 12.2) supports fine-grained inter-package access control.
- **Oracle 12.2+**: The `ACCESSIBLE BY` clause allows you to constrain which program units are permitted to call a given package.

```sql
-- 12.2+: Restrict access to this package to only order_mgmt_pkg
CREATE OR REPLACE PACKAGE order_internals_pkg
  ACCESSIBLE BY (PACKAGE order_mgmt_pkg)
AS
  PROCEDURE internal_validate(p_order_id IN NUMBER);
END order_internals_pkg;
/
```

---

## Sources

- [Oracle Database PL/SQL Language Reference 19c — Packages](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-packages.html) — package structure, spec vs body, overloading, forward declarations, initialization
- [Oracle Database PL/SQL Language Reference 19c — ACCESSIBLE BY Clause](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/ACCESSIBLE-BY-clause.html) — 12.2+ access control
- [DBMS_SESSION (19c)](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SESSION.html) — SET_CONTEXT for application context
