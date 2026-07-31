import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PRODUCTIVITY = resolve(import.meta.dirname, 'productivity')
const EXPENSES_PATH = resolve(PRODUCTIVITY, 'expenses.csv')
const BUDGETS_PATH = resolve(PRODUCTIVITY, 'budgets.csv')
const CATEGORIES_PATH = resolve(PRODUCTIVITY, 'categories.csv')
const GROUPS_PATH = resolve(PRODUCTIVITY, 'groups.csv')
// Subscriptions live under data/, not productivity/ — see prebuild in package.json
const SUBSCRIPTIONS_PATH = resolve(import.meta.dirname, 'data', 'subscriptions.csv')
const HOLDINGS_PATH = resolve(import.meta.dirname, 'data', 'holdings.csv')
const HOLDING_EVENTS_PATH = resolve(import.meta.dirname, 'data', 'holding_events.csv')

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

  // ── Categories ──
  if (pathname === '/api/categories' && method === 'GET') {
    const rows = readCsv(CATEGORIES_PATH).filter(r => r.length > 0)
    const header = rows[0]
    const iName = header.indexOf('name')
    const iGroup = header.indexOf('group')
    json(rows.slice(1).map(r => ({ name: r[iName] ?? '', group: iGroup >= 0 ? (r[iGroup] ?? '') : '' })).filter(c => c.name))
    return true
  }

  if (pathname === '/api/categories' && method === 'POST') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    const rows = readCsv(CATEGORIES_PATH)
    if (rows.length === 0) rows.push(['name', 'group'])
    if (rows[0].indexOf('group') < 0) rows[0].push('group')
    rows.push([body.name, body.group ?? ''])
    writeCsv(CATEGORIES_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/categories' && method === 'PUT') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    const rows = readCsv(CATEGORIES_PATH)
    const idx = rows.findIndex(r => r[0] === body.name)
    if (idx < 1) { error('category not found', 404); return true }
    if (body.newName && body.newName !== body.name) {
      rows[idx][0] = body.newName
      const budgets = readCsv(BUDGETS_PATH)
      if (budgets.length > 1) {
        const ci = budgets[0].indexOf('category')
        if (ci >= 0) {
          for (let i = 1; i < budgets.length; i++) {
            if (budgets[i][ci] === body.name) budgets[i][ci] = body.newName
          }
          writeCsv(BUDGETS_PATH, budgets)
        }
      }
      const expenses = readCsv(EXPENSES_PATH)
      if (expenses.length > 1) {
        const ci = expenses[0].indexOf('category')
        if (ci >= 0) {
          let changed = false
          for (let i = 1; i < expenses.length; i++) {
            if (expenses[i][ci] === body.name) { expenses[i][ci] = body.newName; changed = true }
          }
          if (changed) writeCsv(EXPENSES_PATH, expenses)
        }
      }
    }
    if (body.group !== undefined) {
      if (rows[0].indexOf('group') < 0) rows[0].push('group')
      const gi = rows[0].indexOf('group')
      while (rows[idx].length <= gi) rows[idx].push('')
      rows[idx][gi] = body.group
    }
    writeCsv(CATEGORIES_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/categories' && method === 'DELETE') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    let rows = readCsv(CATEGORIES_PATH)
    const before = rows.length
    rows = [rows[0], ...rows.slice(1).filter(r => r[0] !== body.name)]
    if (rows.length === before) { error('category not found', 404); return true }
    writeCsv(CATEGORIES_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/categories/reorder' && method === 'POST') {
    const body = await readBody()
    if (!body.name || !body.direction) { error('name, direction required'); return true }
    const rows = readCsv(CATEGORIES_PATH)
    const idx = rows.findIndex(r => r[0] === body.name)
    if (idx < 1) { error('category not found', 404); return true }
    const gi = rows[0].indexOf('group')
    const group = gi >= 0 ? (rows[idx][gi] ?? '') : ''
    const step = body.direction === 'up' ? -1 : 1
    let target = idx + step
    while (target >= 1 && target < rows.length) {
      const tGroup = gi >= 0 ? (rows[target][gi] ?? '') : ''
      if (tGroup === group) break
      target += step
    }
    if (target < 1 || target >= rows.length) { error('no adjacent category to swap', 400); return true }
    const tmp = rows[idx]
    rows[idx] = rows[target]
    rows[target] = tmp
    writeCsv(CATEGORIES_PATH, rows)
    json({ ok: true })
    return true
  }

  // ── Groups ──
  if (pathname === '/api/groups' && method === 'GET') {
    const rows = readCsv(GROUPS_PATH).filter(r => r.length > 0)
    json(rows.slice(1).map(r => r[0]).filter(Boolean))
    return true
  }

  if (pathname === '/api/groups' && method === 'POST') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    const rows = readCsv(GROUPS_PATH)
    if (rows.length === 0) rows.push(['name'])
    if (rows.some(r => r[0] === body.name)) { error('group already exists', 409); return true }
    rows.push([body.name])
    writeCsv(GROUPS_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/groups' && method === 'PUT') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    const rows = readCsv(GROUPS_PATH)
    const idx = rows.findIndex(r => r[0] === body.name)
    if (idx < 1) { error('group not found', 404); return true }
    if (body.newName) {
      rows[idx][0] = body.newName
      writeCsv(GROUPS_PATH, rows)
      const cats = readCsv(CATEGORIES_PATH)
      if (cats.length && cats[0].indexOf('group') >= 0) {
        const gi = cats[0].indexOf('group')
        for (let i = 1; i < cats.length; i++) {
          if ((cats[i][gi] ?? '') === body.name) cats[i][gi] = body.newName
        }
        writeCsv(CATEGORIES_PATH, cats)
      }
    }
    json({ ok: true })
    return true
  }

  if (pathname === '/api/groups' && method === 'DELETE') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    let rows = readCsv(GROUPS_PATH)
    const before = rows.length
    rows = [rows[0], ...rows.slice(1).filter(r => r[0] !== body.name)]
    if (rows.length === before) { error('group not found', 404); return true }
    writeCsv(GROUPS_PATH, rows)
    const cats = readCsv(CATEGORIES_PATH)
    if (cats.length && cats[0].indexOf('group') >= 0) {
      const gi = cats[0].indexOf('group')
      for (let i = 1; i < cats.length; i++) {
        if ((cats[i][gi] ?? '') === body.name) cats[i][gi] = ''
      }
      writeCsv(CATEGORIES_PATH, cats)
    }
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
    const paymentMethod = body.payment_method ?? 'bank'
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
        case 'payment_method': return paymentMethod
        default: return ''
      }
    })
    rows.push(row)
    writeCsv(EXPENSES_PATH, rows)
    categoryCache = null

    // Auto-transfer to Credit Card envelope for CC purchases
    if (paymentMethod === 'credit_card') {
      const amountNum = Number(body.amount_inr)
      if (!Number.isNaN(amountNum) && amountNum > 0) {
        const month = date.slice(0, 7)
        const budgetRows = readCsv(BUDGETS_PATH)
        if (!budgetRows.length) budgetRows.push(['month', 'category', 'assigned', 'rolled_over'])
        const bHeader = budgetRows[0]
        const iMonth = bHeader.indexOf('month')
        const iCategory = bHeader.indexOf('category')
        const iAssigned = bHeader.indexOf('assigned')
        let found = false
        for (let i = 1; i < budgetRows.length; i++) {
          if (budgetRows[i][iMonth] === month && budgetRows[i][iCategory] === '__credit_card__') {
            const current = Number(budgetRows[i][iAssigned]) || 0
            budgetRows[i][iAssigned] = String(current + amountNum)
            found = true
            break
          }
        }
        if (!found) {
          budgetRows.push([month, '__credit_card__', String(amountNum), '0'])
        }
        writeCsv(BUDGETS_PATH, budgetRows)
      }
    }

    json({ ok: true })
    return true
  }

  if (pathname === '/api/expenses' && method === 'PUT') {
    const body = await readBody()
    if (!body.timestamp || !body.category) { error('timestamp and category required'); return true }
    const rows = readCsv(EXPENSES_PATH)
    if (rows.length < 2) { error('no expenses', 404); return true }
    const header = rows[0]
    const iTimestamp = header.indexOf('timestamp')
    const iItem = header.indexOf('item')
    const iAmount = header.indexOf('amount_inr')
    const iCategory = header.indexOf('category')
    let found = false
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][iTimestamp] === body.timestamp &&
          rows[i][iItem] === body.item &&
          Number(rows[i][iAmount]) === Number(body.amount_inr)) {
        rows[i][iCategory] = body.category
        found = true
        break
      }
    }
    if (!found) { error('expense row not found', 404); return true }
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

  // ── Subscriptions ──
  if (pathname === '/api/subscriptions' && method === 'GET') {
    const rows = readCsv(SUBSCRIPTIONS_PATH)
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

  if (pathname === '/api/subscriptions' && method === 'POST') {
    const body = await readBody()
    if (!body.service || !body.amount_inr) { error('service, amount_inr required'); return true }
    const rows = readCsv(SUBSCRIPTIONS_PATH)
    if (!rows.length) rows.push(['timestamp', 'service', 'amount_inr', 'billing_cycle', 'next_due_date', 'status', 'renewal_or_end_month', 'notes'])
    const header = rows[0]
    const iService = header.indexOf('service')
    if (rows.slice(1).some(r => r[iService]?.toLowerCase() === body.service.toLowerCase())) {
      error('subscription already exists', 409)
      return true
    }
    const now = new Date()
    rows.push(header.map(h => {
      switch (h) {
        case 'timestamp': return body.timestamp || `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 8)}+05:30`
        case 'service': return body.service
        case 'amount_inr': return String(body.amount_inr)
        case 'billing_cycle': return body.billing_cycle || 'monthly'
        case 'next_due_date': return body.next_due_date ?? ''
        case 'status': return 'active'
        case 'renewal_or_end_month': return body.renewal_or_end_month ?? ''
        case 'notes': return body.notes ?? ''
        default: return ''
      }
    }))
    writeCsv(SUBSCRIPTIONS_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/subscriptions' && method === 'PUT') {
    const body = await readBody()
    if (!body.service) { error('service required'); return true }
    const rows = readCsv(SUBSCRIPTIONS_PATH)
    if (rows.length < 2) { error('no subscriptions', 404); return true }
    const header = rows[0]
    const iService = header.indexOf('service')
    const iAmount = header.indexOf('amount_inr')
    const iCycle = header.indexOf('billing_cycle')
    const iDue = header.indexOf('next_due_date')
    const iStatus = header.indexOf('status')
    const iRenewal = header.indexOf('renewal_or_end_month')
    const iNotes = header.indexOf('notes')
    let found = false
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][iService] !== body.service) continue
      if (body.new_service !== undefined) rows[i][iService] = body.new_service
      if (body.amount_inr !== undefined) rows[i][iAmount] = String(body.amount_inr)
      if (body.billing_cycle !== undefined) rows[i][iCycle] = body.billing_cycle
      if (body.next_due_date !== undefined) rows[i][iDue] = body.next_due_date
      if (body.notes !== undefined) rows[i][iNotes] = body.notes
      if (body.status !== undefined) rows[i][iStatus] = body.status
      if (body.renewalOrEndMonth !== undefined) rows[i][iRenewal] = body.renewalOrEndMonth
      // Cancelling: access runs to the end of the current billing term
      if (body.status === 'cancelled' && body.renewalOrEndMonth === undefined) {
        const expiry = new Date()
        expiry.setMonth(expiry.getMonth() + 1)
        rows[i][iRenewal] = expiry.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
      // Reactivating: drop the stale cancellation end date
      if (body.status === 'active' && body.renewalOrEndMonth === undefined) {
        rows[i][iRenewal] = ''
      }
      found = true
      break
    }
    if (!found) { error('subscription not found', 404); return true }
    writeCsv(SUBSCRIPTIONS_PATH, rows)
    json({ ok: true })
    return true
  }

  // ── Holdings (Investments) ──
  if (pathname === '/api/holdings' && method === 'GET') {
    const rows = readCsv(HOLDINGS_PATH)
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

  if (pathname === '/api/holdings' && method === 'POST') {
    const body = await readBody()
    if (!body.name || body.value === undefined) { error('name, value required'); return true }
    const rows = readCsv(HOLDINGS_PATH)
    if (!rows.length) rows.push(['name', 'type', 'value', 'updated_at'])
    const header = rows[0]
    const iName = header.indexOf('name')
    if (rows.slice(1).some(r => r[iName]?.toLowerCase() === body.name.toLowerCase())) {
      error('holding already exists', 409)
      return true
    }
    const now = new Date()
    rows.push(header.map(h => {
      switch (h) {
        case 'name': return body.name
        case 'type': return body.type ?? ''
        case 'value': return String(body.value)
        case 'updated_at': return body.updated_at || now.toISOString()
        default: return ''
      }
    }))
    writeCsv(HOLDINGS_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/holdings' && method === 'PUT') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    const rows = readCsv(HOLDINGS_PATH)
    if (rows.length < 2) { error('no holdings', 404); return true }
    const header = rows[0]
    const iName = header.indexOf('name')
    const iType = header.indexOf('type')
    const iValue = header.indexOf('value')
    const iUpdated = header.indexOf('updated_at')
    let found = false
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][iName] !== body.name) continue
      if (body.new_name !== undefined) rows[i][iName] = body.new_name
      if (body.type !== undefined) rows[i][iType] = body.type
      if (body.value !== undefined) rows[i][iValue] = String(body.value)
      if (body.value !== undefined || body.updated_at !== undefined) {
        rows[i][iUpdated] = body.updated_at || new Date().toISOString()
      }
      found = true
      break
    }
    if (!found) { error('holding not found', 404); return true }
    writeCsv(HOLDINGS_PATH, rows)
    json({ ok: true })
    return true
  }

  if (pathname === '/api/holdings' && method === 'DELETE') {
    const body = await readBody()
    if (!body.name) { error('name required'); return true }
    const rows = readCsv(HOLDINGS_PATH)
    if (rows.length < 2) { error('no holdings', 404); return true }
    const header = rows[0]
    const iName = header.indexOf('name')
    const idx = rows.slice(1).findIndex(r => r[iName] === body.name)
    if (idx === -1) { error('holding not found', 404); return true }
    rows.splice(idx + 1, 1)
    writeCsv(HOLDINGS_PATH, rows)
    json({ ok: true })
    return true
  }

  // ── Holding Events ──
  if (pathname === '/api/holding-events' && method === 'GET') {
    const rows = readCsv(HOLDING_EVENTS_PATH)
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

  // ── Holdings Actions (market update / contribution / withdrawal) ──
  if (pathname === '/api/holdings/action' && method === 'POST') {
    const body = await readBody()
    if (!body.name || !body.action || body.amount === undefined) { error('name, action, amount required'); return true }

    // Update holding value
    const rows = readCsv(HOLDINGS_PATH)
    if (rows.length < 2) { error('no holdings', 404); return true }
    const header = rows[0]
    const iName = header.indexOf('name')
    const iValue = header.indexOf('value')
    const iUpdated = header.indexOf('updated_at')
    let found = false
    let prevValue = 0
    let newValue = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][iName] !== body.name) continue
      prevValue = Number(rows[i][iValue]) || 0
      switch (body.action) {
        case 'market_update': newValue = Math.max(0, Number(body.amount)); break
        case 'contribution': newValue = prevValue + Number(body.amount); break
        case 'withdrawal': newValue = Math.max(0, prevValue - Number(body.amount)); break
        default: error('invalid action'); return true
      }
      rows[i][iValue] = String(newValue)
      rows[i][iUpdated] = new Date().toISOString()
      found = true
      break
    }
    if (!found) { error('holding not found', 404); return true }
    writeCsv(HOLDINGS_PATH, rows)

    // Adjust income for contribution/withdrawal (affects Ready to Assign)
    if ((body.action === 'contribution' || body.action === 'withdrawal') && body.month) {
      const budgetRows = readCsv(BUDGETS_PATH)
      if (budgetRows.length > 1) {
        const bHeader = budgetRows[0]
        const iBMonth = bHeader.indexOf('month')
        const iBCategory = bHeader.indexOf('category')
        const iBAssigned = bHeader.indexOf('assigned')
        for (let i = 1; i < budgetRows.length; i++) {
          if (budgetRows[i][iBMonth] === body.month && budgetRows[i][iBCategory] === '__income__') {
            const currentIncome = Number(budgetRows[i][iBAssigned]) || 0
            const delta = body.action === 'contribution' ? -Number(body.amount) : Number(body.amount)
            budgetRows[i][iBAssigned] = String(Math.max(0, currentIncome + delta))
            break
          }
        }
        writeCsv(BUDGETS_PATH, budgetRows)
      }
    }

    // Log event
    let eventRows = readCsv(HOLDING_EVENTS_PATH)
    if (!eventRows.length) eventRows.push(['holding_name', 'event_type', 'amount', 'previous_value', 'new_value', 'timestamp'])
    const now = new Date().toISOString()
    eventRows.push([body.name, body.action, String(body.amount), String(prevValue), String(newValue), now])
    writeCsv(HOLDING_EVENTS_PATH, eventRows)

    json({ ok: true, previousValue: prevValue, newValue })
    return true
  }

  return false
}
