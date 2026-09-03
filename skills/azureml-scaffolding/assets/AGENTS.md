# AGENTS.md

ML project built on a layered MLOps approach — reproducible from experimentation through
production. Whatever runs locally runs the same way in the cloud, with no surprises. Three
concentric layers, where inner layers have no knowledge of outer ones:

1. **Code** — *the what.* Pure Python packages under `src/`. Business logic only, no platform
   imports, no CLI tools, no infra awareness.
1. **Specification** — *the how.* `aml-job.yaml` per package. Declares how code executes on a
   compute platform. Lives next to the code it describes but never leaks into it.
1. **Orchestration** — *the when.* `Makefile`, CI. Triggers execution. Knows about specs, knows
   nothing about code internals.

```
├── Makefile                # single entry point — `make help` for commands
├── pyproject.toml          # uv workspace root, dev deps only
├── uv.lock                 # committed lockfile
├── .env                    # env var template (committed, safe defaults)
├── .env.local              # real values per developer (gitignored)
└── src/
    └── <package>/
        ├── pyproject.toml
        ├── aml-job.yaml
        ├── src/<package>/
        └── tests/
```

The **Makefile** is the sole entry point for all local execution. Run `make help` to see the
current list of available commands. `.env` documents which variables the project needs; `.env.local`
(gitignored) holds the real values for each developer.

For a deeper understanding of why this project is structured this way, see the `azureml-scaffolding`
skill.
