/**
 * Stable empty-array fallback for `query.data ?? EMPTY` sites. `.data` is
 * genuinely `T[] | undefined` while a react-query hook is loading/erroring,
 * but an inline `?? []` allocates a new array every render, which breaks
 * referential-equality checks in any `useMemo`/`useEffect` deps that read it.
 *
 * Typed `never[]` so it unifies with whatever concrete array type each call
 * site expects, without a cast at every use — safe since it's always empty,
 * so there's never an element to mistype.
 *
 * Mobile's copy uses `any[]` for the same reason. `never[]` is assignable to
 * every `T[]` just the same, and web's eslint bans `any`, so this one line
 * deliberately differs from its twin.
 */
export const EMPTY: never[] = []
