# 003 — Route hand-typed theme transitions through motion tokens

- **Status**: TODO
- **Commit**: a8c7f22
- **Severity**: MEDIUM
- **Category**: 7 · Cohesion & tokens
- **Estimated scope**: 1 file, small

## Problem

The app has a motion token system (`--ease-standard`, `--dur-fast` 120ms, `--dur-med` 180ms, `--dur-slow` 240ms at `src/App.css:58-61`) but four theme-transition families bypass it with hand-typed `0.25s ease`. Near-miss easings and durations scattered across the file, and there is no ease-in-out curve token for on-screen morphing (the sidebar collapse is the one morphing movement in the app).

Four sites (identical pattern):

```css
/* src/App.css:208-210 — current, inside the sidebar rule */
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease;
```

```css
/* src/App.css:454-456 — current, .page-context */
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease;
```

```css
/* src/App.css:590-592 — current, .mc-panel (sits above a box-shadow line using tokens) */
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease,
    box-shadow var(--dur-slow) var(--ease-standard);
```

```css
/* src/App.css:652-654 — current, .mc-kpi-card / .mc-department-card */
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease;
```

And the sidebar's `width` transition (the one on-screen morph) uses the ease-out token:

```css
/* src/App.css:207 — current */
    width 180ms var(--ease-standard),
```

## Target

- The four theme-transition families use the repo tokens. `0.25s` ≈ `--dur-slow` (240ms) — near-identical timing, now tokenized.
- A new `--ease-in-out` token exists next to `--ease-standard` (per the audit: moving/morphing on screen → ease-in-out, distinct from entrance ease-out).
- The sidebar `width` morph uses the new ease-in-out token; the color crossfades inside the same rule stay on `--ease-standard`.

## Repo conventions to follow

- Tokens live in the `:root` block at `src/App.css:1-62`; add new curves beside `--ease-standard` (line 58). This matches how `--ease-standard` and the `--dur-*` trio are already declared.
- Curve values come from the audit playbook — copy exactly:
```css
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

## Steps

1. `src/App.css` `:root` (after line 58, `--ease-standard`), add:
```css
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

2. `src/App.css:207-210` — the sidebar rule's `transition` becomes:
```css
  transition:
    width 180ms var(--ease-in-out),
    background-color var(--dur-slow) var(--ease-standard),
    color var(--dur-slow) var(--ease-standard),
    border-color var(--dur-slow) var(--ease-standard);
```

3. `src/App.css:454-456` — `.page-context` becomes:
```css
  transition:
    background-color var(--dur-slow) var(--ease-standard),
    color var(--dur-slow) var(--ease-standard),
    border-color var(--dur-slow) var(--ease-standard);
```

4. `src/App.css:590-592` — `.mc-panel` becomes (keep the existing box-shadow line below it unchanged):
```css
    background-color var(--dur-slow) var(--ease-standard),
    color var(--dur-slow) var(--ease-standard),
    border-color var(--dur-slow) var(--ease-standard),
    box-shadow var(--dur-slow) var(--ease-standard);
```

5. `src/App.css:652-654` — `.mc-kpi-card` / `.mc-department-card` becomes:
```css
    background-color var(--dur-slow) var(--ease-standard),
    color var(--dur-slow) var(--ease-standard),
    border-color var(--dur-slow) var(--ease-standard);
```

## Boundaries

- Scope is exactly the four `0.25s ease` families above plus the `--ease-in-out` token and the sidebar width swap. Do NOT chase the other bare-duration stragglers (`background 0.15s`, `background 0.1s`, `color 0.15s` at e.g. App.css:1805, 2156, 2988) — they are known and out of scope here.
- Do NOT touch the four bar-fill rules rewritten by plan 002 (`progress-bar-fill`, `top-day-bar-fill`, `sub-burn-gauge-fill`, `env-bar-fill`).
- Do NOT change `--ease-standard` itself.
- If the code shape at any cited line differs from the excerpt, STOP and report.

## Verification

- **Mechanical**: `npm run build` passes. Grep `grep -n "0.25s ease" src/App.css` returns nothing.
- **Feel check**: run `npm run dev`, toggle light/dark theme:
  - Page background, panels, KPI cards, and the page-context bar crossfade smoothly at ~240ms (imperceptibly different from before).
  - Collapse/expand the sidebar: the width now uses ease-in-out — a deliberate settle at the end instead of the previous ease-out snap.
  - In DevTools Animations panel, the running transition curve shows `cubic-bezier(0.77, 0, 0.175, 1)` on the width and `cubic-bezier(0.2, 0, 0, 1)` on the colors.
- **Done when**: all four families use tokens, `--ease-in-out` is declared, and grep for `0.25s ease` is empty.
