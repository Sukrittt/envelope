# 007 — Ease the heatmap day border in instead of snapping it

- **Status**: DONE
- **Commit**: f481763
- **Severity**: MEDIUM
- **Category**: 2 · Easing & duration
- **Estimated scope**: 1 file, small

## Problem

On the spending-insights heatmap, each day's border appears by snapping to full strength the frame the state changes. `.si-heatmap-cell` transitions only `background` — neither the hover ring (`outline`) nor the today ring (`box-shadow`) is in the transition list. The heatmap is hovered daily (one cell per day, every month view), so the ring's instant pop is a hard cut against the eased micro-interactions everywhere else in the cockpit.

```css
/* src/App.css:2146-2155 — current */
.si-heatmap-cell {
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
}
```

```css
/* src/App.css:2157-2161 — current hover: the ring snaps in */
.si-heatmap-cell:hover {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  filter: brightness(1.12);
}
```

```css
/* src/App.css:2163-2165 — current today: the inset ring snaps in */
.si-heatmap-today {
  box-shadow: inset 0 0 0 2px var(--accent, var(--brand-peach));
}
```

## Target

The border *grows* rather than teleports: at rest each cell carries an invisible 2px outline (`transparent`), and only the `outline-color` flips on hover — so the ring fades in over the fast token. The today ring transitions `box-shadow`, which browsers interpolate from `none` as a fading inset ring over the medium token.

```css
/* target */
.si-heatmap-cell {
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  outline: 2px solid transparent;
  outline-offset: -2px;
  transition:
    background-color var(--dur-fast) var(--ease-standard),
    outline-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-med) var(--ease-standard);
}
```

```css
/* target — hover flips only the outline color */
.si-heatmap-cell:hover {
  outline-color: var(--accent);
  filter: brightness(1.12);
}
```

## Repo conventions to follow

- Motion tokens live at `src/App.css:58-61`: `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`, `--dur-fast` 120ms, `--dur-med` 180ms, `--dur-slow` 240ms.
- Explicit transition lists over `transition: all` / raw durations — exemplar: `.sidebar-link` at `src/App.css:264-266` and `.tab-button` at `src/App.css:4008` (plan 004 rewrote it to `background-color`, `color`, `border-color` tokens).
- `outline: 2px solid transparent` at rest with `outline-offset: -2px` keeps the hover ring exactly where it was (just inside the cell edge) while enabling a color fade.

## Steps

1. `src/App.css:2146` — replace the `.si-heatmap-cell` block body: drop `transition: background 0.15s;`, add `outline: 2px solid transparent;` + `outline-offset: -2px;` before `transition:`, and set the tokenized three-line transition list shown in Target.

2. `src/App.css:2157` — replace the `.si-heatmap-cell:hover` body with `outline-color: var(--accent);` + the existing `filter: brightness(1.12);`. The outline width/offset now come from the base rule, so remove `outline: 2px solid var(--accent);` and `outline-offset: -2px;` from the hover rule.

3. Leave these rules untouched:
   - `.si-heatmap-today` (`2163`) — box-shadow animates automatically once it's in the base transition list.
   - `.si-heatmap-today.si-heatmap-cell:hover` (`2167`) — still re-declares box-shadow/outline-offset, harmless.
   - the duplicate `.si-heatmap-cell:hover` at `2172-2174` (`outline-color: var(--accent, var(--brand-peach))`) — redundant with step 2, leave it.
   - `.si-heatmap-cell-empty:hover` (`2180`, `outline: none`) — still correctly removes the invisible base outline on empty cells.

## Boundaries

- Do NOT transition `filter: brightness` — it is a paint operation (same perf rule as plans 002/005); the outline fade carries the perceived "appear".
- Do NOT touch the tooltip (`si-heatmap-tooltip`), the legend, or the TSX in `SpendingInsights.tsx` — plan 008 owns the tooltip.
- Do NOT change `--ease-standard` or the duration tokens themselves.
- If the block shape at any cited line differs from the excerpts (drift since `f481763`), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes. `grep -n "transition: background 0.15s" src/App.css` returns nothing; `grep -n "si-heatmap-cell" src/App.css` shows the base rule with `outline: 2px solid transparent;`.
- **Feel check**: run `npm run dev`, open `/expense` (Insights panel):
  - Hover any day: the outline fades in over ~120ms on the ease-standard curve — a grow, not a pop.
  - Navigate to today's month: the today ring fades in over ~180ms.
  - Hover today: ring stays full-strength (no blink), background still crossfades on hover.
  - In DevTools Animations panel at 10% speed, confirm only `outline-color`/`box-shadow`/`background-color` are interpolated (no layout property).
- **Done when**: hover and today borders ease in and nothing else on the panel changes.
