# 002 — Rebuild the width-animated bar fills on transform: scaleX

- **Status**: DONE
- **Commit**: a8c7f22
- **Severity**: MEDIUM
- **Category**: 5 · Performance / 2 · Easing & duration
- **Estimated scope**: 5 files, small

## Problem

Four bar-fill components animate `width`, which triggers layout + paint on every frame of the transition. The bars are the app's core surface — the envelope budget rows on the expense page render one fill per category, every session. Animating a layout property across dozens of elements during data load is the exact pattern the audit forbids.

- `src/App.css:2875` — envelope bar, 450ms (over the 300ms UI budget):
```css
/* src/App.css:2875 — current */
.env-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--accent-strong) 70%, transparent),
    var(--accent-strong)
  );
  border-radius: 999px;
  transition: width 0.45s var(--ease-standard);
  position: relative;
  overflow: hidden;
}
```

- `src/App.css:538` — fitness progress bar, `transition: width 0.3s ease;`
- `src/App.css:6228` — top spending day bar, `transition: width 0.3s ease;`
- `src/App.css:6263` — subscription burn gauge, `transition: width 0.3s ease;`

All four widths are set inline from React as percentages:

```tsx
// src/components/EnvelopeGrid.tsx:238-241 — current
              <div
                className={`env-bar-fill ${isOverspent ? 'env-bar-red' : pct > 85 ? 'env-bar-warn' : ''}`}
                style={{ width: `${pct}%` }}
              />
```

```tsx
// src/components/InsightsView.tsx:198-200 — current
                    <div
                      className="top-day-bar-fill"
                      style={{ width: `${topDaysMax > 0 ? (day.avgSpend / topDaysMax) * 100 : 0}%` }}
                    />
```

```tsx
// src/components/InsightsView.tsx:225-227 — current
            <div
              className="sub-burn-gauge-fill"
              style={{ width: `${Math.min(subscriptionBurn.capPct, 100)}%` }}
            />
```

```tsx
// src/views/FitnessPage.tsx:289-291 — current
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, ((panel.startWeightKg - panel.currentWeightKg) / (panel.startWeightKg - panel.targetWeightKg)) * 100).toFixed(0)}%` }}
                />
```

## Target

- The only animated property is `transform` (compositor-friendly).
- Each fill keeps `width: 100%` of its track (so the gradient/background renders at the correct full scale) and its visible portion is driven by `transform: scaleX(<ratio>)` with `transform-origin: left`.
- All four tracks already have `overflow: hidden` (verified: `.env-bar-track` App.css:2863, `.top-day-bar-track` App.css:6223, `.sub-burn-gauge-track` App.css:6260, `.progress-bar` App.css:530), so an over-scaled fill clips identically to today's `width: >100%`.
- Duration is the repo token `--dur-med` (180ms) — inside the 300ms UI budget and half the current envelope bar duration.
- Easing is the repo token `--ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`), matching every other transition in the file.

Note on the envelope gradient: `scaleX` squishes the `linear-gradient` band horizontally. For a two-stop fade (`70% transparent → solid`), the compressed band still reads as an accent fade on a bar; the other three fills are solid color or a two-stop horizontal gradient that compresses evenly. If the feel-check finds the envelope gradient objectionable, report back — do not silently substitute a different technique.

## Repo conventions to follow

- Tokens: `--dur-med: 180ms`, `--ease-standard: cubic-bezier(0.2, 0, 0, 1)` (`src/App.css:58-61`).
- The rest of the app already animates `transform` with these tokens, e.g. `src/App.css:308` `.sidebar-link-indicator` — imitate that pattern.
- Width values stay inline (they come from React), only the inline *style shape* changes.

## Steps

1. `src/App.css` — `.env-bar-fill` (line 2875): replace `transition: width 0.45s var(--ease-standard);` with:
```css
  transition: transform var(--dur-med) var(--ease-standard);
  transform-origin: left;
```

2. `src/App.css` — `.progress-bar-fill` (line 538): replace `transition: width 0.3s ease;` with:
```css
  transition: transform var(--dur-med) var(--ease-standard);
  transform-origin: left;
```

3. `src/App.css` — `.top-day-bar-fill` (line 6228): replace `transition: width 0.3s ease;` with:
```css
  transition: transform var(--dur-med) var(--ease-standard);
  transform-origin: left;
```

4. `src/App.css` — `.sub-burn-gauge-fill` (line 6263): replace `transition: width 0.3s ease;` with:
```css
  transition: transform var(--dur-med) var(--ease-standard);
  transform-origin: left;
```

5. `src/components/EnvelopeGrid.tsx:239` — replace `style={{ width: `${pct}%` }}` with:
```tsx
                style={{ width: '100%', transform: `scaleX(${pct / 100})` }}
```
(If `pct` is ever negative, clamp: `scaleX(${Math.max(0, pct) / 100})`.)

6. `src/components/InsightsView.tsx:199` — replace `style={{ width: `${topDaysMax > 0 ? (day.avgSpend / topDaysMax) * 100 : 0}%` }}` with:
```tsx
                      style={{ width: '100%', transform: `scaleX(${topDaysMax > 0 ? day.avgSpend / topDaysMax : 0})` }}
```

7. `src/components/InsightsView.tsx:226` — replace `style={{ width: `${Math.min(subscriptionBurn.capPct, 100)}%` }}` with:
```tsx
              style={{ width: '100%', transform: `scaleX(${Math.min(subscriptionBurn.capPct, 100) / 100})` }}
```

8. `src/views/FitnessPage.tsx:290` — replace `style={{ width: `${Math.min(100, ((panel.startWeightKg - panel.currentWeightKg) / (panel.startWeightKg - panel.targetWeightKg)) * 100).toFixed(0)}%` }}` with:
```tsx
                  style={{ width: '100%', transform: `scaleX(${Math.min(1, (panel.startWeightKg - panel.currentWeightKg) / (panel.startWeightKg - panel.targetWeightKg)).toFixed(3)})` }}
```
(If the denominator is 0, the ratio is `Infinity` → `Math.min(1, Infinity)` = 1 → full bar, matching today's `width: 100%` behavior.)

9. Remove nothing else. `transition` on the fill now animates transform only; the inline `width: '100%'` is the steady-state layout (no layout animation).

## Boundaries

- Do NOT change the `env-bar-red` / `env-bar-warn` variant classes, the track styles, `border-radius`, or any markup beyond the two style expressions and the four CSS rules.
- Do NOT touch the similar `.env-bar` family rules or any other width transitions in the file — only the four rules cited.
- Do NOT add `will-change`; the transition is short and one-shot.
- If a cited line's number drifts (CSS reformatting), locate by selector text — but if the code shape differs from the excerpt, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npm run build` pass. Grep confirms no remaining `transition: width` in the four fill rules.
- **Feel check**: run `npm run dev`.
  - Expense page, envelope panel: on load, envelope bars grow left→right at ~180ms (snappier than before) and settle at the same widths.
  - Insights: top spending days and subscription burn bars render at correct widths; fitness progress bar too.
  - In DevTools Rendering panel, open "Paint flashing" while the bars animate on reload: no paint flashes — transform only.
  - In DevTools Animations panel at 10% speed, confirm the fill scales from the left edge (`transform-origin: left`), not from center.
- **Done when**: `transition: width` no longer appears in the four rules, all four fills use `scaleX`, and the paint-flash check is clean.
