---
name: data-quality-frameworks-sickn33
description: >-
  Set up data quality validation using Great Expectations, dbt tests, and data
  contracts. Trigger when constructing data quality pipelines, adding validation
  rules, or establishing data contracts.
metadata:
  upstream:
    risk: unknown
    source: community
    date_added: '2026-02-27'
  category: data
  source:
    repository: 'https://github.com/sickn33/antigravity-awesome-skills'
    path: skills/data-quality-frameworks
    license_path: LICENSE
    commit: bdce4fc3ce8899e7c1133204e5825955a7f940da
---

# Data Quality Frameworks

Production-ready patterns for enforcing data quality through Great Expectations, dbt tests, and data contracts to keep data pipelines reliable.

## Use this skill when

- Adding data quality checks to pipelines
- Configuring Great Expectations validation
- Constructing comprehensive dbt test suites
- Defining data contracts between teams
- Tracking data quality metrics over time
- Integrating automated data validation into CI/CD

## Do not use this skill when

- Data sources are undefined or inaccessible
- Validation rules or schemas cannot be modified
- The task has no relation to data quality or contracts

## Instructions

- Pinpoint critical datasets and the quality dimensions that apply to them.
- Specify expectations/tests and contract rules.
- Integrate validation into CI/CD and schedule recurring checks.
- Configure alerting, assign ownership, and document remediation steps.
- For detailed patterns and templates, open `resources/implementation-playbook.md`.

## Safety

- Do not block critical pipelines without first establishing a fallback plan.
- Ensure sensitive data is handled securely within validation outputs.

## Resources

- `resources/implementation-playbook.md` — detailed frameworks, templates, and examples.

## Limitations
- Apply this skill only when the task falls clearly within the scope described above.
- Do not substitute the output for environment-specific validation, testing, or expert review.
- Pause and request clarification if required inputs, permissions, safety boundaries, or success criteria are absent.
