# `operator` OCR Repository

## Overview

`database/operator` is the Oracle Container Registry repository for the Oracle Database Operator for Kubernetes. Oracle places this repository in the OCR Database business area and exposes both a latest pull command and a tags table for choosing specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/operator`
- **OCR short description:** This image is part of and for use with the Oracle Database Operator for Kubernetes
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/operator` from Oracle Container Registry and pull `container-registry.oracle.com/database/operator@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR states that the software in this repository is licensed under the Universal Permissive License (UPL).

## What Oracle Documents Here

- The OCR detail page states that this image belongs to and is intended for use with the Oracle Database Operator for Kubernetes.
- The page characterizes the operator as an open-source system that extends the Kubernetes API through custom resources and controllers to automate Oracle Database lifecycle management.
- OCR directs users to the operator readme for installation and usage guidance, and the tags table covers both `latest` and versioned operator releases.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page tracks operator-image releases rather than a 19c-versus-26ai database matrix. Consult the repository tags table and the operator readme to align the operator version with your Kubernetes environment.

## When to Use / When Not to Use

- **Use this image when:** Use when Oracle Database lifecycle is managed through Kubernetes operator patterns.
- **Use another image when:** Avoid when you are not using Kubernetes operator-based operations.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Kubernetes cluster and operator installation prerequisites apply; follow operator docs from OCR.
- **Pull:** `docker pull container-registry.oracle.com/database/operator:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/operator:<tag>`
- **Important:** Use the OCR README example command for exact environment variables, mounted volumes, and published ports for this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/operator
- https://github.com/oracle/oracle-database-operator#readme
