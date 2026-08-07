# 005 — Make the expense-shimmer sweep `linear`

- **Status**: DONE
- **Commit**: a8c7f22
- **Severity**: LOW
- **Category**: 7 · Cohesion / 2 · Easing & duration
- **Estimated scope**: 1 file, 1 line

## Problem

The expense skeleton's shimmer is a continuous background-position sweep but animates with `ease-in-out`, so each loop cycle accelerates and decelerates — a constant-speed sweep should be `linear`. The sweep also re-renders `background-position` (paint-heavy), but switching to `linear` is the correction that belongs to this finding; a full `translateX` rewrite is out of scope.

```css
/* src/App.css:4199 — current */
.expense-skeleton {
  display: block;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--accent-strong) 12%, transparent) 0%,
    color-mix(in oklab, var(--accent-strong) 24%, transparent) 50%,
    color-mix(in oklab, var(--accent-strong) 12%, transparent) 100%
  );
  background-size: 220% 100%;
  animation: expenseShimmer 1.2s ease-in-out infinite;
}
```

## Target

```css
  animation: expenseShimmer 1.2s linear infinite;
```

## Repo conventions to follow

- The other two looping animations — `loadingCaptionFade` (`src/App.css:4251`, an opacity pulse) and `skeleton-pulse` (`src/App.css:4989`, an opacity pulse) — are fades, not sweeps. `ease-in-out` is correct for them; leave them unchanged. Only the *sweep* goes linear, matching the audit rule "constant motion → linear".

## Steps

1. `src/App.css:4199` — change `ease-in-out` to `linear`.

## Boundaries

- Do NOT touch `loadingCaptionFade` or `skeleton-pulse`.
- Do NOT rewrite the shimmer to translateX in this plan.

## Verification

- **Mechanical**: `npm run build` passes; `grep -n "expenseShimmer" src/App.css` shows `linear`.
- **Feel check**: reload the expense page while data loads — the shimmer sweeps at a constant rate, no per-cycle hesitation.
- **Done when**: the shimmer reads as a constant-speed sweep.
