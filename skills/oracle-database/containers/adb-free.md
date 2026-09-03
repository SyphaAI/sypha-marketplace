# `adb-free` OCR Repository

## Overview

`database/adb-free` is the Oracle Container Registry repository for Oracle Autonomous Database Free. Oracle places this repository in the OCR Database business area and provides both a latest pull command and a tags table for selecting specific image versions.

## Repository Snapshot

- **Registry path:** `container-registry.oracle.com/database/adb-free`
- **OCR short description:** Oracle Autonomous Database Free
- **Image selection:** Resolve an exact reviewed digest for `container-registry.oracle.com/database/adb-free` from Oracle Container Registry and pull `container-registry.oracle.com/database/adb-free@sha256:<reviewed-digest>`. Do not use a moving tag.
- **License note on OCR:** OCR states that the software in this repository is licensed under the Oracle Free Use Terms and Conditions provided in the container image.

## What Oracle Documents Here

- The OCR readme states that Oracle Autonomous Database Free supports two workload types: `ADW` and `ATP`.
- The page provides a version matrix showing `latest-23ai` for the 23ai line and `latest` for the 19c line, with specific release tags listed alongside each stream.
- OCR additionally documents container resource requirements of 4 CPUs and 8 GiB memory.

## Oracle Version Notes (19c vs 26ai)

The OCR detail page includes an explicit version matrix: the 23ai stream uses `latest-23ai` and the 19c stream uses `latest`. Refer to that matrix rather than assuming a single default line.

## When to Use / When Not to Use

- **Use this image when:** Use when Autonomous Database Free container workflows (ADW/ATP modes) are required.
- **Use another image when:** Avoid when a generic Database Free runtime is sufficient; use free instead.
- **Cross-image decision aid:** `db/containers/container-selection-matrix.md`

## Prerequisites and Minimal Run Pattern

- **Prerequisite:** Accept OCR repository terms and authenticate to container-registry.oracle.com before pulling.
- **Pull:** `docker pull container-registry.oracle.com/database/adb-free:<tag>`
- **Run pattern:** `docker run --name <name> --rm -it container-registry.oracle.com/database/adb-free:<tag>`
- **Important:** Use the OCR README example command for the exact environment variables, mounted volumes, and published ports required by this image.

## Sources

- https://container-registry.oracle.com/ords/ocr/ba/database/adb-free
- https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-docker-container.html#GUID-03B5601E-E15B-4ECC-9929-D06ACF576857
- https://www.oracle.com/downloads/licenses/oracle-free-license.html
