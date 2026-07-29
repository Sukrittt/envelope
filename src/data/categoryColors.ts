export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drink': '#b8865b',
  'Rent': '#6b8e7a',
  'Transport': '#7a8ba8',
  'Groceries': '#8ba86b',
  'Utilities': '#a07a6b',
  'Entertainment': '#9b7a9b',
  'Shopping': '#b87a7a',
  'Health': '#7a9b8b',
  'Education': '#8b7a6b',
  'Subscriptions': '#6b8a9b',
  'Insurance': '#7a8a7a',
  'Travel': '#9b8b7a',
  'Dining': '#b88a6b',
  'Bills': '#7a7a8b',
  'Fitness': '#8b9b7a',
  'Gifts': '#b87a8b',
  'Clothing': '#7a8b9b',
  'Electronics': '#8b7a8b',
  'Pet': '#9b8a7a',
  'Coffee': '#6b7a5b',
  'Misc': '#7a7a7a',
  'Miscellaneous': '#7a7a7a',
  'Salary': '#6b9b7a',
  'Income': '#6b9b7a',
  'Transfer': '#7a8b8b',
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS[category.toLowerCase()] ?? '#7a7a7a'
}

export function computeDailyCategoryData(
  expenseRows: Array<{ date: string; amountInr: number; category: string }>,
  dateRange: string[],
): Array<{ date: string; value: number; categories: Record<string, number> }> {
  const catByDate = new Map<string, Record<string, number>>()
  const totalByDate = new Map<string, number>()

  for (const row of expenseRows) {
    const prevCats = catByDate.get(row.date) ?? {}
    prevCats[row.category] = (prevCats[row.category] ?? 0) + row.amountInr
    catByDate.set(row.date, prevCats)

    totalByDate.set(row.date, (totalByDate.get(row.date) ?? 0) + row.amountInr)
  }

  return dateRange.map((date) => {
    const categories = catByDate.get(date) ?? {}
    const value = totalByDate.get(date) ?? 0
    return { date, value, categories }
  })
}
