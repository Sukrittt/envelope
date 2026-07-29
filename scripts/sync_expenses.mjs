import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspace = path.resolve(__dirname, '..')

const sourceExpensesPath = path.join(workspace, 'productivity', 'expenses.csv')
const sourceSubscriptionsPath = path.join(workspace, 'productivity', 'subscriptions.csv')
const sourceBudgetsPath = path.join(workspace, 'productivity', 'budgets.csv')
const dataExpensesPath = path.join(workspace, 'data', 'expenses.csv')
const dataBudgetsPath = path.join(workspace, 'data', 'budgets.csv')
const expensePanelPaths = [
  path.join(workspace, 'src', 'data', 'expensePanel.sample.json'),
  path.join(workspace, 'mission-control-app', 'src', 'data', 'expensePanel.sample.json'),
]

const MONTHLY_SPEND_CAP_INR = 45000
const DAILY_SOFT_CAP_INR = 1500
const DUES_RECEIVABLE_INR = 1537.46
const ESSENTIAL_CATEGORIES = new Set(['Bills', 'Food', 'Travel', 'Subscription', 'Work/Investment'])

function parseCsv(text) {
  const rows = []
  let row = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1]
        if (next === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(current)
      current = ''
      continue
    }

    if (char === '\n') {
      row.push(current)
      rows.push(row)
      row = []
      current = ''
      continue
    }

    if (char === '\r') {
      continue
    }

    current += char
  }

  if (current.length || row.length) {
    row.push(current)
    rows.push(row)
  }

  return rows
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function formatCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

function readCsvAsObjects(filePath) {
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] }
  const text = fs.readFileSync(filePath, 'utf8').trim()
  if (!text) return { headers: [], rows: [] }
  const parsed = parseCsv(text)
  const headers = parsed.shift() ?? []
  const rows = parsed.map((row) => {
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? ''
    })
    return obj
  })
  return { headers, rows }
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
}

function groupSum(rows, key, valueKey) {
  const map = new Map()
  rows.forEach((row) => {
    const group = row[key]
    if (!group) return
    map.set(group, (map.get(group) ?? 0) + (Number(row[valueKey]) || 0))
  })
  return [...map.entries()].map(([group, total]) => ({ group, total }))
}

function getLatestDate(rows) {
  let latest = ''
  rows.forEach((row) => {
    const date = row.date || ''
    if (date > latest) latest = date
  })
  return latest
}

function buildExpensePanel(expensesRows, subscriptionsRows, budgetsRows) {
  const latestDate = getLatestDate(expensesRows)
  const month = latestDate ? latestDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
  const monthRows = expensesRows.filter((row) => row.date?.startsWith(month))

  const monthSpendInr = sumBy(monthRows, 'amount_inr')
  const essentialSpendInr = monthRows.reduce((sum, row) => {
    const amount = Number(row.amount_inr) || 0
    return ESSENTIAL_CATEGORIES.has(row.category) ? sum + amount : sum
  }, 0)
  const discretionarySpendInr = monthSpendInr - essentialSpendInr

  const dailySpend = groupSum(monthRows, 'date', 'amount_inr')
    .map(({ group, total }) => ({ date: group, amountInr: Number(total.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const topCategories = groupSum(monthRows, 'category', 'amount_inr')
    .map(({ group, total }) => ({ category: group, amountInr: Number(total.toFixed(2)) }))
    .sort((a, b) => b.amountInr - a.amountInr)

  const spendVsCapPct = MONTHLY_SPEND_CAP_INR ? (monthSpendInr / MONTHLY_SPEND_CAP_INR) * 100 : 0
  const discretionarySharePct = monthSpendInr ? (discretionarySpendInr / monthSpendInr) * 100 : 0

  const alerts = []
  if (spendVsCapPct > 100) {
    alerts.push('Spend cap breached; pause discretionary purchases and recover dues.')
  } else if (spendVsCapPct > 85) {
    alerts.push('Spend cap nearing; keep discretionary spends below daily soft cap.')
  }
  if (discretionarySharePct > 60) {
    alerts.push('Discretionary share above 60%; trigger cooling rule for non-essential purchases this week.')
  }
  if (!alerts.length) {
    alerts.push('Spend tracking stable; keep daily logging consistent.')
  }

  const subscriptions = subscriptionsRows.map((row) => ({
    service: row.service,
    amountInr: Number(row.amount_inr) || 0,
    billingCycle: row.billing_cycle,
    status: row.status,
    renewalOrEndMonth: row.renewal_or_end_month || undefined,
  }))

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      month,
      monthlySpendCapInr: MONTHLY_SPEND_CAP_INR,
      dailySoftCapInr: DAILY_SOFT_CAP_INR,
    },
    totals: {
      monthSpendInr: Number(monthSpendInr.toFixed(2)),
      essentialSpendInr: Number(essentialSpendInr.toFixed(2)),
      discretionarySpendInr: Number(discretionarySpendInr.toFixed(2)),
      duesReceivableInr: DUES_RECEIVABLE_INR,
    },
    topCategories,
    dailySpend,
    alerts,
    deepLinks: [
      { label: 'Open Expense Dashboard', url: '../../expense-dashboard/' },
      { label: 'Expenses CSV', url: '../../productivity/expenses.csv' },
      { label: 'Subscriptions CSV', url: '../../productivity/subscriptions.csv' },
    ],
    subscriptions,
    budgets: budgetsRows,
  }
}

function main() {
  const { rows: expensesRows } = readCsvAsObjects(sourceExpensesPath)
  if (!expensesRows.length) {
    console.error('No expenses found; aborting sync.')
    process.exit(1)
  }

  const { rows: subscriptionsRows } = readCsvAsObjects(sourceSubscriptionsPath)

  const dataHeader = ['timestamp', 'date', 'item', 'amount_inr', 'category', 'notes', 'source']
  const dataRows = [dataHeader]
  expensesRows.forEach((row) => {
    dataRows.push(
      dataHeader.map((key) => row[key] ?? '')
    )
  })

  fs.mkdirSync(path.dirname(dataExpensesPath), { recursive: true })
  fs.writeFileSync(dataExpensesPath, formatCsv(dataRows), 'utf8')

  if (fs.existsSync(sourceBudgetsPath)) {
    const budgetText = fs.readFileSync(sourceBudgetsPath, 'utf8')
    fs.mkdirSync(path.dirname(dataBudgetsPath), { recursive: true })
    fs.writeFileSync(dataBudgetsPath, budgetText, 'utf8')
  }

  const { rows: budgetsRows } = fs.existsSync(sourceBudgetsPath)
    ? readCsvAsObjects(sourceBudgetsPath)
    : { rows: [] }

  const panelPayload = buildExpensePanel(expensesRows, subscriptionsRows, budgetsRows)
  const panelJson = JSON.stringify(panelPayload, null, 2) + '\n'
  expensePanelPaths.forEach((panelPath) => {
    fs.mkdirSync(path.dirname(panelPath), { recursive: true })
    fs.writeFileSync(panelPath, panelJson, 'utf8')
  })
}

main()
