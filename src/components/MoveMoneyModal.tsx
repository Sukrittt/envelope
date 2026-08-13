import { useMemo, useState } from 'react'
import type { Envelope } from '../types/expense'
import { Scrim, Sheet } from './MotionSheet'
import { SuccessButton, useButtonPhase } from './SuccessButton'

interface Props {
  targetCategory: string
  envelopes: Envelope[]
  readyToAssign: number
  onClose: () => void
  onTransfer: (from: string, to: string, amount: number) => void
}

const RTA_SENTINEL = '__ready_to_assign__'

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function MoveMoneyModal({ targetCategory, envelopes, readyToAssign, onClose, onTransfer }: Props) {
  const envelopeSources = envelopes.filter((e) => e.available > 0 && e.category !== targetCategory)
  const target = envelopes.find((e) => e.category === targetCategory)
  const targetAvail = target?.available ?? 0
  const isOverspent = targetAvail < 0

  const [selectedSource, setSelectedSource] = useState(RTA_SENTINEL)
  const [amount, setAmount] = useState(String(isOverspent ? Math.abs(targetAvail) : ''))
  const { saving, success, succeed } = useButtonPhase()

  const maxAvailable = useMemo(() => {
    if (selectedSource === RTA_SENTINEL) return readyToAssign
    const env = envelopeSources.find((e) => e.category === selectedSource)
    return env?.available ?? 0
  }, [selectedSource, envelopeSources, readyToAssign])

  const parsedAmount = Number(amount) || 0
  const isOverLimit = parsedAmount > maxAvailable

  const resultingBalance = useMemo(() => {
    if (!parsedAmount || parsedAmount <= 0) return null
    return maxAvailable - parsedAmount
  }, [parsedAmount, maxAvailable])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSource || !parsedAmount || parsedAmount <= 0 || isOverLimit || saving || success) return
    const from = selectedSource
    const to = targetCategory
    const transferAmount = parsedAmount
    succeed(() => onTransfer(from, to, transferAmount))
  }

  if (!target || (envelopeSources.length === 0 && readyToAssign <= 0)) {
    return (
      <Scrim className="move-money-overlay" onClick={onClose}>
        <Sheet className="move-money-modal" onClick={(e) => e.stopPropagation()}>
          <div className="move-money-header">
            <h4>Move Money</h4>
            <button type="button" className="move-money-close" onClick={onClose}>✕</button>
          </div>
          {!target ? (
            <p className="move-money-empty">{targetCategory} is not overspent.</p>
          ) : (
            <p className="move-money-empty">No funds available to pull from.</p>
          )}
          <button type="button" className="action-button move-money-cancel" onClick={onClose}>Close</button>
        </Sheet>
      </Scrim>
    )
  }

  return (
    <Scrim className="move-money-overlay" onClick={saving || success ? undefined : onClose}>
      <Sheet className="move-money-modal" onClick={(e) => e.stopPropagation()}>
        <div className="move-money-header">
          <h4>Move Money</h4>
          <button type="button" className="move-money-close" onClick={onClose} disabled={saving || success}>✕</button>
        </div>

        <p className="move-money-desc">
          {isOverspent ? (
            <>Cover <strong>{formatCurrency(Math.abs(targetAvail))}</strong> overspent in <strong>{targetCategory}</strong></>
          ) : (
            <>Move money to <strong>{targetCategory}</strong> (currently {formatCurrency(targetAvail)} available)</>
          )}
        </p>

        <form onSubmit={handleSubmit} className="move-money-form">
          <label className="move-money-field">
            <span>From</span>
            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
              {readyToAssign > 0 && (
                <option value={RTA_SENTINEL}>
                  Ready to Assign ({formatCurrency(readyToAssign)} available)
                </option>
              )}
              {envelopeSources.map((e) => (
                <option key={e.category} value={e.category}>
                  {e.category} ({formatCurrency(e.available)} available)
                </option>
              ))}
            </select>
          </label>

          {parsedAmount > 0 && resultingBalance !== null && (
            <p className="move-money-balance-hint">
              {resultingBalance >= 0
                ? `${selectedSource === RTA_SENTINEL ? 'Ready to Assign' : selectedSource} will have ${formatCurrency(resultingBalance)} available after this move`
                : `Source only has ${formatCurrency(maxAvailable)} — reduce the amount`}
            </p>
          )}

          <label className="move-money-field">
            <span>Amount</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={maxAvailable}
              step={1}
            />
          </label>

          <div className="move-money-actions">
            <button type="button" className="action-button" onClick={onClose} disabled={saving || success}>
              Cancel
            </button>
            <SuccessButton
              type="submit"
              className="is-active"
              disabled={saving || success || !selectedSource || !parsedAmount || parsedAmount <= 0 || isOverLimit}
              saving={saving}
              success={success}
            >
              Move ₹{parsedAmount}
            </SuccessButton>
          </div>
        </form>
      </Sheet>
    </Scrim>
  )
}
