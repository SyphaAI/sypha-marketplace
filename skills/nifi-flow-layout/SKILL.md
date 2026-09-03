---
name: nifi-flow-layout
description: >-
  Use when arranging Apache NiFi processors, process groups, ports, comments,
  numbering, crossing connections, dense fan-in/fan-out, or reusable readable
  canvas layouts.
metadata:
  category: data
  source:
    repository: 'https://github.com/AlekseiSeleznev/nifi-mcp-universal'
    path: skills/nifi-flow-layout
    license_path: LICENSE
    commit: 6893d6865bcdc6dcd4a2054ac7e3f43a07bf1cbb
---

# NiFi Flow Layout

Apply this universal skill whenever an Apache NiFi flow needs to remain understandable a year from now: descriptive names, meaningful comments, a compact vertical layout, and connections that never cross over blocks. The skill carries no environment-specific defaults: supply the NiFi URL, credentials/certificates, and target process group explicitly every time.

## Workflow

1. **Inspect first**
   - Read the target process group through NiFi REST.
   - Save a JSON snapshot before changing anything.
   - Run audit/dry-run before `apply`.

2. **Apply the house style**
   - Main route goes top-to-bottom.
   - Input/source nodes go to the top boundary; output/terminal sinks go to the bottom boundary.
   - Errors/logs/fallback/notification branches go to a side lane.
   - Connections are orthogonal: vertical/horizontal, no diagonals.
   - Connection names stay empty. Connections do not support comments in NiFi.
   - Every commentable object gets a useful human comment: processor, process group, input port, output port.
   - Names use hierarchical numbering: `10`, `20`, `30`, then `30.10`, `30.20`, then `30.20.10`. Never use `.00`.
   - Reposition processors/ports before routing long detours. A better node position is preferable to a large route rectangle.

3. **Verify visually**
   - Use Playwright when available to capture real DOM bounding boxes and a screenshot.
   - Treat route/label overlap with processors, process groups, ports, or queued boxes as a defect.

## Scripts

- `scripts/nifi_layout.py` — REST audit, dry-run, apply, geometry tests.
- `scripts/nifi_visual_check.cjs` — Playwright screenshot and DOM bounding-box capture.
- `references/layout-rules.md` — detailed rules and routing decisions.

## Typical commands

```bash
python3 scripts/nifi_layout.py \
  --base-url https://nifi.example.com/nifi-api \
  --group-id <process-group-id> \
  --cert /path/client.crt --key /path/client.key \
  --mode audit --recursive
```

```bash
python3 scripts/nifi_layout.py \
  --base-url https://nifi.example.com/nifi-api \
  --group-id <process-group-id> \
  --cert /path/client.crt --key /path/client.key \
  --mode dry-run --recursive --backup-dir ./nifi-backups
```

```bash
python3 scripts/nifi_layout.py \
  --base-url https://nifi.example.com/nifi-api \
  --group-id <process-group-id> \
  --cert /path/client.crt --key /path/client.key \
  --mode apply --recursive --backup-dir ./nifi-backups
```

## Non-negotiable visual rules from real reviews

- Confirm results with Playwright screenshots after every change; REST geometry alone is insufficient.
- Observe boundary-aware layering: sources at top, business processors in the middle, terminal outputs at the bottom.
- Before introducing bends, attempt to relocate the source or destination into a cleaner layer or a nearer side lane.
- Do not leave a large empty area on one side of the canvas while the other side is congested with route loops.
- For dense fan-in, evaluate all viable target sides. Do not force all branches into a single side or a single shared point.
- Dense fan-in must remain local and comb-shaped. Do not push a sink far away simply to satisfy route scoring.
- When a lower source would cross the central bus or labels when entering from the left, try right-side entry — but only after verifying the full candidate route for component and label blockers.
- Treat connection labels as physical obstacles. Lines must not pass through `Name`/`Queued` boxes, even if they do not touch any processor.
- Side handler return paths must avoid queue labels between main-lane processors. Use a clear side or bottom lane rather than a short route hidden under labels.
- Side handler → output port connections should not introduce tiny doglegs when the output centerline is unobstructed; prefer the compact side route.
- Always inspect screenshots across the entire affected area, not just one cropped defect. If the flow exceeds a viewport, pan/scroll and capture additional screenshots.

## Safety rules

- Do not output secrets or certificate passphrases.
- Do not modify processor business properties unless the user has explicitly requested it.
- Default to `audit`/`dry-run`; switch to `apply` only when implementation has been requested.
- Preserve revisions and current processor state; restrict updates to names, comments, positions, connection bends, labelIndex, and empty connection names.
- Always write a backup flow JSON via `--backup-dir` before running `apply`.

## Review hardening additions

- `scripts/nifi_layout.py` supports `--single-group`, `--group-order top-down`, `--report-dir`, `--screenshots-dir`, `--visual-gate`, and PKCS#12 auth via `--p12`.
- Apply mode is state-preserving by default: processor/port metadata updates do not halt running components; connection updates first attempt to proceed without stopping, and only stop the two endpoint components (when the connection queue is empty) on retry.
- `scripts/nifi_visual_check.cjs` supports `--tile-grid CxR` and `--tile-dir` for large-canvas evidence capture.
- Dense fan-in, same-column side chains, side-column handler returns, tight label packing, 12px visual label/component clearance, and 32px visual line spacing are all addressed to prevent merged wires, processor overlaps, queued-label overlaps, and near-touching lines.
- Visual X/T line crossings are treated as hard defects; use wider bus lanes instead of ambiguous intersections.
- Non-adjacent segments of the same connection must also maintain wide spacing; self-overlapping U-turns are defects.
- Reports include `topology_blockers` whenever a clean visual layout likely requires a structural decision, such as introducing a funnel, collector processor, split sink, or separate process group.
