---
name: artifacts-builder
description: >-
  Toolset for constructing elaborate, multi-component HTML artifacts with modern
  frontend web technologies (React, Tailwind CSS, shadcn/ui). Designed for
  complex artifacts that require state management, routing, or shadcn/ui components
  - not for simple single-file HTML/JSX artifacts.
metadata:
  category: development
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: artifacts-builder
    license_path: artifacts-builder/LICENSE.txt
    commit: 92568c1edaff1bde5371154f036d959346c145a8
---

# Artifacts Builder

Creating powerful frontend HTML artifacts follows these steps:
1. Set up the frontend repo with `scripts/init-artifact.sh`
2. Build the artifact by editing the generated code
3. Combine all code into one HTML file with `scripts/bundle-artifact.sh`
4. Show the artifact to the user
5. (Optional) Test the artifact

**Stack**: React 18 + TypeScript + Vite + Parcel (bundling) + Tailwind CSS + shadcn/ui

## Design & Style Guidelines

VERY IMPORTANT: To avoid what is commonly referred to as "AI slop", do not use excessive centered layouts, purple gradients, uniform rounded corners, or the Inter font.

## Quick Start

### Step 1: Initialize Project

Create a new React project by running the initialization script:
```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

This produces a fully configured project containing:
- ✅ React + TypeScript (via Vite)
- ✅ Tailwind CSS 3.4.1 with the shadcn/ui theming system
- ✅ Path aliases (`@/`) already configured
- ✅ 40+ shadcn/ui components installed out of the box
- ✅ All Radix UI dependencies included
- ✅ Parcel set up for bundling (via .parcelrc)
- ✅ Node 18+ compatibility (auto-detects and pins Vite version)

### Step 2: Develop Your Artifact

Develop the artifact by modifying the generated files. See **Common Development Tasks** below for details.

### Step 3: Bundle to Single HTML File

To package the React app into a single HTML artifact:
```bash
bash scripts/bundle-artifact.sh
```

The output is `bundle.html` — a self-contained artifact with all JavaScript, CSS, and dependencies inlined. This file can be shared directly in Sypha sessions as an artifact.

**Requirements**: An `index.html` must exist in the project root directory.

**What the script does**:
- Installs bundling dependencies (parcel, @parcel/config-default, parcel-resolver-tspaths, html-inline)
- Generates a `.parcelrc` config with path alias support
- Executes a Parcel build (without source maps)
- Uses html-inline to embed all assets into a single HTML file

### Step 4: Share Artifact with User

Present the bundled HTML file in the conversation so the user can view it as an artifact.

### Step 5: Testing/Visualizing the Artifact (Optional)

Note: This step is entirely optional. Perform it only when necessary or explicitly requested.

For testing or visualizing the artifact, use the tools available (other Skills or built-in tools such as Playwright or Puppeteer). In general, skip upfront testing because it adds latency before the finished artifact is delivered. Test after presenting the artifact, if requested or if issues arise.

## Reference

- **shadcn/ui components**: https://ui.shadcn.com/docs/components
