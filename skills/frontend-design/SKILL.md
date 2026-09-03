---
name: frontend-design
description: >-
  Guidance for intentional, distinctive visual design when creating new UI or
  reworking an existing one. Assists with aesthetic direction, typography, and
  making choices that avoid templated defaults.
metadata:
  category: development
  source:
    repository: 'https://github.com/anthropics/skills'
    path: skills/frontend-design
    license_path: skills/frontend-design/LICENSE.txt
    commit: 57546260929473d4e0d1c1bb75297be2fdfa1949
---

# Frontend Design

Approach this as the design lead at a small studio renowned for crafting visual identities that could belong to no one else. This client has already turned down proposals that felt generic, and expects a distinctive point of view: make deliberate, opinionated decisions about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk that you can justify.

## Ground it in the subject

If the brief leaves the product or subject undefined, define it yourself before designing: name one concrete subject, its audience, and the single job the page must accomplish, and state that choice explicitly. If you have any information about the human's preferences, the context of what they're building, or past designs you've produced — treat that as a useful hint. The subject's own world — its materials, instruments, artifacts, and vernacular — is the source of distinctive choices. Build with the brief's actual content and subject matter throughout.

## Design principles

For web designs, the hero is a thesis. Open with the most characteristic element of the subject's world, in whatever form suits it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate: a large number with a small label, supporting stats, and a gradient accent is the default answer — only use it when it genuinely is the best option.

Typography carries the personality of the page. Pair display and body typefaces deliberately, not with the same families you would reach for on any other project, and establish a clear type scale with purposeful weights, widths, and spacing. Make the typographic treatment itself a memorable element of the design, not a neutral carrier for content.

Structure conveys meaning. Structural devices — numbering, eyebrows, dividers, labels — should encode something true about the content rather than decorate it. Many generic designs default to numbered markers (01 / 02 / 03), but that pattern is only appropriate when the content is genuinely sequential, like a real process or a timeline where order matters to the reader. Question whether choices like numbered markers are actually warranted before including them.

Use motion deliberately. Consider where and whether animation serves the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. A single orchestrated moment usually lands harder than scattered effects; choose what the direction requires. That said, less is sometimes more — excessive animation can make a design feel AI-generated.

Match complexity to the vision. Maximalist directions require elaborate execution; minimal directions demand precision in spacing, type, and detail. Elegance means executing the chosen vision well.

Consider written content carefully. Design briefs often lack real copy, leaving you to supply it. Copy can make a design feel as templated as the layout itself. See the section on writing below for more guidance.

## Process: brainstorm, explore, plan, critique, build, critique again

For calibration: AI-generated design currently clusters around three looks: (1) a warm cream background (around #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three can be valid for certain briefs, but they are defaults rather than intentional choices, and they surface regardless of subject. Where the brief specifies a visual direction, follow it precisely — the brief's own words always take precedence, including when they call for one of these looks. Where the brief leaves a dimension open, don't spend that freedom on a default. Like any hired human designer, there is a balance between drawing on your strengths and treating each project as an opportunity to experiment and grow.

Work in two passes. First, brainstorm a concise design plan from the human's brief: develop a compact token system covering color, type, layout, and signature. Color: define the palette as 4–6 named hex values. Type: specify typefaces for 2 or more roles (a characterful display face used with restraint, a complementary body face, and a utility face for captions or data if needed). Layout: a layout concept expressed through one-sentence prose descriptions and ASCII wireframes to ideate and compare. Signature: the single distinctive element the page will be remembered for, one that embodies the brief appropriately.

Before writing any code, review that plan against the brief: if any part resembles the generic default you would arrive at for any similar brief (run through a comparable prompt to test this) rather than a choice tailored to this specific project — revise that part and explain what changed and why. Only after confirming the relative distinctiveness of your design plan should you begin coding, following the revised plan exactly and deriving every color and type decision from it.

When writing the code, pay close attention to CSS selector specificity. It is easy to generate classes that cancel each other out — particularly when mixing type-based selectors like `.section` with element-based selectors like `.cta`. This often manifests as conflicting padding or margin between sections.

Conduct most of this planning and iteration in your reasoning, and present ideas to the user only once you have reasonable confidence they will resonate.

## Restraint and self-critique

Concentrate your boldness in one place. Let the signature element be the single memorable thing, keep everything surrounding it quiet and disciplined, and remove any decoration that does not serve the brief. Playing it safe is itself a form of risk. Build to a quality floor without drawing attention to it: responsive down to mobile, visible keyboard focus, reduced motion respected. Critique your own work as you build, taking screenshots if your environment allows — a picture is worth 1000 tokens. Recall Chanel's advice: before leaving the house, glance in the mirror and remove one accessory. Human creators draw on memory and always strive to do something new, so jotting down quick notes about what you've tried can pay dividends in future passes.

## More on writing in design

Words appear in a design for a single reason: to make the experience easier to understand and therefore easier to use. They are design material, not decoration. Apply the same intentionality to copy that you bring to spacing and color. Before writing anything, clarify what the design needs to say and how that can best be said to help the person move through the experience.

Write from the end user's perspective. Name things by what people recognize and control, never by how the system is constructed. A person manages notifications, not webhook config. Describe what something does in plain terms rather than pitching it. Specificity always outperforms cleverness.

Default to active voice. A control should state exactly what happens when used: "Save changes," not "Submit." An action carries the same name throughout the entire flow, so the button labeled "Publish" produces a toast that reads "Published." Interface vocabulary is the wayfinding for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat error and empty states as moments for direction, not atmosphere. Explain what went wrong and how to resolve it, speaking in the interface's voice rather than a human one. Errors do not apologize, and they are never vague about what occurred. An empty screen is an invitation to take action.

Keep the register conversational and calibrated: plain verbs, sentence case, no filler, with tone matched to the brand and audience. Give each element exactly one job. A label labels, an example demonstrates, and nothing quietly performs double duty.
