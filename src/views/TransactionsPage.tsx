import { Suspense, useEffect, useState } from 'react'
import { TransactionsView } from '../components/TransactionsView'
import { ExpenseSidebar } from '../components/ExpenseSidebar'
import { toExpensePanelData, type ExpensePanelData } from '../services/expensePanelAdapter'
import { loadExpensePanelContract } from '../services/expensePanelLoader'

export function TransactionsPage() {
  const [panel, setPanel] = useState<ExpensePanelData | null>(null)

  useEffect(() => {
    loadExpensePanelContract().then((contract) => {
      const data = toExpensePanelData(contract)
      setPanel(data)
    })
  }, [])

  return (
    <section className="expense-view">
      <div className="expense-layout">
        <ExpenseSidebar
          onMoveMoney={() => {}}
          onShowCategories={() => {}}
          month={panel?.month}
          income={panel?.envelopeState?.income}
          totalSpent={panel?.envelopeState?.totalSpent}
        />
        <div className="expense-main">
          <Suspense fallback={<div className="txn-timeline-loading">Loading…</div>}>
            <TransactionsView />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
