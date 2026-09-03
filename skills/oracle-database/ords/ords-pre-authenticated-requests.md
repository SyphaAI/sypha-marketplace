# ORDS Pre-Authenticated Requests (PAR)

## Overview

Oracle REST Data Services (ORDS) pre-authenticated requests (PAR) allow you to generate and use pre-authenticated links for accessing protected ORDS RESTful services without supplying user credentials. When a PAR is created, ORDS generates a unique URL that you can hand off to another user or system, enabling it to interact with a specific RESTful entity using standard HTTP tools.

ORDS surfaces this capability through the `ORDS_PAR` PL/SQL package. Use it whenever you need a pre-authenticated URL for an already-protected handler in a REST-enabled schema.

---

## Prerequisites

- The target schema must already be **REST-enabled**.
- The PAR is only valid within the context of the **current REST-enabled schema**.
- The target handler must already exist in the current schema.
- The module name, pattern, and method supplied to `ORDS_PAR.DEFINE_FOR_HANDLER` must correspond to an existing handler.
- If these values do not match an existing handler exactly, ORDS raises `ORA-20071: No matching ORDS handler`.

For broader coverage of schemas, handlers, and protection setup, refer to [ords-rest-api-design.md](./ords-rest-api-design.md) and [ords-authentication.md](./ords-authentication.md).

---

## Create a Matching Handler First (If Needed)

The sample values `demo`, `emp/`, and `GET` are not universal. Use them only when that handler already exists in the current REST-enabled schema, or create a matching handler beforehand:

```sql
BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'demo',
    p_base_path      => '/demo_prefix/',
    p_items_per_page => 25,
    p_status         => 'PUBLISHED',
    p_comments       => 'PAR demo module'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'demo',
    p_pattern     => 'emp/',
    p_comments    => 'PAR demo template'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name    => 'demo',
    p_pattern        => 'emp/',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_items_per_page => 25,
    p_comments       => 'PAR demo handler',
    p_source         => q'[
      SELECT 'ok' AS status
      FROM   dual
    ]'
  );

  COMMIT;
END;
/
```

If you already have an existing handler, substitute its actual internal `p_module_name`, template `p_pattern`, and `p_method` values in the PAR example below.

---

## Create a Pre-Authenticated Request

Use `ORDS_PAR.DEFINE_FOR_HANDLER` to create a PAR targeting an existing ORDS handler.

Parameters documented by Oracle:

- `p_module_name`: name of the existing RESTful service module; this value is case sensitive
- `p_pattern`: matching pattern for an existing resource template
- `p_method`: existing handler HTTP method; valid values are `GET`, `POST`, `PUT`, or `DELETE`
- `p_duration`: validity duration in seconds

Example:

```sql
SET SERVEROUTPUT ON

DECLARE
  l_par_json CLOB;
  l_par_obj  JSON_OBJECT_T;
BEGIN
  l_par_json := ORDS_PAR.DEFINE_FOR_HANDLER(
    p_module_name => 'demo',
    p_pattern     => 'emp/',
    p_method      => 'GET',
    p_duration    => 360
  );

  COMMIT;

  l_par_obj := JSON_OBJECT_T.PARSE(l_par_json);

  DBMS_OUTPUT.PUT_LINE('token=' || l_par_obj.get_string('token'));
  DBMS_OUTPUT.PUT_LINE('alias=' || l_par_obj.get_string('alias'));
  DBMS_OUTPUT.PUT_LINE('uri='   || l_par_obj.get_string('uri'));
END;
/
```

Oracle documents that the function returns a JSON object containing:

- `token`
- `alias`
- `uri`

Record the token and alias immediately upon creating the PAR because Oracle documents that their values cannot be retrieved afterward.

---

## Use the Pre-Authenticated URL

Use the exact `uri` value returned at PAR creation time. The returned `uri` is relative, so prepend your ORDS base URL and schema mapping.

Example:

If `DEFINE_FOR_HANDLER` returned:

```text
uri=/_/par/<par_token>/demo_prefix/emp/
```

then invoke:

```shell
curl -i -X GET \
  http://localhost:8080/ords/ordstest/_/par/<par_token>/demo_prefix/emp/
```

If the pre-authenticated request URL contains URI parameters identified by `:`, you must replace them with concrete values before calling the endpoint.

Do not substitute an unrelated sample path; the request URL must correspond to the `uri` returned for the handler you actually registered.

---

## Revoke a PAR

Use `ORDS_PAR.REVOKE_PAR` with the token from the PAR URL.

```sql
BEGIN
  ORDS_PAR.REVOKE_PAR(
    p_par_token => '<par_token>'
  );
  COMMIT;
END;
/
```

Oracle documents that it may take up to **30 seconds** for the revocation to take effect.

---

## Operational Notes

- A PAR is created against an **existing handler**; it does not define a new module, template, or handler.
- The returned `uri` is relative and is the URL to use for subsequent calls.
- If the handler pattern contains URI parameters, the returned PAR URI uses the generic pattern and you must substitute real values before making the request.
- If you drop or recreate the underlying handler or module, recreate any associated PARs as well. PARs are bound to existing handler metadata, and ORDS documents that redefining modules, templates, or handlers replaces the existing definitions.

---

## Best Practices

- Store the returned token and alias immediately after creation because Oracle documents that they cannot be recovered later.
- Confirm the module, pattern, and method already exist in the current REST-enabled schema before calling `ORDS_PAR.DEFINE_FOR_HANDLER`.
- Choose a `p_duration` value that reflects the intended validity window, keeping in mind that Oracle documents the value in seconds.
- Favor short-lived PARs for ad hoc sharing, one-time access, or support workflows, and use longer durations only when the operational need is clear.
- Treat the full PAR URL as a bearer secret: anyone who holds it can invoke the protected handler until it expires or is revoked.
- Share PAR URLs only over trusted HTTPS channels and store them in a secret store or other controlled location.
- Avoid logging, pasting, or screenshotting full PAR URLs in tickets, chat, dashboards, or application logs; redact the token if you must record it.
- Replace any URI parameters in the returned PAR URL with concrete values before invoking the endpoint.

---

## Common Mistakes

- Trying to create a PAR for a handler that does not exist in the current REST-enabled schema.
- Supplying the wrong case for `p_module_name`.
- Assuming ORDS will automatically fill in URI parameter values in the returned PAR URI.
- Creating PARs with durations far longer than the actual access window and then treating them as short-lived.
- Treating the PAR URL as harmless metadata and exposing it in logs, tickets, or chat.
- Losing the returned token or alias and then attempting to retrieve them later.
- Dropping or recreating a handler or module and expecting existing PARs to remain valid without regeneration.
- Expecting revocation to be immediate without accounting for the documented propagation delay.

---

## Oracle Version Notes (19c vs 26ai)

- This PAR workflow is documented in the ORDS **25.4** and **26.1** developer guides.
- The `ORDS_PAR.DEFINE_FOR_HANDLER` and `ORDS_PAR.REVOKE_PAR` interfaces cited here are also described in the ORDS **25.2** package reference.
- This file does not rely on any **26.1**-only PAR syntax.

## Sources

- [Developing Oracle REST Data Services Applications (25.4)](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.4/orddg/developing-REST-applications.html)
- [Developing Oracle REST Data Services Applications (26.1)](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/26.1/orddg/developing-REST-applications.html)
- [ORDS_PAR PL/SQL Package Reference](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.2/orddg/ords_par-pl-sql-package-reference.html)
