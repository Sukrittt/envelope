# Animation Plans — Mission Control Dashboard

Audit run 2026-08-07 via `improve-animations` on commit `a8c7f22` (branch `feat/playful-sleek-frontend`). All plans are self-contained; any executor with zero context can run one start to finish.

## Plan index

| # | Title | Severity | Category | Files | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | Fix SparkBars interruptibility and active-transform conflict | MEDIUM | Interruptibility | `SparkBars.tsx`, `App.css` | DONE |
| 002 | Rebuild width-animated bar fills on `transform: scaleX` | MEDIUM | Performance / Easing | `App.css`, `EnvelopeGrid.tsx`, `InsightsView.tsx`, `FitnessPage.tsx` | DONE |
| 003 | Route hand-typed theme transitions through motion tokens | MEDIUM | Cohesion & tokens | `App.css` | DONE |
| 004 | Replace `transition: all` on `.tab-button` | LOW | Performance | `App.css` | DONE |
| 005 | Make the expense-shimmer sweep `linear` | LOW | Cohesion / Easing | `App.css` | DONE |
| 006 | Crossfade the transactions list on page change | LOW | Missed opportunity | `TransactionsView.tsx` | DONE |

## Recommended execution order

All plans are independent (no plan edits a region another plan edits):

1. **001** — flagship fluid feature; the fix is small and the feature's promise currently doesn't hold.
2. **002** — core surface (envelope bars) on the compositor; biggest perceptual+perf win per effort.
3. **003** — token consolidation; makes the easing system complete (`--ease-in-out` added) before further work builds on it.
4. **006** — additive delight, one file, self-contained.
5. **004**, **005** — mechanical one-liners, run in any order.

## Dependencies

None. 003's new `--ease-in-out` token is only used inside 003 itself; 002 stays on `--ease-standard`.

## Verified facts the plans rely on

- All four bar tracks (`env-bar-track`, `top-day-bar-track`, `sub-burn-gauge-track`, `.progress-bar`) have `overflow: hidden`.
- `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`, `--dur-fast 120ms`, `--dur-med 180ms`, `--dur-slow 240ms` at `src/App.css:58-61`.
- The modal motion primitives (`MotionSheet.tsx` Scrim/Sheet) are already correct — no plan touches them.

## How to execute

```
# inspect a plan, then run it with any executor, e.g.
claude "execute plans/002-envelope-bars-scale-x.md in an isolated worktree"
```

After a plan lands, run `improve-animations reconcile` to refresh stale line refs and mark done plans DONE.
