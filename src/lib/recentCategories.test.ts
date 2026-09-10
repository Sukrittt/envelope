import { describe, expect, it } from 'vitest'
import { pushRecent, deriveRecentsFromExpenses, orderWithRecents, MAX_RECENT } from "./recentCategories";
import type { CategoryRow, ExpenseRow } from "@/src/types";

function expense(overrides: Partial<ExpenseRow>): ExpenseRow {
  return {
    timestamp: "",
    date: "",
    item: "item",
    amount_inr: "100",
    category: "Food",
    notes: "",
    source: "manual",
    amount: "100",
    description: "",
    payment_method: "",
    ...overrides,
  };
}

function category(name: string, group = "Essentials"): CategoryRow {
  return { name, group };
}

describe("pushRecent", () => {
  it("puts a new name at the front", () => {
    expect(pushRecent(["Food"], "Fuel")).toEqual(["Fuel", "Food"]);
  });

  it("moves an existing name to the front instead of duplicating it", () => {
    expect(pushRecent(["Food", "Fuel", "Rent"], "Fuel")).toEqual([
      "Fuel",
      "Food",
      "Rent",
    ]);
  });

  it("caps the list at MAX_RECENT", () => {
    const list = Array.from({ length: MAX_RECENT }, (_, i) => `Cat${i}`);
    const result = pushRecent(list, "New");
    expect(result.length).toBe(MAX_RECENT);
    expect(result[0]).toBe("New");
    expect(result).not.toContain(`Cat${MAX_RECENT - 1}`);
  });

  it("is a no-op for a blank or whitespace-only name", () => {
    expect(pushRecent(["Food"], "")).toEqual(["Food"]);
    expect(pushRecent(["Food"], "   ")).toEqual(["Food"]);
  });

  it("trims the name before storing it", () => {
    expect(pushRecent([], "  Fuel  ")).toEqual(["Fuel"]);
  });
});

describe("deriveRecentsFromExpenses", () => {
  const categories = [category("Food"), category("Fuel"), category("Rent")];

  it("orders categories by most-recent use", () => {
    const expenses = [
      expense({ category: "Food", date: "2026-09-01" }),
      expense({ category: "Fuel", date: "2026-09-05" }),
      expense({ category: "Rent", date: "2026-09-03" }),
    ];
    expect(deriveRecentsFromExpenses(expenses, categories)).toEqual([
      "Fuel",
      "Rent",
      "Food",
    ]);
  });

  it("prefers timestamp over date when both are present", () => {
    const expenses = [
      expense({ category: "Food", date: "2026-09-05", timestamp: "2026-09-05T08:00:00Z" }),
      expense({ category: "Fuel", date: "2026-09-05", timestamp: "2026-09-05T20:00:00Z" }),
    ];
    expect(deriveRecentsFromExpenses(expenses, categories)).toEqual(["Fuel", "Food"]);
  });

  it("keeps the most recent occurrence per category, not the count", () => {
    const expenses = [
      expense({ category: "Food", date: "2026-09-01" }),
      expense({ category: "Food", date: "2026-09-02" }),
      expense({ category: "Fuel", date: "2026-09-03" }),
    ];
    expect(deriveRecentsFromExpenses(expenses, categories)).toEqual(["Fuel", "Food"]);
  });

  it("omits categories never used", () => {
    const expenses = [expense({ category: "Food", date: "2026-09-01" })];
    expect(deriveRecentsFromExpenses(expenses, categories)).toEqual(["Food"]);
  });

  it("returns an empty list with no expenses", () => {
    expect(deriveRecentsFromExpenses([], categories)).toEqual([]);
  });
});

describe("orderWithRecents", () => {
  it("moves recents that still exist to the front, in recency order", () => {
    expect(orderWithRecents(["Food", "Fuel", "Rent"], ["Rent", "Food"])).toEqual([
      "Rent",
      "Food",
      "Fuel",
    ]);
  });

  it("drops recents that no longer exist in categories", () => {
    expect(orderWithRecents(["Food", "Fuel"], ["Deleted", "Fuel"])).toEqual([
      "Fuel",
      "Food",
    ]);
  });

  it("is a no-op with no recents", () => {
    expect(orderWithRecents(["Food", "Fuel"], [])).toEqual(["Food", "Fuel"]);
  });

  it("preserves original order among the non-recent remainder", () => {
    expect(orderWithRecents(["A", "B", "C", "D"], ["C"])).toEqual([
      "C",
      "A",
      "B",
      "D",
    ]);
  });
});
