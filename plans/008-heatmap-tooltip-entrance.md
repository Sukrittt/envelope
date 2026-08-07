# 008 — Animate the heatmap tooltip in

- **Status**: DONE
- **Commit**: f481763
- **Severity**: LOW (additive / missed opportunity)
- **Category**: 8 · Missed opportunities
- **Estimated scope**: 2 files, small

## Problem

The day tooltip renders through `createPortal` on mouse-enter and pops in with zero motion — full opacity, full size, the same frame the state flips. Every cell is hovered on the insights surface, so the pop is a hard cut against the eased cockpit. The `motion` library is already in the repo (same package plan 006 used); this is the same class of entrance it fixed for the transactions list.

```tsx
// src/components/SpendingInsights.tsx:222-238 — current
{tooltip && createPortal(
  <div
    className="si-heatmap-tooltip"
    style={{ left: tooltip.x, top: tooltip.y }}
  >
    <strong>{new Date(tooltip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>
    {tooltip.total > 0 ? (
      <>
        <span>Total: {fmt(tooltip.total)}</span>
        {tooltip.topCat && <span>mostly {tooltip.topCat}</span>}
      </>
    ) : (
      <span>No spend</span>
    )}
  </div>,
  document.body
)}
```

```css
/* src/App.css:2190-2192 — current (transform line only, shown in context) */
.si-heatmap-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  ...
}
```

## Target

The tooltip fades in and scales from 96% over 120ms on the repo's ease-out curve, anchored at its top-center. Because `.si-heatmap-tooltip` is centered with `transform: translate(-50%, -100%)`, motion must own that transform (composing `x`/`y` with the entrance `scale`) instead of fighting the CSS class.

```tsx
// target
{tooltip && createPortal(
  <motion.div
    className="si-heatmap-tooltip"
    style={{ left: tooltip.x, top: tooltip.y, x: '-50%', y: '-100%' }}
    initial={reduce ? false : { opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'tween', duration: 0.12, ease: 'easeOut' }}
  >
    <strong>{new Date(tooltip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>
    {tooltip.total > 0 ? (
      <>
        <span>Total: {fmt(tooltip.total)}</span>
        {tooltip.topCat && <span>mostly {tooltip.topCat}</span>}
      </>
    ) : (
      <span>No spend</span>
    )}
  </motion.div>,
  document.body
)}
```

```css
/* target — drop the CSS transform; motion supplies it */
.si-heatmap-tooltip {
  position: fixed;
  ...
}
```

## Repo conventions to follow

- `motion` is `motion/react` here — exemplars: `src/components/TransactionsView.tsx:2` and `src/components/MotionSheet.tsx:1`.
- Reduced motion is handled in JS via `useReducedMotion()` and `initial={reduce ? false : {...}}` — exact pattern in plan 006 (`TransactionsView.tsx`) and `MotionSheet.tsx:17`.
- Entrance = fade + slight transform on `easeOut`; single-direction (no exit animation, no `AnimatePresence`) — matches plan 006's pagination decision so hovering stays instant.
- Keep `margin-top: -4px` on `.si-heatmap-tooltip` — it offsets the tooltip above the cell and is independent of the transform.

## Steps

1. `src/components/SpendingInsights.tsx:3` — after the existing imports, add:
```tsx
import { motion, useReducedMotion } from 'motion/react'
```

2. In the component body, next to `const router = useRouter()` (`src/components/SpendingInsights.tsx:154`), add:
```tsx
const reduce = useReducedMotion()
```

3. `src/components/SpendingInsights.tsx:222` — change the portal's opening `<div className="si-heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>` to the `motion.div` opening shown in Target (className, `style` with `x`/`y`, `initial`, `animate`, `transition`). Keep all children exactly as they are.

4. Change the matching closing `</div>` (line ~238) to `</motion.div>`.

5. `src/App.css:2192` — delete `transform: translate(-50%, -100%);` from `.si-heatmap-tooltip` (motion now renders the equivalent transform inline). Leave every other line of the rule untouched.

## Boundaries

- Do NOT add an exit animation or `AnimatePresence` — on mouse-leave the tooltip should still disappear instantly so hover stays snappy.
- Do NOT key the element or add per-cell re-animation: hovering from one day to the next updates `left`/`top` on the same mounted instance, so the entrance only replays when the tooltip remounts (mouse-enter from outside). That is the desired behavior.
- Do NOT touch the cell rules (`.si-heatmap-cell*`) — plan 007 owns them.
- If the portal shape differs from the excerpt (drift since `f481763`), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npm run build` pass.
- **Feel check**: run `npm run dev`, open `/expense` (Insights panel):
  - Hover a day: the tooltip fades in and scales from 96% over ~120ms, staying anchored to the day (no drift when it appears).
  - Slide to the adjacent day: no re-animation — the tooltip tracks without popping.
  - Leave the grid: the tooltip disappears instantly.
  - In DevTools Animations panel at 10% speed, confirm `opacity` + `transform` only, easing `easeOut`.
  - Toggle `prefers-reduced-motion`: the tooltip appears instantly at full opacity, correctly positioned.
- **Done when**: the tooltip eases in, tracks between days without replaying, and reduced-motion shows it instantly.
