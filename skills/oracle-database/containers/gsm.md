# `gsm` OCR Repository

## Overview

`database/gsm` is the Oracle Container Registry repository for Oracle Global Service Manager. Oracle places this repository in the OCR Database business area and provides both a latest pull command and a tags table for selecting specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/gsm`
- **OCR short description:** Oracle Global Service Manager
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/gsm` from Oracle Container Registry and pull `container-registry.oracle.com/database/gsm@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR presents this as a standard Oracle repository. The detail page prompts you to sign in with an Oracle account to accept the repository license agreement before downloading the image.

## What Oracle Documents Here

- The OCR readme describes `gsm` as the Oracle Global Service Manager container for Oracle Globally Distributed Database on container.
- The page states that the GSM container is required to configure Oracle Globally Distributed Database.
- The OCR documentation guides you through Podman installation, network creation, host-file setup, and catalog-container deployment.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page does not include a dedicated 19c-versus-26ai matrix for `gsm`. Use the OCR tags table to select the required image version, or choose `gsm_ru` if the CPU repository stream is needed.

## When to Use / When Not to Use

- **Use this image when:** Use when deploying Oracle Globally Distributed Database where GSM is required.
- **Use another image when:** Avoid when RU stream tagging is needed; use gsm_ru instead.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pulling.
- **Pull:** `docker pull container-registry.oracle.com/database/gsm:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/gsm:<tag>`
- **Important:** Use the OCR README example command for the exact environment variables, mounted volumes, and published ports required by this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/gsm
- https://docs.oracle.com/en/operating-systems/oracle-linux/podman/toc.htm
