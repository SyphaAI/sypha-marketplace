---
name: internal-comms
description: >-
  A collection of resources for drafting all varieties of internal
  communications in the formats preferred by the company. The agent should
  invoke this skill whenever asked to produce any kind of internal communication
  — status reports, leadership updates, 3P updates, company newsletters, FAQs,
  incident reports, project updates, and similar content.
metadata:
  category: business
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: internal-comms
    license_path: internal-comms/LICENSE.txt
    commit: 92568c1edaff1bde5371154f036d959346c145a8
---

## When to use this skill
Apply this skill when drafting any of the following internal communications:
- 3P updates (Progress, Plans, Problems)
- Company newsletters
- FAQ responses
- Status reports
- Leadership updates
- Project updates
- Incident reports

## How to use this skill

To author any internal communication:

1. **Determine the communication type** from the request
2. **Load the relevant guideline file** from the `examples/` directory:
    - `examples/3p-updates.md` - For Progress/Plans/Problems team updates
    - `examples/company-newsletter.md` - For company-wide newsletters
    - `examples/faq-answers.md` - For answering frequently asked questions
    - `examples/general-comms.md` - For any content that does not explicitly match one of the above
3. **Apply the specific instructions** in that file regarding formatting, tone, and content gathering

When the communication type does not align with any existing guideline, ask for clarification or additional context about the expected format.

## Keywords
3P updates, company newsletter, company comms, weekly update, faqs, common questions, updates, internal comms
