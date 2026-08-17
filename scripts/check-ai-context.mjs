import assert from 'node:assert/strict'

// Mirrors Web/lib/ai/expenseContext.ts (summarizeExpenses) and
// Web/src/services/budgetLoader.ts (computeEnvelopes) — kept in sync
// manually since this is a plain Node script and can't import the TS
// modules directly (see scripts/check-now-ist.mjs for the same pattern).

const SENTINEL_INCOME = '__income__'
const SENTINEL_CREDIT_CARD = '__credit_card__'
const TXN_HISTORY_DAYS = 90
const TXN_CAP = 400
const TREND_MONTHS = 6

function computeEnvelopes(budgets, expenses, currentMonth, categories, groups) {
  const monthBudgets = budgets.filter((b) => b.month === currentMonth)
  const prevMonthBudgets = budgets.filter((b) => b.month < currentMonth)

  const prevMonthMap = new Map()
  for (const b of prevMonthBudgets) {
    const arr = prevMonthMap.get(b.category) ?? []
    arr.push(b)
    prevMonthMap.set(b.category, arr)
  }

  const incomeRow = monthBudgets.find((b) => b.category === '__income__')
  const income = incomeRow?.assigned ?? 0

  const monthSpending = new Map()
  for (const e of expenses) {
    if (!e.date.startsWith(currentMonth)) continue
    monthSpending.set(e.category, (monthSpending.get(e.category) ?? 0) + e.amountInr)
  }

  const lastSpentByCat = new Map()
  for (const e of expenses) {
    if (!e.date) continue
    const current = lastSpentByCat.get(e.category)
    if (!current || e.date > current) lastSpentByCat.set(e.category, e.date)
  }

  const categoryGroup = new Map()
  for (const c of categories) categoryGroup.set(c.name, c.group ?? '')

  const budgetCategories = new Set(
    [...monthBudgets, ...prevMonthBudgets].filter((b) => b.category !== '__income__').map((b) => b.category),
  )

  const allCategories = [...new Set([...categories.map((c) => c.name), ...budgetCategories])]

  const envelopes = []
  let totalAssigned = 0
  let totalSpent = 0

  for (const category of allCategories) {
    const curr = monthBudgets.find((b) => b.category === category)
    const prevMonths = prevMonthMap.get(category) ?? []
    const prevSorted = prevMonths.sort((a, b) => b.month.localeCompare(a.month))
    const prev = prevSorted[0]

    let prevSpent = 0
    if (prev) {
      const prevExpenses = expenses.filter((e) => e.date.startsWith(prev.month) && e.category === category)
      prevSpent = prevExpenses.reduce((s, e) => s + e.amountInr, 0)
    }

    const isCC = category === '__credit_card__'
    const assigned = curr?.assigned ?? 0
    const rolledOver = curr?.rolledOver ?? 0
    const computedRollover = prev ? Math.max(0, prev.assigned + prev.rolledOver - prevSpent) : rolledOver

    const spent = monthSpending.get(category) ?? 0
    const available = assigned + computedRollover - spent

    if (!isCC) {
      totalAssigned += assigned
      totalSpent += spent
    }

    envelopes.push({
      category,
      group: isCC ? '' : (categoryGroup.get(category) ?? ''),
      assigned,
      spent,
      available,
      rolledOver: computedRollover,
      isOverspent: available < 0,
      spentPct: assigned > 0 ? Math.min(100, (spent / assigned) * 100) : spent > 0 ? 100 : 0,
      isCreditCardPayment: isCC,
      lastSpentDate: lastSpentByCat.get(category),
    })
  }

  const readyToAssign = Math.round(income - totalAssigned) || 0

  return {
    month: currentMonth,
    income,
    totalAssigned,
    totalSpent,
    readyToAssign,
    envelopes,
    isOverAssigned: readyToAssign < 0,
    groups: groups.filter((g) => envelopes.some((e) => e.group === g)),
  }
}

function round(n) {
  return Math.round(n) || 0
}

function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate()
}

function lastNMonths(currentMonth, n) {
  const [y, m] = currentMonth.split('-').map(Number)
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function cycleMonths(cycle) {
  switch ((cycle ?? '').toLowerCase()) {
    case 'weekly':
      return 12 / 52
    case 'biweekly':
      return 12 / 26
    case 'quarterly':
      return 3
    case 'half-yearly':
    case 'semi-annual':
    case 'halfyearly':
      return 6
    case 'yearly':
    case 'annual':
    case 'annually':
      return 12
    case 'monthly':
    default:
      return 1
  }
}

function summarizeExpenses(input) {
  const { expenses, budgets, categories, groups, subscriptions, currentMonth, today } = input

  const [cy, cm] = currentMonth.split('-').map(Number)
  const totalDaysInMonth = daysInMonth(cy, cm)
  const daysElapsed = Math.min(Number(today.split('-')[2]) || 0, totalDaysInMonth)
  const daysLeft = Math.max(0, totalDaysInMonth - daysElapsed)

  const realCategories = categories
    .filter((c) => c.name !== SENTINEL_INCOME && c.name !== SENTINEL_CREDIT_CARD)
    .map((c) => ({ name: c.name, group: c.group ?? '' }))

  const budgetRows = budgets.map((b) => ({
    month: b.month,
    category: b.category,
    assigned: Number(b.assigned) || 0,
    rolledOver: Number(b.rolled_over) || 0,
  }))

  const envelopeExpenseRows = expenses.map((e) => ({
    date: e.date,
    amountInr: Number(e.amount_inr) || 0,
    category: e.category,
  }))

  const groupNames = groups.map((g) => g.name)

  const envelopeState = computeEnvelopes(budgetRows, envelopeExpenseRows, currentMonth, realCategories, groupNames)

  const income = envelopeState.income
  const ccEnvelope = envelopeState.envelopes.find((e) => e.isCreditCardPayment)

  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth))
  const realMonthExpenses = monthExpenses.filter(
    (e) => e.category !== SENTINEL_INCOME && e.category !== SENTINEL_CREDIT_CARD,
  )

  const lines = []

  lines.push(`MONTH: ${currentMonth} (day ${daysElapsed} of ${totalDaysInMonth}, ${daysLeft} days left)`)
  lines.push('')
  lines.push(`INCOME: ${round(income)}`)
  if (ccEnvelope) {
    lines.push(
      `CREDIT CARD: assigned ${round(ccEnvelope.assigned)}, charged ${round(ccEnvelope.spent)} this month, available ${round(ccEnvelope.available)}`,
    )
  } else {
    lines.push('CREDIT CARD: no activity')
  }
  lines.push('')

  lines.push('ENVELOPES (category|group|assigned|spent|available|overspent):')
  for (const e of envelopeState.envelopes) {
    if (e.isCreditCardPayment) continue
    lines.push(
      `${e.category}|${e.group ?? ''}|${round(e.assigned)}|${round(e.spent)}|${round(e.available)}|${e.isOverspent ? 'yes' : 'no'}`,
    )
  }
  lines.push('')

  const trendMonths = lastNMonths(currentMonth, TREND_MONTHS)
  const trendSet = new Set(trendMonths)
  const trendCategoryTotals = new Map()
  for (const e of expenses) {
    if (e.category === SENTINEL_INCOME || e.category === SENTINEL_CREDIT_CARD) continue
    const month = e.date.slice(0, 7)
    if (!trendSet.has(month)) continue
    const catMap = trendCategoryTotals.get(e.category) ?? new Map()
    catMap.set(month, (catMap.get(month) ?? 0) + (Number(e.amount_inr) || 0))
    trendCategoryTotals.set(e.category, catMap)
  }
  lines.push(`TREND (category totals by month, last ${TREND_MONTHS} months):`)
  lines.push(`category|${trendMonths.join('|')}`)
  for (const [category, monthMap] of [...trendCategoryTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const totals = trendMonths.map((m) => round(monthMap.get(m) ?? 0))
    if (totals.every((v) => v === 0)) continue
    lines.push(`${category}|${totals.join('|')}`)
  }
  lines.push('')

  const top10 = [...realMonthExpenses].sort((a, b) => (Number(b.amount_inr) || 0) - (Number(a.amount_inr) || 0)).slice(0, 10)
  lines.push('TOP 10 ITEMS THIS MONTH (date|item|amount|category):')
  for (const e of top10) {
    lines.push(`${e.date}|${e.item ?? ''}|${round(Number(e.amount_inr) || 0)}|${e.category}`)
  }
  lines.push('')

  lines.push('SUBSCRIPTIONS (service|billing_cycle|amount|monthly_burn|status):')
  let totalMonthlyBurn = 0
  for (const s of subscriptions) {
    const amount = Number(s.amount_inr) || 0
    const monthlyBurn = amount / cycleMonths(s.billing_cycle)
    const status = s.status ?? ''
    const isActive = !['cancelled', 'canceled', 'ended', 'paused'].includes(status.toLowerCase())
    if (isActive) totalMonthlyBurn += monthlyBurn
    lines.push(`${s.service}|${s.billing_cycle ?? ''}|${round(amount)}|${round(monthlyBurn)}|${status || 'active'}`)
  }
  lines.push(`Total active monthly burn: ${round(totalMonthlyBurn)}`)
  lines.push('')

  const cutoff = new Date(`${today}T00:00:00`)
  cutoff.setDate(cutoff.getDate() - TXN_HISTORY_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const recentTxns = expenses
    .filter((e) => e.date >= cutoffStr && e.date <= today)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return (b.timestamp ?? '').localeCompare(a.timestamp ?? '')
    })
    .slice(0, TXN_CAP)
  lines.push(
    `TRANSACTIONS (last ${TXN_HISTORY_DAYS} days, newest first, capped at ${TXN_CAP}; date|item|amount|category|payment_method):`,
  )
  for (const e of recentTxns) {
    lines.push(`${e.date}|${e.item ?? ''}|${round(Number(e.amount_inr) || 0)}|${e.category}|${e.payment_method ?? ''}`)
  }

  const facts = lines.join('\n')

  return {
    facts,
    meta: {
      txnCountThisMonth: monthExpenses.length,
      totalSpent: round(envelopeState.totalSpent),
      totalAssigned: round(envelopeState.totalAssigned),
      daysLeft,
    },
  }
}

// ---------------------------------------------------------------------------
// Fixture: a handful of expenses across 2 months, one real budget row, one
// __income__ row, one __credit_card__ row, one subscription.
// ---------------------------------------------------------------------------

const today = '2026-08-18'
const currentMonth = '2026-08'

const budgets = [
  { month: '2026-08', category: '__income__', assigned: 100000, rolled_over: 0 },
  { month: '2026-08', category: 'Food', assigned: 5000, rolled_over: 0 },
  { month: '2026-08', category: '__credit_card__', assigned: 3000, rolled_over: 0 },
]

const categories = [{ name: 'Food', group: 'Essentials' }]
const groups = [{ name: 'Essentials' }]
const subscriptions = [{ service: 'Netflix', amount_inr: 649, billing_cycle: 'monthly', status: 'active' }]

const expenses = [
  { date: '2026-08-01', item: 'Groceries', amount_inr: 1200, category: 'Food', payment_method: 'card' },
  { date: '2026-08-05', item: 'Restaurant', amount_inr: 800, category: 'Food', payment_method: 'cash' },
  { date: '2026-08-10', item: 'CC Payment', amount_inr: 2000, category: '__credit_card__', payment_method: 'bank' },
  { date: '2026-07-15', item: 'Groceries', amount_inr: 900, category: 'Food', payment_method: 'card' },
]

const result = summarizeExpenses({ expenses, budgets, categories, groups, subscriptions, currentMonth, today })

// Month filtering: only the 3 August docs count as "this month".
assert.equal(result.meta.txnCountThisMonth, 3, 'txnCountThisMonth should only count August rows')

// Per-category totals: Food envelope spent = 1200 + 800 = 2000 (July's 900 excluded).
assert.match(result.facts, /Food\|Essentials\|5000\|2000\|3000\|no/, 'Food envelope line should show correct assigned/spent/available')
assert.equal(result.meta.totalSpent, 2000, 'totalSpent should exclude __credit_card__ and July spend')
assert.equal(result.meta.totalAssigned, 5000, 'totalAssigned should exclude __credit_card__/__income__')

// __income__ must never appear as an envelope row.
const envelopeSection = result.facts.split('ENVELOPES')[1].split('TREND')[0]
assert.ok(!envelopeSection.includes('__income__'), '__income__ must not appear in the envelope table')
assert.ok(!envelopeSection.includes('__credit_card__'), '__credit_card__ must not appear in the envelope table (reported separately)')
assert.match(result.facts, /CREDIT CARD: assigned 3000, charged 2000 this month, available 1000/, 'credit card reported separately')
assert.match(result.facts, /INCOME: 100000/, 'income reported separately')

// Expected section headers present.
for (const header of ['MONTH:', 'ENVELOPES', 'TREND', 'TOP 10 ITEMS THIS MONTH', 'SUBSCRIPTIONS', 'TRANSACTIONS']) {
  assert.ok(result.facts.includes(header), `facts should contain section header "${header}"`)
}

// days elapsed/left.
assert.equal(result.meta.daysLeft, 31 - 18, 'daysLeft should be computed from the month length and today')

// ---------------------------------------------------------------------------
// 400-row transaction cap, isolated from the fixture above.
// ---------------------------------------------------------------------------

const manyExpenses = []
for (let i = 0; i < 450; i++) {
  manyExpenses.push({
    date: '2026-08-17',
    timestamp: `2026-08-17T${String(i % 24).padStart(2, '0')}:00:00+05:30`,
    item: `Item ${i}`,
    amount_inr: 10,
    category: 'Food',
    payment_method: 'card',
  })
}

const capResult = summarizeExpenses({
  expenses: manyExpenses,
  budgets: [{ month: '2026-08', category: 'Food', assigned: 100000, rolled_over: 0 }],
  categories: [{ name: 'Food', group: 'Essentials' }],
  groups: [{ name: 'Essentials' }],
  subscriptions: [],
  currentMonth: '2026-08',
  today: '2026-08-18',
})

const txnSection = capResult.facts.split('TRANSACTIONS')[1]
const txnLines = txnSection.split('\n').filter((l) => l.startsWith('2026-08-17|'))
assert.equal(txnLines.length, TXN_CAP, `transaction list should be capped at ${TXN_CAP} rows`)

console.log('OK')
