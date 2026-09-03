# NiFi layout rules

## Names

- Apply Russian names when the flow serves Russian-speaking operators.
- Prefix top-level stages with `10`, `20`, `30`, `90`.
- Extend the parent number to prefix nested stages: `30.10`, `30.20`, `30.20.10`.
- Never use `.00`.
- Retain the meaningful business name following the number.

## Comments

- Attach comments to every object type that accepts them: process groups, processors, input ports, output ports.
- Write comments in plain conversational Russian: what the object does, what it receives or sends, and where errors are directed.
- Avoid vague comments such as “processes data”. Each comment must be useful to a future maintainer.
- Connections do not support comments. Leave connection names blank to keep the canvas uncluttered.

## Layout

- Favor a single primary vertical spine.
- Apply a boundary-aware layered layout:
  - input ports, source-only nodes, and manual trigger/source nodes occupy the top boundary;
  - business processors and process groups occupy the middle layers;
  - output ports and terminal sink nodes occupy the bottom boundary;
  - error, fallback, notification, and loop/back edges occupy side lanes.
- Place the input port or start processor at the top.
- Place the output port or finish processor at the bottom.
- Final output ports are sinks, not intermediate blocks. When an output port has
  incoming connections and no outgoing connections, position it after the last
  main processor/process group, even if its previous y-position was above the
  last group. Do not leave a final output port between `Teams` and `Обслуживание`:
  this produces a false loop rather than a legible finish.
- Route side-effect, error, and log processors to the right column.
- Side-effect and fallback processors may also appear on the left when that is the
  natural local side; do not force all secondary work to the right if doing so
  creates a long return route.
- Keep the right column near enough to the main spine for short, readable branches,
  but maintain a real routing corridor between main and side processors. Do not
  move errors far away solely to avoid crossings.
- Apply consistent vertical spacing per component type:
  - process group to process group: close enough that the connection label sits cleanly between them;
  - processor to process group: slightly more breathing room;
  - processor to processor: sufficient space for the queue label without overlap.
  - input port to processor and processor to output port must be visually
    symmetrical when both ports share the same size; do not leave a long bottom
    tail when the top input link is compact.
- Avoid large dead space unless it visually separates side branches from the main route.
- Side columns must scale dynamically. A single log/error branch should stay near
  the main line; a dense fan-in may reserve a wider corridor for labels and lanes.
- Before adding a long detour, consider repositioning the source or destination node:
  raise or lower the side processor, align it with the processor it returns to, or
  shift a terminal output closer to the local branch cluster.
- Penalize large empty canvas rectangles, distant output sinks, long horizontal
  buses spanning the whole canvas, and fan-in that could be localized by repositioning
  a sink or side processor.

## Connections

- Apply orthogonal routes: vertical and horizontal segments only.
- The main success path should typically have no bends when components share the same x-axis centerline.
- Error routes should depart to the right, travel on a side bus, then arrive at the log processor from the side.
- A single same-row branch should ordinarily be a direct straight line. Do not introduce
  doglegs merely to position the queue label when NiFi can place it cleanly on
  the straight segment.
- Favor the nearest useful side of the target. Do not funnel every connection
  into one common point: processors, groups, and ports can accept connections from the top,
  bottom, left, or right.
- The source side is also a routing decision. If a branch crosses another block
  only because it exits from the left or top, try the right or bottom exit before
  adding more bends.
- Avoid large “telephone wire” loops. A local side route is preferable to traveling
  far right, up, or down and then returning.
- For cycles, keep the legible acyclic path oriented top-to-bottom and route the back
  edge through a local side lane with minimal length and no crossings.
- A route must not visually contact a component edge except at its own arrowhead.
  When a label or segment lies flush against a processor, group, port, or queue
  label, treat this as an overlap and shift the route to another side or lane.
- Multiple routes into one output port must use separate lanes.
- Multiple routes into one processor, process group, or port must also use
  separate edge slots on the target side. Do not merge fan-in into a single
  center arrowhead: it resembles one thick wire and obscures which branch leads where.
- Select the target side globally — left, right, top, or bottom — based on the
  source position and any blockers. Never hard-code rules such as “all error routes enter from the
  left” or “all branches enter from the top”.
- Fan-in and fan-out routes require two independent separations:
  1. separate bus lanes in the open corridor;
  2. separate entry/exit slots on the component edge.
  Addressing only one still leaves overlapping lines near the target or source.
- Fan-in must be comb-shaped, not bundled. When several labels occupy one vertical
  bus or multiple paths merge before reaching a log or error processor, reroute some
  branches through the opposite side or move the error processor closer to the
  source cluster.
- Dense fan-in and fan-out should remain local where possible: sort sources by visible
  order, assign independent source exit slots and target entry slots, select the
  nearest clear target side, and prefer a local comb or ladder over a distant shared highway.
- A terminal sink with many incoming routes should be near the last related
  processors. Do not retain a historical far-right or far-left output position
  when a local bottom-boundary sink is more legible.
- Do not allow a handler's outgoing route to share the same short edge segment as
  incoming failure routes. A right-column handler returning to a lower main-lane
  processor should generally exit from the bottom first, then approach the lower
  target from the side.
- For output ports, favor a bottom lane when a direct vertical connection is
  obstructed by another component. This makes the route read as “branch completed”.
- When a side processor routes to an output port below the main lane, prefer to:
  exit the side processor from the bottom or right, pass below the nearby blocks,
  then enter the output port from the right or bottom. Do not pull the line back
  through the center corridor when a clean side exit is available.
- If a route would cross a queued label or another component, enter from the side rather than from the top.
- Set `labelIndex` so the connection label lands on a segment with adequate free space.
- After routing, repack `labelIndex` values globally within the process group.
  Local route scoring can overlook two individually valid labels that nevertheless
  overlap each other on the canvas.
- Clear every connection name.

## Verification

A flow is not complete until all of the following checks pass:

- no named connections;
- no missing comments on commentable objects;
- no `.00` numbering;
- no route segment intersects a component rectangle, except its own source/target;
- no connection label intersects a component or another label;
- no long collinear path overlap between different connections;
- screenshot is legible without needing to guess where a line goes.
- reports describe unresolved visual blockers without including private data. When a clean
  result requires a topology change, identify the safe options: funnel, collector
  processor, split sink, or separate process group.

## Apache NiFi UI geometry findings

Use these values from the current Apache NiFi frontend, not estimated screenshot sizes:

- Processor: `350 x 130`.
- Process group / remote process group: `384 x 176`.
- Input/output port: `240 x 48`; remote port: `240 x 80`.
- Funnel: `48 x 48`.
- Connection label width: `240`.
- Connection label row height: `19`; backpressure strip adds `3`.
- A connection label always has `Queued`; it also adds `From`/`To` rows for cross-process-group port connections and a `Name` row for selected relationships such as `success`, `failure`, `split`.
- `labelIndex` is centered on `bends[labelIndex]` when bends exist. Without bends the label is centered between calculated source/destination perimeter points.
- Do not use the old `apache/nifi-fds` repository for canvas geometry. It is a reusable Angular/Material design-system package; the live canvas sizes and connection behavior are in `apache/nifi` frontend files: `canvas.constants.ts` and `connection-renderer.ts`.

## Routing corrections learned from real visual review

- Begin with a straight vertical route for the main lane when source and destination share a centerline and no real blocker exists between them.
- Position error/log handlers far enough to the side so the 240px connection label fits between the main processor and the side processor.
- For side routes, derive the lane from the available corridor width; do not direct every connection to the same point.
- Prioritize dense fan-in ordering before routing. Sort sources by their visible order,
  then assign target-edge slots in the same order. This prevents crossings and
  transforms a fan-in into a legible comb rather than a bundle.
- Use actual component rectangles for label overlap checks, but inflated rectangles for path and segment clearance.
- Playwright screenshots remain mandatory after applying changes; REST geometry alone is insufficient because the browser expands connection labels based on relationship rows.
- Use wide screenshots and, when the flow spans more than one viewport, capture
  multiple viewports or scroll and pan across the canvas. A route can appear correct in
  a cropped screenshot and still produce an ugly long loop outside the visible area.
- Treat diagonal route segments as defects. In NiFi they typically indicate the first
  bend was placed on the wrong side of the source or target, causing the arrow to pass
  visually under the block or the block to hide the arrowhead.
- Dense fan-in columns must have sufficient corridor width for at least one visible grid cell between parallel lanes. When lanes are closer than ~16px over a long segment, treat it as fan-in overlap even when the segments are not exactly collinear.
- A side handler returning to a lower output port should follow the shortest clean bottom-or-right route: drop from the handler, travel horizontally at the output level, then enter the output from the side. Do not draw a large rectangle below the entire group unless a real blocker makes it necessary.
- Connection labels are genuine obstacles. No route segment may pass through another connection's `Name`/`Queued` label box. When this occurs, move the label to another bend or reroute the line around the label.
- For dense fan-in into a right-column processor, test lower sources against both left and right target edges. When the left-edge route crosses the central bus or labels, prefer a right-edge entry, but only after verifying the full candidate route against component rectangles.
- A side handler returning to a lower main-lane processor must not cross the queue labels between main processors. When a direct side return intersects labels, shift the horizontal return into a clear gap adjacent to the target and enter from the nearest safe side.
- For side handler to output port routes, do not add a small final dogleg merely to separate lanes. When the output centerline is clear, route at that y-level and enter the output from the side.
- For dense fan-in into a right-column handler with another handler below it,
  do not route lower sources around the far right by default: the far-side bus may
  travel straight through the lower processor. Route upper sources to the top edge
  and keep same-level or lower sources in the clear left/middle corridor unless the full
  far-side candidate is proven clear.
- For a right-column handler returning to a lower main-lane processor, do not
  drop from the handler centerline. Exit from the handler's left edge, use an
  open middle corridor, then enter the lower main-lane target from the right so
  the first vertical segment cannot pass through a lower side handler.
- Treat label-on-component and label-on-label collisions as hard failures when
  selecting `labelIndex`; route-line penalties must never take precedence over a queued-label overlap.
- When two same-column side processors have a clear vertical gap between them,
  prefer the direct no-bend route over a scored dogleg that may travel along
  or over the lower processor.
- Lines must maintain visible clearance, not merely avoid intersection: at the NiFi
  browser zoom used by the visual evidence workflow, route segments need at least 12px visual
  gap from other connection labels and component edges, and parallel route
  segments need at least 32px visual gap over meaningful lengths.
- When labels are tightly packed but a neighboring line still grazes the label border,
  shift the entire collinear route run, not a single segment. Adjusting only one
  segment in a same-orientation run produces diagonal artifacts.
- Any visual X or T crossing between different connection lines on the open canvas is a defect. Use wider bus lanes or route around the crossing; only the connection's own short source/destination endpoint contact is permitted.
- Non-adjacent segments of the same connection are also distinct visual wires: self-overlapping U-turns, close parallel self-runs, or self-crossing loops must be widened or rerouted the same way conflicts between different connections are resolved.
