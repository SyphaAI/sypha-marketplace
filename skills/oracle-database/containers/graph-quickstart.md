# `graph-quickstart` OCR Repository

## Overview

`database/graph-quickstart` is the Oracle Container Registry repository for getting started with the Property Graph feature of Oracle AI Database 26ai. Oracle places this repository in the OCR Database business area and provides both a latest pull command and a tags table for selecting specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/graph-quickstart`
- **OCR short description:** Get started with the Property Graph feature of Oracle AI Database 26ai
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/graph-quickstart` from Oracle Container Registry and pull `container-registry.oracle.com/database/graph-quickstart@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR presents this as a standard Oracle repository. The detail page prompts you to sign in with an Oracle account to accept the repository license agreement before downloading the image.

## What Oracle Documents Here

- The OCR readme identifies this as the Oracle Graph Quickstart container image for the Property Graph feature of Oracle AI Database 26ai.
- The page states the image includes Oracle AI Database 26ai Free, a preconfigured `GRAPHUSER`, and a sample SQL Property Graph.
- OCR also notes that this image is not intended for production workloads and is based on the Oracle AI Database 26ai Free container image (Lite).

## Oracle Version Notes (19c vs 26ai)

This repository is explicitly scoped to Oracle AI Database 26ai. The OCR readme states the image is based on the 26ai Free container image and is not suitable for production workloads.

## When to Use / When Not to Use

- **Use this image when:** Use for rapid Property Graph exploration and demos on 26ai.
- **Use another image when:** Avoid for production workloads; apply supported production deployment patterns instead.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pulling.
- **Pull:** `docker pull container-registry.oracle.com/database/graph-quickstart:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/graph-quickstart:<tag>`
- **Important:** Use the OCR README example command for the exact environment variables, mounted volumes, and published ports required by this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/graph-quickstart
- https://docs.oracle.com/en/database/oracle/property-graph/index.html
