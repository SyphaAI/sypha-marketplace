---
name: skill-creator
description: >-
  Reference guide for building effective skills. This skill should be used when
  users need to create a new skill (or modify an existing skill) that augments
  Sypha's capabilities with specialized knowledge, workflows, or tool integrations.
metadata:
  category: development
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: skill-creator
    license_path: skill-creator/LICENSE.txt
    commit: 92568c1edaff1bde5371154f036d959346c145a8
---

# Skill Creator

This skill provides instructions for building effective skills.

## About Skills

Skills are modular, self-contained packages that expand the agent's capabilities by supplying
specialized knowledge, workflows, and tools. They function as "onboarding guides" for particular
domains or tasks—converting a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can inherently possess.

### What Skills Provide

1. Specialized workflows - Step-by-step procedures tailored to particular domains
2. Tool integrations - Instructions for interacting with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, and business logic
4. Bundled resources - Scripts, references, and assets for complex or repetitive tasks

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

**Metadata Quality:** The `name` and `description` fields in YAML frontmatter control when the agent selects the skill. Be precise about what the skill does and the conditions under which it applies. Write in third-person (e.g. "This skill should be used when..." rather than "Use this skill when...").

#### Bundled Resources (optional)

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that demand deterministic reliability or involve code that gets rewritten repeatedly.

- **When to include**: When the same code recurs across runs or consistent, predictable output is required
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token-efficient, deterministic, and can be run without loading content into context
- **Note**: Scripts may still need to be read by the agent for patching or environment-specific modifications

##### References (`references/`)

Documentation and reference material designed to be pulled into context on demand, guiding the agent's reasoning and actions.

- **When to include**: For documentation that the agent needs to consult during execution
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for the company NDA template, `references/policies.md` for company policies, `references/api_docs.md` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, and detailed workflow guides
- **Benefits**: Keeps SKILL.md concise; content is loaded only when the agent determines it is necessary
- **Best practice**: For large files (>10k words), add grep search patterns to SKILL.md to aid targeted lookup
- **Avoid duplication**: Content should reside in either SKILL.md or references files, never both. Favor references files for detailed information unless it is truly central to the skill—this keeps SKILL.md lean while still making content discoverable without consuming the context window. Restrict SKILL.md to core procedural instructions and workflow guidance; relocate detailed reference material, schemas, and examples to references files.

##### Assets (`assets/`)

Files that are not loaded into context but are incorporated into the output the agent generates.

- **When to include**: When the skill requires files that appear in the final deliverable
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates, `assets/frontend-template/` for HTML/React boilerplate, `assets/font.ttf` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, and sample documents that get copied or modified
- **Benefits**: Cleanly separates output resources from documentation and lets the agent reference files without pulling them into context

### Progressive Disclosure Design Principle

Skills rely on a three-level loading system to keep context usage efficient:

1. **Metadata (name + description)** - Permanently in context (~100 words)
2. **SKILL.md body** - Loaded when the skill activates (<5k words)
3. **Bundled resources** - Fetched as the agent requires them (Unlimited*)

*Unlimited because scripts can be run without being read into the context window.

## Skill Creation Process

To build a skill, follow the "Skill Creation Process" sequentially, skipping steps only when there is a clear reason they do not apply.

### Step 1: Understanding the Skill with Concrete Examples

Skip this step only when the skill's intended usage patterns are already well understood. It remains worthwhile even when iterating on an existing skill.

To build an effective skill, develop a clear understanding of concrete examples that illustrate how the skill will be used. This understanding can originate from direct user examples or from generated examples validated through user feedback.

For instance, when building an image-editor skill, relevant questions include:

- "What functionality should the image-editor skill support? Editing, rotating, anything else?"
- "Can you give some examples of how this skill would be used?"
- "I can imagine users asking for things like 'Remove the red-eye from this image' or 'Rotate this image'. Are there other ways you imagine this skill being used?"
- "What would a user say that should trigger this skill?"

To avoid overwhelming users, limit questions per message. Begin with the most critical ones and follow up incrementally as needed.

Conclude this step once there is a solid grasp of the functionality the skill should support.

### Step 2: Planning the Reusable Skill Contents

To convert concrete examples into an effective skill, examine each example by:

1. Thinking through how to carry out the example from a blank slate
2. Identifying which scripts, references, and assets would aid repeated execution of these workflows

Example: When building a `pdf-editor` skill to handle queries like "Help me rotate this PDF," the analysis reveals:

1. Rotating a PDF means rewriting the same code on every use
2. A `scripts/rotate_pdf.py` script is worth storing in the skill

Example: When designing a `frontend-webapp-builder` skill for queries like "Build me a todo app" or "Build me a dashboard to track my steps," the analysis reveals:

1. Building a frontend webapp requires the same HTML/React boilerplate each time
2. An `assets/hello-world/` template holding the boilerplate HTML/React project files is worth storing in the skill

Example: When building a `big-query` skill to handle queries like "How many users have logged in today?" the analysis reveals:

1. Querying BigQuery requires rediscovering table schemas and relationships on each run
2. A `references/schema.md` file documenting table schemas is worth storing in the skill

To establish the skill's contents, evaluate each concrete example and produce a list of reusable resources to include: scripts, references, and assets.

### Step 3: Initializing the Skill

At this stage, it is time to actually create the skill.

Skip this step only when the skill already exists and the goal is iteration or packaging. In that case, proceed to the next step.

When starting a new skill from scratch, always run the `init_skill.py` script. The script generates a template skill directory that includes everything a skill needs, making the creation process significantly more efficient and reliable.

Usage:

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

The script:

- Creates the skill directory at the specified path
- Generates a SKILL.md template with correct frontmatter and TODO placeholders
- Creates example resource directories: `scripts/`, `references/`, and `assets/`
- Adds example files in each directory that can be adjusted or removed

After initialization, update or delete the generated SKILL.md and example files as appropriate.

### Step 4: Edit the Skill

When editing the skill (whether newly generated or pre-existing), keep in mind that it is being authored for another agent instance to consume. Prioritize information that would be useful and non-obvious to that agent. Think about what procedural knowledge, domain-specific details, or reusable assets would enable another agent instance to execute these tasks more effectively.

#### Start with Reusable Skill Contents

Begin implementation with the reusable resources identified earlier: `scripts/`, `references/`, and `assets/` files. Note that this step may require input from the user. For example, when building a `brand-guidelines` skill, the user may need to supply brand assets or templates for `assets/`, or documentation for `references/`.

Also remove any example files and directories the skill does not need. The initialization script creates example files in `scripts/`, `references/`, and `assets/` to illustrate the structure, but most skills will not require all of them.

#### Update SKILL.md

**Writing Style:** Author the entire skill in **imperative/infinitive form** (verb-first instructions), not second person. Use objective, instructional language (e.g., "To accomplish X, do Y" rather than "You should do X" or "If you need to do X"). This ensures consistency and clarity for AI consumption.

To complete SKILL.md, address the following questions:

1. What is the purpose of the skill, in a few sentences?
2. Under what circumstances should the skill be invoked?
3. In practice, how should the agent apply the skill? All reusable resources developed above should be referenced so the agent knows how to use them.

### Step 5: Packaging a Skill

Once the skill is complete, package it into a distributable zip file for sharing with the user. The packaging process automatically validates the skill beforehand to confirm it satisfies all requirements:

```bash
scripts/package_skill.py <path/to/skill-folder>
```

Optional output directory specification:

```bash
scripts/package_skill.py <path/to/skill-folder> ./dist
```

The packaging script will:

1. **Validate** the skill automatically, checking:
   - YAML frontmatter format and required fields
   - Skill naming conventions and directory structure
   - Description completeness and quality
   - File organization and resource references

2. **Package** the skill if validation succeeds, producing a zip file named after the skill (e.g., `my-skill.zip`) that contains all files and preserves the correct directory structure for distribution.

If validation fails, the script reports the errors and exits without generating a package. Correct any validation errors and rerun the packaging command.

### Step 6: Iterate

After testing, users may ask for improvements. This frequently occurs immediately after using the skill, when the experience of how it performed is still fresh.

**Iteration workflow:**
1. Apply the skill to real tasks
2. Observe any friction or inefficiencies
3. Determine what changes to SKILL.md or bundled resources are warranted
4. Apply the changes and test again
