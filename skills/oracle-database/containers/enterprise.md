# `enterprise` OCR Repository

## Overview

`database/enterprise` is the Oracle Container Registry repository for Oracle Database Enterprise Edition. Oracle places this repository in the OCR Database business area and provides both a latest pull command and a tags table for selecting specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/enterprise`
- **OCR short description:** Oracle Database Enterprise Edition
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/enterprise` from Oracle Container Registry and pull `container-registry.oracle.com/database/enterprise@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR presents this as a standard Oracle repository. The detail page prompts you to sign in with an Oracle account to accept the repository license agreement before downloading the image.

## What Oracle Documents Here

- The OCR readme identifies this image as Oracle AI Database Server Release 26ai Enterprise Edition running on Oracle Linux 8.
- The page states the image includes a default database in a multitenant configuration with one pluggable database.
- The OCR documentation addresses startup, connections, data-volume reuse, and SGA/PGA sizing using `INIT_SGA_SIZE` and `INIT_PGA_SIZE`.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page explicitly identifies `enterprise` as the 26ai Enterprise Edition server image. OCR publishes `enterprise_ru` as a separate repository for Release Update container images.

## When to Use / When Not to Use

- **Use this image when:** Use when Oracle AI Database 26ai Enterprise Edition in a container is required.
- **Use another image when:** Avoid when CPU/RU stream patch pinning is needed; use enterprise_ru instead.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pulling.
- **Pull:** `docker pull container-registry.oracle.com/database/enterprise:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/enterprise:<tag>`
- **Important:** Use the OCR README example command for the exact environment variables, mounted volumes, and published ports required by this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/enterprise
