# `instantclient` OCR Repository

## Overview

`database/instantclient` is the Oracle Container Registry repository for Oracle Instant Client. Oracle places this repository in the OCR Database business area and exposes both a latest pull command and a tags table for choosing specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/instantclient`
- **OCR short description:** Oracle Instant Client
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/instantclient` from Oracle Container Registry and pull `container-registry.oracle.com/database/instantclient@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR presents this as a standard Oracle repository. The detail page prompts you to sign in with an Oracle account to accept the repository license agreement before downloading the image.

## What Oracle Documents Here

- The OCR readme states that this image bundles the Oracle Instant Client Basic, SDK, and SQL*Plus packages.
- The page indicates that the image can be extended to run OCI, OCCI, and JDBC applications, as well as scripting-language drivers that depend on OCI.
- The OCR detail page provides both `latest` and versioned tags to let you select a particular Instant Client release.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page does not include a dedicated 19c-versus-26ai matrix for `instantclient`. Consult the OCR tags table to select the client version appropriate for your target environment.

## When to Use / When Not to Use

- **Use this image when:** Use when you need Oracle client libraries/tools in a container, not a DB server.
- **Use another image when:** Avoid when you need database instance startup; use free/enterprise/etc.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pull.
- **Pull:** `docker pull container-registry.oracle.com/database/instantclient:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/instantclient:<tag>`
- **Important:** Use the OCR README example command for exact environment variables, mounted volumes, and published ports for this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/instantclient
