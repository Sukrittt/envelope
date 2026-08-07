# 004 — Replace `transition: all` on `.tab-button`

- **Status**: TODO
- **Commit**: a8c7f22
- **Severity**: LOW
- **Category**: 5 · Performance
- **Estimated scope**: 1 file, 1 line

## Problem

`.tab-button` (used for the Fitness page tab switcher, `src/views/FitnessPage.tsx:170/177/184`) transitions `all`, which animates every property off-GPU and silently picks up any future property added to the rule. Only background and text color actually change on hover.

```css
/* src/App.css:4008 — current */
.tab-button {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 8px 16px;
  color: var(--muted);
  font-size: var(--fs-14);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-standard);
}
```

## Target

Explicit property list, matching the sibling `.action-button` / `.sidebar-link` pattern elsewhere in the file:

```css
/* target */
  transition:
    background-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
```

## Repo conventions to follow

- Explicit transition lists with tokens — exemplar: `src/App.css:264-266` `.sidebar-link` (`background-color var(--dur-fast) var(--ease-standard), color …, border-color …`).

## Steps

1. `src/App.css:4008` — replace `transition: all var(--dur-fast) var(--ease-standard);` with the three-line explicit list above.

## Boundaries

- Only this rule. Do NOT touch `.tab-button:hover`, `.tab-button.is-active`, or the Fitness page markup.

## Verification

- **Mechanical**: `npm run build` passes; `grep -n "transition: all" src/App.css` returns nothing.
- **Feel check**: on the Fitness page, switching tabs still crossfades hover background/color identically.
- **Done when**: the `all` keyword is gone and the hover feel is unchanged.
