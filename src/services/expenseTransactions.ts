export interface Transaction {
  timestamp: string
  date: string
  item: string
  amountInr: number
  category: string
  notes: string
  source: string
}

export async function loadTransactions(): Promise<Transaction[]> {
  const resp = await fetch('/productivity/expenses.csv')
  if (!resp.ok) throw new Error(`Failed to load expenses: ${resp.status}`)
  const text = await resp.text()
  return parseCSV(text)
}

function parseCSV(text: string): Transaction[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const idx = (name: string) => header.indexOf(name)

  const iTimestamp = idx('timestamp')
  const iDate = idx('date')
  const iItem = idx('item')
  const iAmount = idx('amount_inr')
  const iCategory = idx('category')
  const iNotes = idx('notes')
  const iSource = idx('source')

  const rows: Transaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const amountInr = Number(cols[iAmount])
    if (Number.isNaN(amountInr)) continue
    rows.push({
      timestamp: cols[iTimestamp] ?? '',
      date: cols[iDate] ?? '',
      item: cols[iItem] ?? '',
      amountInr,
      category: cols[iCategory] ?? '',
      notes: cols[iNotes] ?? '',
      source: cols[iSource] ?? '',
    })
  }
  return rows
}
