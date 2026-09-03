# `enterprise_ru` OCR Repository

## Overview

`database/enterprise_ru` is the Oracle Container Registry repository for Oracle Database Enterprise Edition. Oracle places this repository in the OCR Database business area and provides both a latest pull command and a tags table for selecting specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/enterprise_ru`
- **OCR short description:** Oracle Database Enterprise Edition
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/enterprise_ru` from Oracle Container Registry and pull `container-registry.oracle.com/database/enterprise_ru@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR requires that you accept the Oracle Container Registry Critical Patch Update (CPU) Repository Terms and Restrictions before downloading from this repository.

## What Oracle Documents Here

- The OCR readme describes this repository as Oracle Database Server Release Update 19c Docker image documentation.
- The page states the image runs on Oracle Linux 7 and includes a default multitenant database with one pluggable database.
- OCR covers startup, connections, patching the existing database, and SGA/PGA sizing for this Release Update image line.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page explicitly identifies this repository as the 19c Release Update image line, and the current latest OCR pull command uses the `latest-19` tag stream.

## When to Use / When Not to Use

- **Use this image when:** Use when RU-tagged Enterprise images from the CPU repository stream are required.
- **Use another image when:** Avoid when the non-CPU latest stream is preferred; use enterprise instead.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pulling.
- **Pull:** `docker pull container-registry.oracle.com/database/enterprise_ru:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/enterprise_ru:<tag>`
- **Important:** Use the OCR README example command for the exact environment variables, mounted volumes, and published ports required by this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/enterprise_ru
