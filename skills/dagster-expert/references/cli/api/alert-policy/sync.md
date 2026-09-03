---
title: dg api alert-policy sync
triggers:
  - "syncing alert policies from YAML definition"
---

Synchronize alert policies against a YAML definition file. The command will create, update, or delete alert policies as needed so that the live configuration matches the definition file.

```bash
dg api alert-policy sync <FILE>
```

- `<FILE>` — path to a YAML file that declares the intended alert policies
