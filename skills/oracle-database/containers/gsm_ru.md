# `gsm_ru` OCR Repository

## Overview

`database/gsm_ru` is the Oracle Container Registry repository for Oracle Global Service Manager. Oracle places this repository in the OCR Database business area and exposes both a latest pull command and a tags table for choosing specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/gsm_ru`
- **OCR short description:** Oracle Global Service Manager
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/gsm_ru` from Oracle Container Registry and pull `container-registry.oracle.com/database/gsm_ru@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR states that you must accept the Oracle Container Registry Critical Patch Update (CPU) Repository Terms and Restrictions before downloading from this repository.

## What Oracle Documents Here

- The OCR readme identifies `gsm_ru` as the Global Service Manager image for Oracle Globally Distributed Database within the CPU repository stream.
- The page indicates that the GSM container is necessary to configure Oracle Globally Distributed Database and presents it alongside Release Update database images.
- OCR covers Podman installation, bridge setup, host-file preparation, and container deployment procedures for this repository.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page does not include a dedicated 19c-versus-26ai matrix for `gsm_ru`, but the repository falls under CPU repository terms and the current latest OCR pull command targets the `latest-23` tag stream.

## When to Use / When Not to Use

- **Use this image when:** Use when you need RU-tagged GSM images under CPU terms.
- **Use another image when:** Avoid when non-RU GSM stream is sufficient; use gsm.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pull.
- **Pull:** `docker pull container-registry.oracle.com/database/gsm_ru:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/gsm_ru:<tag>`
- **Important:** Use the OCR README example command for exact environment variables, mounted volumes, and published ports for this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/gsm_ru
- https://docs.oracle.com/en/operating-systems/oracle-linux/podman/toc.htm
