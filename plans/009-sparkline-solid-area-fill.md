# 009 — Replace the SparkLine gradient area fill with a solid tint

- **Status**: DONE
- **Commit**: f481763
- **Severity**: LOW (visual preference, user-requested)
- **Category**: 7 · Cohesion & tokens
- **Estimated scope**: 2 files, small

## Problem

The weight graph's area fill is a vertical `<linearGradient>` that fades the line color at 25% opacity down to transparent. The user finds the gradient tint unconvincing on this graph and wants a solid fill. The gradient plumbing (`gradientFrom`/`gradientTo` props, `<defs>` block, `gradientId`) exists only to serve that fill.

```tsx
// src/components/SparkLine.tsx:6-15 — current interface
  gradientFrom?: string
  gradientTo?: string
```

```tsx
// src/components/SparkLine.tsx:22-23 — current destructure
  gradientFrom = 'var(--ok-fg)',
  gradientTo = 'transparent',
```

```tsx
// src/components/SparkLine.tsx:150-164 — current
  const gradientId = 'spark-line-gradient'
  ...
  <defs>
    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.25" />
      <stop offset="100%" stopColor={gradientTo} stopOpacity="0" />
    </linearGradient>
  </defs>
```

```tsx
// src/components/SparkLine.tsx:200-202 — current area fill
  {showArea && areaPath && (
    <path d={areaPath} fill={`url(#${gradientId})`} />
  )}
```

One caller passes the now-gradient-only prop: `src/views/FitnessPage.tsx:379` `gradientFrom={prChartColors[idx % prChartColors.length]}` (in the Strength Progress charts, which render `showArea={false}` — the prop is dead there too).

## Target

The area is a flat, low-opacity solid tint of the line's own color; the gradient def, `gradientId`, and the `gradientFrom`/`gradientTo` props are gone.

```tsx
// target — area fill
  {showArea && areaPath && (
    <path d={areaPath} fill={color} fillOpacity="0.12" />
  )}
```

## Repo conventions to follow

- The `color` prop already carries the line color (`'var(--ok-fg)'` default, per-call override in the PR charts) — the fill reuses it, so line and tint can never drift apart.
- No new props: this is a removal, not a configuration surface (ponytail: no dead config — a toggle for a value with one current setting is speculative).
- SVG `fillOpacity` is a React-compatible SVG attribute — same file already uses `strokeWidth`, `strokeDasharray`, `opacity` (e.g. `SparkLine.tsx:206-212`).

## Steps

1. `src/components/SparkLine.tsx:6-15` — remove `gradientFrom?: string` and `gradientTo?: string` from the `SparkLineProps` interface.

2. `src/components/SparkLine.tsx:22-23` — remove the `gradientFrom` and `gradientTo` default destructures.

3. `src/components/SparkLine.tsx:150` — delete `const gradientId = 'spark-line-gradient'`.

4. `src/components/SparkLine.tsx:159-164` — delete the `<defs>` block (including the `<linearGradient>` and its two `<stop>`s). The `<svg>` opens at 155 and grid lines start at 167; the svg's `viewBox`/`preserveAspectRatio`/`className` are untouched.

5. `src/components/SparkLine.tsx:200-202` — replace the area fill with `fill={color} fillOpacity="0.12"` (exactly the Target snippet). `showArea` and `areaPath` behavior unchanged.

6. `src/views/FitnessPage.tsx:379` — delete the `gradientFrom={prChartColors[idx % prChartColors.length]}` line from the Strength Progress `<SparkLine>`. Keep `color={prChartColors[idx % prChartColors.length]}` and `showArea={false}`.

## Boundaries

- Do NOT change the `color`/`showArea`/`showDots`/`targetValue`/`projectionData` props or any stroke/dot/target rendering.
- Do NOT touch the main weight chart's SparkLine call (`FitnessPage.tsx:262`) — it uses defaults and is unaffected once the props are removed.
- `SparkLine` has no other callers (`grep -rn "SparkLine" src/` returns only `SparkLine.tsx` and `FitnessPage.tsx`).
- If a cited line differs from the excerpt (drift since `f481763`), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npm run build` pass. `grep -rn "gradientFrom\|gradientTo\|linearGradient\|gradientId" src/` returns nothing.
- **Feel check**: run `npm run dev`, open `/fitness`:
  - Weight graph: the area under the line is a flat, low-opacity tint of the line color, no vertical fade to transparent.
  - Strength Progress charts render exactly as before (no area, line + dots).
- **Done when**: the weight graph shows a solid tint and no gradient code remains.
