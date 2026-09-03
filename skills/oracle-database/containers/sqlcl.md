# `sqlcl` OCR Repository

## Overview

`database/sqlcl` is the Oracle Container Registry repository for Oracle SQL Command Line (SQLcl). Oracle places this repository in the OCR Database business area and exposes both a latest pull command and a tags table for choosing specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/sqlcl`
- **OCR short description:** Oracle SQL Command Line (SQLcl)
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/sqlcl` from Oracle Container Registry and pull `container-registry.oracle.com/database/sqlcl@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR states that the software in this repository is licensed under the Oracle Free Use Terms and Conditions provided in the container image.

## What Oracle Documents Here

- The OCR readme identifies this repository as the Oracle SQLcl Docker image and characterizes SQLcl as a free command line interface for Oracle Database.
- The page states that the image ships the most recent SQLcl release and is usable anywhere Docker can run.
- OCR further covers running SQLcl interactively, supplying standard SQLcl options via the `docker run` command line, and mounting `/opt/oracle/sql_scripts` to provide local script access.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page is organized around SQLcl image releases rather than a 19c-versus-26ai database matrix. The page is titled as SQLcl 25.4.2 Docker image documentation, so use the repository tags table to pin the release you require.

## When to Use / When Not to Use

- **Use this image when:** Use for SQLcl-based scripting and CI automation in a containerized CLI.
- **Use another image when:** Avoid when you need ORDS runtime or database server capabilities.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pull.
- **Pull:** `docker pull container-registry.oracle.com/database/sqlcl:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/sqlcl:<tag>`
- **Important:** Use the OCR README example command for exact environment variables, mounted volumes, and published ports for this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/sqlcl
- https://www.oracle.com/database/technologies/appdev/sqlcl.html
- https://www.oracle.com/downloads/licenses/oracle-free-license.html
