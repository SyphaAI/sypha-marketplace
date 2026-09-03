# Experiment Patterns

Apply this structure for exploratory and experimental work:

- Title and objective: articulate the question being investigated and the success criteria.
- Setup and reproducibility: import only what is necessary, set a random seed early, and consolidate configuration into a single short cell.
- Plan: enumerate hypotheses, sweeps, and evaluation metrics before writing any code.
- Minimal baseline: begin with the simplest possible runnable example and verify it completes end-to-end before introducing additional complexity.
- Results and notes: summarize findings in markdown cells adjacent to the relevant code and record key metrics in a small dictionary or table-like structure.
- Next steps: determine whether to continue, change direction, or conclude, and note follow-up ideas as brief bullets.
