# 006 — Crossfade the transactions list on page change

- **Status**: TODO
- **Commit**: a8c7f22
- **Severity**: LOW (additive / missed opportunity)
- **Category**: 8 · Missed opportunities
- **Estimated scope**: 1 file, small

## Problem

The transactions timeline paginates with `Prev` / `Next` (`src/components/TransactionsView.tsx:792/803`), and flipping a page hard-cuts the whole list. The cockpit's most-searched surface swaps state with no motion explaining the change — a jarring teleport. `AnimatePresence` is already imported in this file (for the edit modal), so the motion library is right there.

Current container:

```tsx
// src/components/TransactionsView.tsx:615-616 — current
        <div className="txn-timeline-list">
```

The list closes with the `</div>` at the end of the mapped rows (~`src/components/TransactionsView.tsx:781`, immediately before the footer at 783).

## Target

A single-direction entrance on page change: the new page fades and rises 6px into place over 150ms with the repo's ease-out curve. No exit animation and no `AnimatePresence` mode="wait" — pagination must not be slowed by an exit phase. The remount is keyed by `page`, so:

- flipping pages replays the entrance,
- typing in the search box does NOT re-animate (page stays 0, key unchanged),
- reduced-motion users get the instant swap (no movement).

## Repo conventions to follow

- Entrance = fade + slight y with `ease-out`, per the audit. `motion` is `motion/react` here (`src/components/TransactionsView.tsx:2`).
- Reduced motion already handled via `useReducedMotion()` in `src/components/MotionSheet.tsx:17` — same pattern.
- `.txn-timeline-list` styling (`src/App.css:5048`) applies because `motion.div` renders a `<div>` with the className.

## Steps

1. `src/components/TransactionsView.tsx:2` — extend the import:
```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
```

2. In the component body, near the other hooks at the top, add:
```tsx
  const reduce = useReducedMotion();
```

3. `src/components/TransactionsView.tsx:615` — replace the opening `<div className="txn-timeline-list">` with:
```tsx
        <motion.div
          key={page}
          className="txn-timeline-list"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
        >
```

4. Replace the matching `</div>` (line ~781, the list's closing tag) with `</motion.div>`.

5. Leave `AnimatePresence` (line 812) untouched — it still wraps the edit modal.

## Boundaries

- Do NOT add an exit animation or `mode="wait"` — pagination stays instant to trigger.
- Do NOT key on `search`/`selectedCategory` (they reset `page` to 0 via `setPage(0)` at `TransactionsView.tsx:243/290`, so keying on `page` alone already covers filters without per-keystroke churn).
- Do NOT touch the edit-modal `AnimatePresence`, the pagination buttons, or any CSS.
- If the row markup shape differs from the excerpt (drift since `a8c7f22`), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npm run build` pass.
- **Feel check**: run `npm run dev`, open `/expense/transactions`:
  - Click Next/Prev: each page fades + rises 6px over 150ms; no double-exposure (no exit animation, so the swap is instant then settles).
  - Type in the search box: no re-animation per keystroke.
  - In DevTools Animations panel at 10% speed, confirm the entrance is `ease-out` over ~150ms and `transform`/`opacity` only (no layout).
  - Toggle `prefers-reduced-motion`: pages swap with zero animation.
- **Done when**: page flips animate at 150ms, search doesn't re-animate, and reduced-motion swaps instantly.
