import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PRODUCTIVITY = resolve(import.meta.dirname, 'productivity')
const EXPENSES_PATH = resolve(PRODUCTIVITY, 'expenses.csv')
const BUDGETS_PATH = resolve(PRODUCTIVITY, 'budgets.csv')

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1]
        if (next === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += char
      continue
    }
    if (char === '"') { inQuotes = true; continue }
    if (char === ',') { row.push(current); current = ''; continue }
    if (char === '\n') { row.push(current); rows.push(row); row = []; current = ''; continue }
    if (char === '\r') continue
    current += char
  }
  if (current || row.length) { row.push(current); rows.push(row) }
  return rows
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function toCsv(rows: string[][]): string {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n'
}

function readCsv(path: string): string[][] {
  if (!existsSync(path)) return []
  return parseCsv(readFileSync(path, 'utf-8'))
}

function writeCsv(path: string, rows: string[][]): void {
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, toCsv(rows), 'utf-8')
}

let categoryCache: { words: Record<string, string>; updatedAt: string } | null = null

function buildCategoryMap(): { words: Record<string, string>; updatedAt: string } {
  const rows = readCsv(EXPENSES_PATH)
  if (rows.length < 2) return { words: {}, updatedAt: new Date().toISOString() }
  const header = rows[0]
  const iItem = header.indexOf('item')
  const iCategory = header.indexOf('category')
  if (iItem === -1 || iCategory === -1) return { words: {}, updatedAt: new Date().toISOString() }

  const wordCategories = new Map<string, Map<string, number>>()
  for (let i = 1; i < rows.length; i++) {
    const item = rows[i][iItem] ?? ''
    const category = rows[i][iCategory] ?? ''
    if (!item || !category) continue
    const words = item.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (word.length < 2) continue
      if (!wordCategories.has(word)) wordCategories.set(word, new Map())
      const catCount = wordCategories.get(word)!
      catCount.set(category, (catCount.get(category) ?? 0) + 1)
    }
  }

  const words: Record<string, string> = {}
  for (const [word, cats] of wordCategories) {
    let bestCat = ''
    let bestCount = 0
    for (const [cat, count] of cats) {
      if (count > bestCount) { bestCat = cat; bestCount = count }
    }
    if (bestCat) words[word] = bestCat
  }

  return { words, updatedAt: new Date().toISOString() }
}

export default defineConfig({
  plugins: [react(), {
    name: 'csv-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!await handleApi(req, res)) next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!await handleApi(req, res)) next()
      })
    }
  }],
})

async function handleApi(req: any, res: any): Promise<boolean> {
  const url = new URL(req.url ?? '', 'http://localhost')
  const pathname = url.pathname
  const method = req.method ?? 'GET'

  if (!pathname.startsWith('/api/')) return false

  res.setHeader('Content-Type', 'application/json')

  async function readBody(): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk: string) => { body += chunk })
      req.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch { resolve({}) }
      })
    })
  }

  function json(data: unknown) {
    res.end(JSON.stringify(data))
  }

  function error(msg: string, status = 400) {
    res.statusCode = status
    res.end(JSON.stringify({ error: msg }))
  }

  // ── Budgets ──
  if (pathname === '/api/budgets' && method === 'GET') {
    const rows = readCsv(BUDGETS_PATH)
    if (!rows.length) { json({ headers: [], rows: [] }); return true }
    const headers = rows[0]
    const data = rows.slice(1).map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    })
    json({ headers, rows: data })
    return true
  }

  if (pathname === '/api/budgets' && method === 'POST') {
    const body = await readBody()
    if (!body.month || !body.category || body.assigned === undefined) { error('month, category, assigned required'); return true }
    const rows = readCsv(BUDGETS_PATH)
    if (!rows.length) rows.push(['month', 'category', 'assigned', 'rolled_over'])
    rows.push([body.month, body.category, String(body.assigned), String(body.rolled_over ?? 0)])
    writeCsv(BUDGETS_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/budgets' && method === 'PUT') {
    const body = await readBody()
    if (!body.month || !body.category) { error('month, category required'); return true }
    const rows = readCsv(BUDGETS_PATH)
    if (rows.length < 2) { error('no budgets', 404); return true }
    const header = rows[0]
    const iMonth = header.indexOf('month')
    const iCategory = header.indexOf('category')
    const iAssigned = header.indexOf('assigned')
    const iRolled = header.indexOf('rolled_over')
    let found = false
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][iMonth] === body.month && rows[i][iCategory] === body.category) {
        if (body.assigned !== undefined) rows[i][iAssigned] = String(body.assigned)
        if (body.rolled_over !== undefined) rows[i][iRolled] = String(body.rolled_over)
        if (body.newCategory) rows[i][iCategory] = body.newCategory
        found = true
        break
      }
    }
    if (!found) { error('budget row not found', 404); return true }
    writeCsv(BUDGETS_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/budgets' && method === 'DELETE') {
    const body = await readBody()
    if (!body.month || !body.category) { error('month, category required'); return true }
    const rows = readCsv(BUDGETS_PATH)
    if (rows.length < 2) { error('no budgets', 404); return true }
    const header = rows[0]
    const iMonth = header.indexOf('month')
    const iCategory = header.indexOf('category')
    const filtered = [rows[0], ...rows.slice(1).filter(r => !(r[iMonth] === body.month && r[iCategory] === body.category))]
    if (filtered.length === rows.length) { error('budget row not found', 404); return true }
    writeCsv(BUDGETS_PATH, filtered)
    json({ ok: true })
    return true
  }

  // ── Expenses ──
  if (pathname === '/api/expenses' && method === 'GET') {
    const rows = readCsv(EXPENSES_PATH)
    if (!rows.length) { json({ headers: [], rows: [] }); return true }
    const headers = rows[0]
    const data = rows.slice(1).map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    })
    json({ headers, rows: data })
    return true
  }

  if (pathname === '/api/expenses' && method === 'POST') {
    const body = await readBody()
    if (!body.item || !body.amount_inr || !body.category) { error('item, amount_inr, category required'); return true }
    const now = new Date()
    const date = body.date || now.toISOString().slice(0, 10)
    const timestamp = body.timestamp || `${date}T${now.toTimeString().slice(0, 8)}+05:30`
    const rows = readCsv(EXPENSES_PATH)
    if (!rows.length) rows.push(['timestamp', 'date', 'item', 'amount_inr', 'category', 'notes', 'source', 'amount', 'description', 'payment_method'])
    const header = rows[0]
    const row: string[] = header.map(h => {
      switch (h) {
        case 'timestamp': return timestamp
        case 'date': return date
        case 'item': return body.item
        case 'amount_inr': return String(body.amount_inr)
        case 'category': return body.category
        case 'notes': return body.notes ?? ''
        case 'source': return 'manual'
        default: return ''
      }
    })
    rows.push(row)
    writeCsv(EXPENSES_PATH, rows)
    categoryCache = null
    json({ ok: true })
    return true
  }

  // ── Category Map ──
  if (pathname === '/api/category-map' && method === 'GET') {
    if (!categoryCache) categoryCache = buildCategoryMap()
    json(categoryCache)
    return true
  }

  return false
}
