import type { Envelope } from '../types/expense'

interface Props {
  envelopes: Envelope[]
  hideAmounts: boolean
  onMoveMoney: (category: string) => void
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function EnvelopeGrid({ envelopes, hideAmounts, onMoveMoney }: Props) {
  if (!envelopes.length) {
    return (
      <div className="envelope-grid-empty">
        <p>No envelopes yet. Set up budgets in the budgets CSV to get started.</p>
      </div>
    )
  }

  return (
    <table className="env-table">
      <thead>
        <tr className="env-table-header">
          <th className="env-th env-th-cat">Category</th>
          <th className="env-th env-th-num">Assigned</th>
          <th className="env-th env-th-num">Spent</th>
          <th className="env-th env-th-num">Available</th>
          <th className="env-th env-th-action" />
        </tr>
      </thead>
      <tbody>
        {envelopes.map((e) => {
          const isOverspent = e.isOverspent
          const hasBalance = e.available > 0
          const pct = Math.min(100, e.spentPct)
          return (
            <tr key={e.category} className={`env-row ${isOverspent ? 'env-row-overspent' : ''}`}>
              <td className="env-cell env-cell-cat">
                <span>{e.category}</span>
                <div className="env-bar-track">
                  <div
                    className={`env-bar-fill ${isOverspent ? 'env-bar-red' : pct > 85 ? 'env-bar-warn' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </td>
              <td className="env-cell env-cell-num env-cell-assigned">
                {hideAmounts ? '---' : formatCurrency(e.assigned)}
              </td>
              <td className="env-cell env-cell-num env-cell-spent">
                {hideAmounts ? '---' : formatCurrency(e.spent)}
              </td>
              <td className={`env-cell env-cell-num env-cell-avail ${isOverspent ? 'env-cell-negative' : hasBalance ? 'env-cell-positive' : ''}`}>
                {hideAmounts ? '---' : formatCurrency(e.available)}
              </td>
              <td className="env-cell env-cell-action">
                <button type="button" className={`env-move-btn ${isOverspent ? 'env-move-btn-visible' : ''}`} onClick={() => onMoveMoney(e.category)} title="Move money">
                  ⇄
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
