import { useState } from 'react'
import type { Envelope } from '../types/expense'

interface Props {
  targetCategory: string
  envelopes: Envelope[]
  onClose: () => void
  onTransfer: (from: string, to: string, amount: number) => void
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function MoveMoneyModal({ targetCategory, envelopes, onClose, onTransfer }: Props) {
  const availableSources = envelopes.filter((e) => e.available > 0 && e.category !== targetCategory)
  const overspent = envelopes.find((e) => e.category === targetCategory)
  const overspentAmount = overspent ? Math.abs(overspent.available) : 0

  const [selectedSource, setSelectedSource] = useState(availableSources[0]?.category ?? '')
  const [amount, setAmount] = useState(String(overspentAmount || ''))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!selectedSource || !parsed || parsed <= 0) return
    onTransfer(selectedSource, targetCategory, parsed)
  }

  if (!overspent || availableSources.length === 0) {
    return (
      <div className="move-money-overlay" onClick={onClose}>
        <div className="move-money-modal" onClick={(e) => e.stopPropagation()}>
          <div className="move-money-header">
            <h4>Move Money</h4>
            <button type="button" className="move-money-close" onClick={onClose}>✕</button>
          </div>
          {!overspent ? (
            <p className="move-money-empty">{targetCategory} is not overspent.</p>
          ) : (
            <p className="move-money-empty">No envelopes with available funds to pull from.</p>
          )}
          <button type="button" className="action-button move-money-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="move-money-overlay" onClick={onClose}>
      <div className="move-money-modal" onClick={(e) => e.stopPropagation()}>
        <div className="move-money-header">
          <h4>Move Money</h4>
          <button type="button" className="move-money-close" onClick={onClose}>✕</button>
        </div>

        <p className="move-money-desc">
          Cover <strong>{formatCurrency(overspentAmount)}</strong> overspent in <strong>{targetCategory}</strong>
        </p>

        <form onSubmit={handleSubmit} className="move-money-form">
          <label className="move-money-field">
            <span>From</span>
            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
              <option value="" disabled>Select category</option>
              {availableSources.map((e) => (
                <option key={e.category} value={e.category}>
                  {e.category} ({formatCurrency(e.available)} available)
                </option>
              ))}
            </select>
          </label>

          <label className="move-money-field">
            <span>Amount</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              step={1}
            />
          </label>

          <div className="move-money-actions">
            <button type="button" className="action-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="action-button is-active"
              disabled={!selectedSource || !Number(amount) || Number(amount) <= 0}
            >
              Move ₹{Number(amount) || 0}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
