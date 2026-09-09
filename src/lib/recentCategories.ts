import type { CategoryRow, ExpenseRow } from "@/src/types";

/** How many categories the "Recently used" section keeps. */
export const MAX_RECENT = 8;

/**
 * Moves `name` to the front of `list`, dropping any earlier occurrence and
 * capping the result at `MAX_RECENT`. Pure — callers persist the result.
 * A blank name (nothing picked yet) is a no-op.
 */
export function pushRecent(list: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return [trimmed, ...list.filter((n) => n !== trimmed)].slice(0, MAX_RECENT);
}

/**
 * Seeds "Recently used" from expense history before the device has built up
 * its own MRU list (first launch after this ships, or a fresh install).
 * Orders by most-recent `timestamp` per category, falling back to `date` for
 * rows written before `timestamp` existed. Mirrors the sort that used to live
 * inline in log-expense.tsx.
 */
export function deriveRecentsFromExpenses(
  expenses: ExpenseRow[],
  categories: CategoryRow[],
): string[] {
  const lastUsed = new Map<string, string>();
  for (const row of expenses) {
    const marker = row.timestamp || row.date;
    const seen = lastUsed.get(row.category);
    if (!seen || marker > seen) lastUsed.set(row.category, marker);
  }
  return categories
    .map((c) => c.name)
    .filter((name) => lastUsed.has(name))
    .sort((a, b) => lastUsed.get(b)!.localeCompare(lastUsed.get(a)!))
    .slice(0, MAX_RECENT);
}
