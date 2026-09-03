# Notebook Structure

Jupyter notebooks are JSON documents with the following top-level shape:

- `nbformat` and `nbformat_minor`
- `metadata`
- `cells` (an ordered list of markdown and code cells)

When editing `.ipynb` files programmatically, observe these rules:

- Retain `nbformat` and `nbformat_minor` as they appear in the template.
- Maintain `cells` as an ordered list; do not reorder entries unless explicitly intended.
- For code cells, set `execution_count` to `null` when the value is not known.
- For code cells, initialize `outputs` to an empty list during scaffolding.
- For markdown cells, ensure `cell_type="markdown"` and `metadata={}`.

Use the bundled templates or `scripts/new_notebook.py` for scaffolding rather than hand-writing raw notebook JSON.
