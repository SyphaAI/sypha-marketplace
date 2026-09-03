---
title: dg list envs
triggers:
  - "seeing which environment variables the project requires"
---

Display environment variables from the `.env` file of the current project. Reports each variable's name, whether it is locally defined, and which components reference it.

```bash
dg list envs
```

When authenticated with Dagster Plus (`dg plus login`), also displays deployment scope status (Dev/Branch/Full).
