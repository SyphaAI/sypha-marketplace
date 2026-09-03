---
name: jupyter-notebook
description: >-
  Apply whenever the user is working with Jupyter notebooks (`.ipynb`),
  whether creating, inspecting, editing, executing, or visualizing notebook
  content for experiments, explorations, or tutorials.
license: MIT
metadata:
  category: development
  author: Sypha
  suggest_for:
    filename:
      - '*.ipynb'
    vscode_extension:
      - name: Jupyter
        id: ms-toolsai.jupyter
  source:
    repository: 'https://github.com/Sypha-Org/skills'
    path: skills/jupyter-notebook
    license_path: LICENSE
---

# Jupyter Notebook Skill

Produce clean, reproducible Jupyter notebooks for two primary modes:

- Experiments and exploratory analysis
- Tutorials and teaching-oriented walkthroughs

Use the bundled templates and helper script to maintain consistent structure and reduce raw JSON errors.

## When to use
- Starting a new `.ipynb` notebook from scratch.
- Inspecting notebook cells, outputs, metadata, dependencies, or execution state.
- Adding, removing, reordering, or modifying code and Markdown cells.
- Running notebooks, refreshing saved outputs, or diagnosing kernel failures.
- Building or improving notebook tables, charts, and other visualizations.
- Transforming rough notes or scripts into a structured notebook.
- Refactoring an existing notebook to improve reproducibility and readability.
- Constructing experiments or tutorials intended to be read or re-run by others.

## Decision tree
- If the request is exploratory, analytical, or hypothesis-driven, select `experiment`.
- If the request is instructional, step-by-step, or audience-targeted, select `tutorial`.
- If modifying an existing notebook, approach it as a refactor: retain the original intent and enhance the structure.

## Choose the notebook tooling

Before inspecting, editing, or executing a notebook, verify whether suitable Jupyter MCP tools are available.

- Give preference to a connected Jupyter MCP server for all notebook operations.
- If Jupyter MCP is unavailable or an MCP operation fails, clearly inform the user that you are falling back to manual notebook editing.
- Consult `references/manual-editing.md` before making any direct edits to raw notebook JSON.
- Do not mix MCP operations and manual JSON editing for the same change.

## Workflow
1. Establish the intent.
Determine the notebook kind: `experiment` or `tutorial`.
Define the objective, audience, and the completion criteria.

2. Scaffold from the template.
Use the helper script rather than hand-authoring raw notebook JSON. Resolve `scripts/new_notebook.py` relative to the base directory provided when this skill is loaded; do not assume the skill resides under the project's `.sypha` directory.

```bash
python3 "<SKILL_BASE_DIR>/scripts/new_notebook.py" \
  --kind experiment \
  --title "Compare prompt variants" \
  --out "compare-prompt-variants.ipynb"
```

```bash
python3 "<SKILL_BASE_DIR>/scripts/new_notebook.py" \
  --kind tutorial \
  --title "Intro to embeddings" \
  --out "intro-to-embeddings.ipynb"
```

3. Populate the notebook with small, executable steps.
Scope each code cell to a single step.
Include brief markdown cells that describe the purpose and expected outcome.
Suppress large or noisy outputs when a short summary conveys the same information.

4. Apply the appropriate pattern.
For experiments, follow `references/experiment-patterns.md`.
For tutorials, follow `references/tutorial-patterns.md`.

5. Edit carefully when working with existing notebooks.
Maintain the notebook structure; do not reorder cells unless the narrative flow clearly benefits.
Make targeted edits rather than full rewrites.
When raw JSON editing is necessary, follow `references/manual-editing.md`.

6. Validate the result.
Execute the notebook from top to bottom whenever the environment permits.
If execution is not feasible, state that explicitly and describe how to validate locally.
Apply the final review checklist in `references/quality-checklist.md`.

## Templates and helper script
- Templates are stored in `assets/experiment-template.ipynb` and `assets/tutorial-template.ipynb`.
- The helper script reads a template, updates the title cell, and produces a ready-to-use notebook.

## Temp and output conventions
- Write intermediate files to the system temporary directory and remove them when no longer needed.
- Store the final notebook in the location the user specified, or in the current project directory when no location is given.
- Use stable, descriptive filenames (for example, `ablation-temperature.ipynb`).

## Dependencies (install only when needed)

Optional Python packages for running notebooks locally:

```bash
python3 -m pip install jupyterlab ipykernel
```

The bundled scaffold script relies solely on the Python standard library and requires no additional dependencies.

## Environment
No environment variables are required.

## Reference map
- `references/experiment-patterns.md`: experiment structure and heuristics.
- `references/tutorial-patterns.md`: tutorial structure and teaching flow.
- `references/notebook-structure.md`: notebook JSON shape.
- `references/manual-editing.md`: manual editing and execution fallback when Jupyter MCP is unavailable.
- `references/quality-checklist.md`: final validation checklist.
