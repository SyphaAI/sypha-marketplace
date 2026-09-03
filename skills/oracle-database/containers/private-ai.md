# `private-ai` OCR Repository

## Overview

`database/private-ai` is the Oracle Container Registry repository for Oracle Private AI Services Container. Oracle places this repository in the OCR Database business area and exposes both a latest pull command and a tags table for choosing specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/private-ai`
- **OCR short description:** Oracle Private AI Services Container
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/private-ai` from Oracle Container Registry and pull `container-registry.oracle.com/database/private-ai@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR presents this as a standard Oracle repository. The detail page prompts you to sign in with an Oracle account to accept the repository license agreement before downloading the image.

## What Oracle Documents Here

- The OCR readme covers both non-secure HTTP mode and secure HTTPS-plus-authentication mode for the Private AI Services container.
- The page notes that, beginning with version `25.1.2.0.0`, the image ships scripts that streamline secure and non-secure setup and can be extracted from the image for guided configuration.
- OCR also notes that `25.x.x.x.x` versions of the service support ONNX embedding pipeline models exclusively, and references OML4Py guidance for model conversion.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page specifically calls out 25.x image behavior. It references setup scripts introduced at `25.1.2.0.0` and states that the 25.x service is limited to ONNX embedding pipeline models.

## When to Use / When Not to Use

- **Use this image when:** Use when deploying Oracle Private AI Services container endpoints.
- **Use another image when:** Avoid when you only need a base database runtime without AI service APIs.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pull.
- **Pull:** `docker pull container-registry.oracle.com/database/private-ai:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/private-ai:<tag>`
- **Important:** Use the OCR README example command for exact environment variables, mounted volumes, and published ports for this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/private-ai
- https://docs.oracle.com/en/database/oracle/oracle-database/26/prvai/index.html
- https://docs.oracle.com/en/database/oracle/machine-learning/oml4py/2-23ai/mlpug/convert-pretrained-models-onnx-model-end-end-instructions.html
