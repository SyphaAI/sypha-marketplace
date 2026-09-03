# `cman` OCR Repository

## Overview

`database/cman` is the Oracle Container Registry repository for Oracle Connection Manager. Oracle places this repository in the OCR Database business area and provides both a latest pull command and a tags table for selecting specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/cman`
- **OCR short description:** Oracle Connection Manager
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/cman` from Oracle Container Registry and pull `container-registry.oracle.com/database/cman@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR presents this as a standard Oracle repository. The detail page prompts you to sign in with an Oracle account to accept the repository license agreement before downloading the image.

## What Oracle Documents Here

- The OCR readme describes this image as Oracle Connection Manager running in Linux containers for proxying and managing client database connections.
- The page indicates the container can be used with Oracle RAC or a single-instance Oracle Database, provided the SCAN name or database hostname is resolvable from the container.
- Determine whether the required image is `client-cman` or `cman`, then pin the selected Oracle Container Registry image by digest.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page does not include a dedicated 19c-versus-26ai compatibility matrix for `cman`. Use the OCR tags table on the repository page to select the required image version.

## When to Use / When Not to Use

- **Use this image when:** Use when Oracle Connection Manager is needed as a proxy or gateway layer.
- **Use another image when:** Avoid when clients can connect directly and no proxy tier is necessary.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pulling.
- **Pull:** `docker pull container-registry.oracle.com/database/cman:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/cman:<tag>`
- **Important:** Use the OCR README example command for the exact environment variables, mounted volumes, and published ports required by this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/cman
