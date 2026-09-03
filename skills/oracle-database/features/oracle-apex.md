# Oracle APEX (Application Express)

## Overview

**Oracle APEX** is Oracle's low-code, database-native web application platform. It enables the development of browser-based applications, forms, reports, dashboards, and lightweight workflow tools on top of Oracle data.

This page is intentionally concise. Its purpose is to describe what APEX is and how it fits into an Oracle environment — it is not a comprehensive build, administration, or deployment reference.

At a high level:
- APEX applications are designed in a browser
- APEX executes against Oracle Database data and PL/SQL
- APEX requires Oracle REST Data Services (ORDS) as the web listener
- Applications are stored as metadata and can be exported as SQL scripts

---

## When APEX Fits Well

APEX is well suited for:
- Internal business applications
- Data entry and approval workflows
- Reporting and dashboard tooling
- Administrative interfaces built on Oracle schemas
- Rapid delivery of database-centric web applications

APEX is typically a poor fit when the primary requirement is:
- A heavily customized, front-end-framework-first experience
- Complex offline or mobile-native behavior
- A non-Oracle data platform as the system of record

---

## Core Concepts

| Term | Meaning |
|---|---|
| `Workspace` | Top-level APEX container for developers, applications, and associated schemas |
| `Application` | A packaged web app made of pages, shared components, and metadata |
| `Page` | A single screen in the application |
| `Region` | A section of a page, such as a report, chart, or form |
| `Item` | A page field or variable, such as `P1_CUSTOMER_ID` |
| `Session State` | Per-session values that APEX stores for page and application items |
| `Parsing Schema` | Database schema whose privileges are used for the app's SQL and PL/SQL |
| `Shared Components` | Reusable definitions such as navigation, LOVs, auth schemes, and templates |
| `ORDS` | The required web listener and REST layer used to serve APEX |

---

## Runtime Model

Current APEX deployments follow this request path:

```text
Browser
  -> ORDS
  -> Oracle Database
     -> APEX engine
     -> Application schema objects
```

Key architectural distinction:
- APEX itself resides in Oracle-managed APEX schemas
- Your tables, views, packages, and business logic typically live in one or more application schemas
- The APEX application accesses those schema objects through its configured parsing schema

Keeping this separation clear is the essential mental model for reading or building APEX applications.

---

## What Developers Usually Build

A typical APEX application includes:
- Report pages for querying and displaying data
- Form pages for insert, update, and delete workflows
- Charts and summary dashboards
- Validations and computed field logic
- PL/SQL processes executed on page submit events
- Authentication and authorization schemes

The majority of an application is assembled declaratively in App Builder, with SQL, PL/SQL, and JavaScript layered in where needed.

---

## Minimal Example

APEX routinely binds page items directly into SQL queries using session state values:

```sql
SELECT order_id,
       order_date,
       total_amount
FROM   orders
WHERE  customer_id = :P10_CUSTOMER_ID
ORDER  BY order_date DESC;
```

In this example:
- `P10_CUSTOMER_ID` is a page item
- APEX resolves its value from session state at runtime
- The query executes under the privileges of the application's parsing schema

---

## How APEX Is Usually Managed

A practical operational model looks like this:
- Developers construct pages in App Builder
- Database objects are maintained through ordinary schema scripts
- APEX applications are exported as SQL files for version control
- ORDS serves the application over HTTP/S

This separation matters: schema code and APEX application metadata are related but are not the same deployable artifact.

---

## Practical Guidance

- Use a dedicated application schema rather than `SYS` or `SYSTEM`
- Use bind variables and page items instead of constructing dynamic SQL through string concatenation
- Treat the APEX application export as a first-class deployable artifact
- Enforce authorization at the server side, not solely by hiding UI elements
- Keep custom PL/SQL and JavaScript minimal; favour declarative APEX features wherever possible

---

## Out of Scope Here

This page does not attempt to cover APEX comprehensively. It intentionally excludes:
- APEX installation and upgrade procedures
- ORDS installation and connection pool tuning
- In-depth authentication and SSO configuration
- REST module design within ORDS
- CI/CD pipelines for APEX application exports
- Advanced page design, theming, or plugin development

Those topics belong in dedicated APEX-focused skill files and documentation.

---

## Sources

- [Oracle APEX Documentation](https://docs.oracle.com/en/database/oracle/apex/)
- [Oracle APEX App Builder Documentation](https://docs.oracle.com/en/database/oracle/apex/24.2/htmdb/)
- [Oracle REST Data Services Documentation](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/)
