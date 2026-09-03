# Manual Notebook Editing And Execution

Fall back to this approach only when no suitable Jupyter MCP connection is available or an MCP operation fails. Notify the user that manual notebook tooling is being used because MCP is unavailable.

## Tool And Dependency Checks

Verify only what the requested operation requires. Never install packages silently.

```bash
# Required for scaffolding and raw JSON editing
python3 --version

# Required only for local notebook execution
command -v jupyter
jupyter --version
jupyter kernelspec list
```

The shell's `python3` may not match the selected notebook kernel. For package verification, use the interpreter associated with that kernel. When needed, inspect kernel specifications:

```bash
jupyter kernelspec list --json
```

If a required dependency is absent:

- Proceed with any work that does not depend on it.
- Identify which operation is blocked and specify the missing command or package.
- Request that the user install system-level tools unless installation was explicitly part of the task.
- Favor a project virtual environment over a global installation.
- Do not install optional packages until the notebook being worked on actually requires them.

Typical macOS installation commands:

```bash
brew install jupyterlab
python3 -m pip install pandas matplotlib
```

After installation, re-run the checks and confirm the selected kernel uses the environment where packages were installed.

## New Notebook Scaffolding

For a new notebook, use the bundled standard-library helper. Resolve its path relative to the base directory provided when the skill is loaded; do not assume a project-local or globally installed location.

```bash
python3 "<SKILL_BASE_DIR>/scripts/new_notebook.py" \
  --kind experiment \
  --title "Compare housing variables" \
  --out "housing-analysis.ipynb"
```

Use `--kind tutorial` for instructional content. The helper declines to overwrite an existing file unless `--force` is provided. Only pass `--force` when replacement was explicitly requested.

Templates, relative to the skill base directory:

- `assets/experiment-template.ipynb`
- `assets/tutorial-template.ipynb`

The helper depends only on Python's standard library, updates the title, creates fresh cell IDs, and outputs valid notebook JSON. Apply templates only when creating new notebooks.

## Local Execution

To run all code cells and write their outputs back into the same notebook:

```bash
jupyter nbconvert --to notebook --execute --inplace "notebook.ipynb"
```

This modifies execution counts and outputs for all code cells. Run this only when the user explicitly asks to execute the notebook or refresh its results.

After execution:

- Check the command's exit status.
- Confirm expected outputs are present and inspect any saved cell errors.
- Summarize relevant outputs concisely.
- Do not report the notebook as having run if only individual code snippets were executed with `python3`.

If `jupyter` is unavailable, flag execution as blocked and supply the relevant installation command.

## Data And Visualizations

When exploring CSV data:

- Resolve data paths relative to the notebook's working directory.
- Use packages that are already installed where possible.
- Reach for `pandas` and `matplotlib` when they are available and appropriate.
- Preview the data and its dimensions before generating plots.
- Select a small number of meaningful visuals rather than charting every column.
- Include brief Markdown explanations surrounding charts.
- Use legible titles, axis labels, figure sizes, and restrained color choices.
- Call `plt.show()` so figures are rendered and captured during execution.

Before importing a package in generated cells, confirm it is accessible to the selected notebook kernel — not just to the shell's default Python environment.

## Core Rule

An `.ipynb` file is JSON. Always edit the notebook data model directly — never a rendered approximation such as `<code_cell>` or `<markdown_cell>` tags.

Some file-reading tools display notebooks as simplified cell representations rather than their raw bytes. Do not interpret that rendering as a sign that the file is malformed. Access the exact on-disk content as plain text:

```bash
python3 -c 'from pathlib import Path; print(Path("notebook.ipynb").read_text(), end="")'
```

Read the current on-disk JSON immediately before every edit to avoid overwriting concurrent user changes.

## Limitations

Editing raw JSON requires no Jupyter server, MCP connection, or active kernel. However, be aware that:

- The JSON must remain syntactically valid.
- Cell `source` is typically an array of strings containing explicit newline characters.
- Modifying `outputs` affects only the stored output, not the live kernel state.
- Changing `kernelspec` records a setting preference; it does not install or activate that kernel.
- Do not edit through the notebook UI and raw JSON at the same time, as one editor may overwrite the other's changes.
- Refrain from direct editing while a remote server or another user has the notebook open for modification.

## Notebook Structure

A valid notebook has this general shape:

```json
{
  "cells": [],
  "metadata": {
    "kernelspec": {
      "display_name": "Python 3",
      "language": "python",
      "name": "python3"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 5
}
```

A code cell requires:

```json
{
  "cell_type": "code",
  "execution_count": null,
  "id": "unique-id",
  "metadata": {},
  "outputs": [],
  "source": [
    "print(3 + 3)"
  ]
}
```

A Markdown cell requires:

```json
{
  "cell_type": "markdown",
  "id": "unique-id",
  "metadata": {},
  "source": [
    "# Heading"
  ]
}
```

Assign a unique short hexadecimal ID to each new cell, for example via `secrets.token_hex(4)`. Leave existing cell IDs unchanged.

## Safe Editing Workflow

1. If the user did not supply a path, locate the target notebook.
2. Read its literal JSON immediately before making any changes.
3. Parse it using Python's built-in `json` module.
4. Change only the requested cell or position in `data["cells"]`.
5. Leave every unrelated cell, output, execution count, metadata field, and unknown field untouched.
6. Write the result as valid JSON with a trailing newline.
7. Validate the output with `python3 -m json.tool`.
8. If execution was requested, run only after the edit has passed validation.

Prefer a small Python transformation over manually rewriting the entire notebook:

```bash
python3 -c '
import json, secrets
from pathlib import Path

path = Path("notebook.ipynb")
data = json.loads(path.read_text())
data["cells"].insert(2, {
    "cell_type": "code",
    "execution_count": None,
    "id": secrets.token_hex(4),
    "metadata": {},
    "outputs": [],
    "source": ["print(\"Middle\")"]
})
path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
'
python3 -m json.tool "notebook.ipynb" >/dev/null
```

Interpret references such as "block 2" or "cell 2" as one-based unless the surrounding context makes another indexing scheme explicit. Review adjacent cells before inserting.

## Editing Existing Code

When appending a line to an existing code cell:

- Update only that cell's `source` array.
- Include `\n` between source lines so statements remain separated.
- Retain existing saved outputs unless the user asks to clear them or explicitly requests execution.
- Note that saved output will be stale until the cell or notebook is executed.

Example:

```json
"source": [
  "print(8 + 8)\n",
  "print(6 + 6)"
]
```

## Preservation And Concurrency

Notebook editors may commit changes while the agent is active. Re-read the file immediately before each transformation. Never overwrite the notebook with stale content captured earlier in the session.

Avoid the following:

- Replacing notebook JSON with pseudo-XML cell tags.
- Reconstructing all cells when a targeted JSON mutation is sufficient.
- Deleting saved outputs, metadata, or IDs unless explicitly requested.
- Manually renumbering execution counts.
- Fabricating rendered outputs; execute the notebook to produce them.
- Treating a notebook-aware rendered view as confirmation of the literal on-disk syntax.

## Validation

For an edit-only request:

```bash
python3 -m json.tool "notebook.ipynb" >/dev/null
```

For an execution request, also check code cells for errors:

```bash
python3 -c '
import json
from pathlib import Path

data = json.loads(Path("notebook.ipynb").read_text())
errors = [
    output
    for cell in data["cells"]
    for output in cell.get("outputs", [])
    if output.get("output_type") == "error"
]
if errors:
    raise SystemExit("Notebook contains execution errors")
print("Notebook executed without saved errors")
'
```

Report which cells were modified, whether JSON validation passed, whether execution was performed, and whether outputs were persisted.
