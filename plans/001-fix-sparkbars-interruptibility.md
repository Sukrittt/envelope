# 001 — Fix SparkBars interruptibility and active-transform conflict

- **Status**: DONE
- **Commit**: a8c7f22
- **Severity**: MEDIUM
- **Category**: 4 · Interruptibility
- **Estimated scope**: 2 files, small

## Problem

`SparkBars` is the app's flagship "Apple-like fluid" interaction, but its interrupt/cancel path is dead code and the active transform has two sources of truth.

**Dead cancel path.** The animation handle is only stored behind a guard that is never true:

```ts
// src/components/SparkBars.tsx:119-122 — current
      // Store animation reference for interruptibility
      if (animationRefs.current[index]) {
        animationRefs.current[index].animation = animation
      }
```

`animationRefs` starts as `[]` (`SparkBars.tsx:34`) and no code ever creates an entry, so `animationRefs.current[index]` is always `undefined` → the handle is never stored. Consequences:

- The unmount cleanup iterates and cancels nothing (`SparkBars.tsx:127-133`).
- Re-pressing a bar while its 0.6s spring is running cannot cancel/retarget that spring, so rapid presses queue overlapping springs. Interruptibility — the documented purpose of this feature (`FLUID_INTERACTIONS.md` §Interruptibility) — silently does not exist.

**Conflicting active transform.** Pointer-down writes an inline transform:

```ts
// src/components/SparkBars.tsx:72-77 — current
    const barElement = barRefs.current[index]
    if (barElement) {
      barElement.style.transform = 'scale(0.98)'
      barElement.style.transition = 'transform 0.05s ease-out'
    }
```

while a CSS rule with `!important` forces a different transform whenever the bar is active:

```css
/* src/App.css:1456-1458 — current */
.spark-bar-wrap.is-active .spark-bar {
  transform: scale(0.98) translateY(-2px) !important;
}
```

The CSS also moves the bar `-2px` in `y`, which the JS never accounts for — so when the release spring animates to `scale(1)` (`SparkBars.tsx:110`), the `!important` rule keeps overriding it and the bar snaps/lands at the wrong transform.

**Reduced motion.** The release spring is a JS `animate()` and is not gated by `prefers-reduced-motion`; only the CSS transitions are disabled by the existing media query. Position change plays for reduced-motion users.

## Target

- The animation handle is stored unconditionally, so the unmount cleanup and future interrupts work.
- Releasing while a spring is running cancels it before starting the new one.
- The active transform has exactly one source: the inline transform set by `handlePointerDown`. The `!important` CSS rule is removed (the z-index + box-shadow rule at `App.css:1443-1445` stays — that is the depth cue, not a transform).
- Under `prefers-reduced-motion`, press feedback stays (instant, no spring) and the release does not spring.

## Repo conventions to follow

- Spring config for this feature is settled: `{ type: 'spring', bounce: 0.4, duration: 0.6 }` (`SparkBars.tsx:111-116`) per `FLUID_INTERACTIONS.md` §Behavior Over Animation. Do not change it.
- Reduced-motion is handled by `prefers-reduced-motion` media queries in `App.css` (e.g. `src/App.css:5845`). This plan uses `window.matchMedia('(prefers-reduced-motion: reduce)')` — no new dependency, matches the existing CSS-level approach.
- `animate` is already imported from `'motion'` at `SparkBars.tsx:2`; the `spring` import there is unused but leave it (out of scope).

## Steps

1. `src/components/SparkBars.tsx` — in `handlePointerUp`, immediately after the reset line, cancel any running spring for this bar:

```ts
    const barElement = barRefs.current[index]
    if (barElement) {
      // Reset transform immediately
      barElement.style.transform = ''

      // Interrupt any running spring for this bar before starting a new one
      animationRefs.current[index]?.animation?.cancel()
```

2. `src/components/SparkBars.tsx` — replace the guarded store (lines 119-122) with an unconditional store:

```ts
      // Store animation reference for interruptibility
      animationRefs.current[index] = { animation }
```

3. `src/components/SparkBars.tsx` — gate the release spring behind reduced motion. Inside the `if (barElement)` block, right after the cancel step added in step 1:

```ts
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return
      }
```

(Under reduced motion the bar returns to rest instantly via the `style.transform = ''` reset in step 1 — feedback preserved, movement dropped.)

4. `src/App.css` — delete the entire rule:

```css
/* src/App.css:1456-1458 — delete */
.spark-bar-wrap.is-active .spark-bar {
  transform: scale(0.98) translateY(-2px) !important;
}
```

Keep `src/App.css:1443-1445` (`.spark-bar-wrap.is-active .spark-bar { z-index: 5; box-shadow: … }`). The active state's visual press is now exactly the inline `scale(0.98)` written by `handlePointerDown`.

5. Verify no other rule sets `transform` on `.spark-bar` (the hover-lift rules in `App.css` set `transform: translateY(-2px)` on `.spark-bar-wrap.is-hovered .spark-bar` — those are separate selectors and unaffected).

## Boundaries

- Do NOT touch the spring config, velocity math, `handlePointerMove`, or the bar markup.
- Do NOT touch `handlePointerDown`'s inline press transform — it becomes the single source of truth.
- Do NOT add dependencies or `motion` reduced-motion helpers; `window.matchMedia` is sufficient here.
- If the code at any cited line has drifted since commit `a8c7f22`, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npm run build` both pass.
- **Feel check**: run `npm run dev`, open the expense trend chart with fluid interactions enabled, then:
  - Click a bar and immediately click another within 0.6s — the first spring is cancelled, no overlapping double-bounce.
  - Press and hold a bar >100ms, then release — it settles to rest without a fling and without snapping to a `-2px` y-offset.
  - In DevTools Animations panel set playback to 10%: releasing mid-press starts the new spring from the bar's current value, not from zero.
  - Toggle `prefers-reduced-motion` (Rendering panel): pressing still gives instant `scale(0.98)` feedback; releasing returns instantly with no spring.
- **Done when**: the `if (animationRefs.current[index])` guard is gone, the `!important` rule is gone, and the three feel checks above all behave.
