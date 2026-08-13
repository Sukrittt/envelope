import { useState } from 'react'
import { addSubscription, updateSubscription } from '../services/api'
import { Scrim, Sheet } from './MotionSheet'
import { SuccessButton, useButtonPhase } from './SuccessButton'

interface SubscriptionEdit {
  service: string
  amount_inr: string
  billing_cycle: string
  next_due_date: string
  notes: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
  editData?: SubscriptionEdit
}

const BILLING_CYCLES = ['monthly', 'yearly', 'quarterly', 'weekly', 'one-time']

function toDateInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function SubscriptionModal({ onClose, onSaved, editData }: Props) {
  const isEdit = !!editData
  const [service, setService] = useState(editData?.service ?? '')
  const [amount, setAmount] = useState(editData?.amount_inr ?? '')
  const [billingCycle, setBillingCycle] = useState(editData?.billing_cycle ?? 'monthly')
  const [dueDate, setDueDate] = useState(toDateInput(editData?.next_due_date ?? ''))
  const [notes, setNotes] = useState(editData?.notes ?? '')
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const [error, setError] = useState('')

  const amt = parseFloat(amount)
  const canSave = service.trim() !== '' && amount.trim() !== '' && !Number.isNaN(amt) && amt > 0

  async function handleSave() {
    if (!canSave || saving || success) return
    setError('')
    start()
    try {
      if (isEdit) {
        const updates: Record<string, string> = { amount_inr: String(amt) }
        if (service.trim() !== editData!.service) updates.new_service = service.trim()
        if (billingCycle !== editData!.billing_cycle) updates.billing_cycle = billingCycle
        if (dueDate !== toDateInput(editData!.next_due_date)) updates.next_due_date = dueDate || ''
        if (notes !== editData!.notes) updates.notes = notes.trim()
        await updateSubscription(editData!.service, updates)
      } else {
        await addSubscription({
          service: service.trim(),
          amount_inr: String(amt),
          billing_cycle: billingCycle,
          next_due_date: dueDate || undefined,
          notes: notes.trim(),
        })
      }
      onSaved()
      succeed(onClose)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subscription')
      fail()
    }
  }

  return (
    <Scrim className="category-manager-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Sheet className="category-manager subscription-modal">
        <div className="category-manager-header">
          <h3>{isEdit ? 'Edit Subscription' : 'New Subscription'}</h3>
          <button type="button" className="action-button is-ghost" onClick={onClose} disabled={success}>✕</button>
        </div>

        {error && <p className="txn-entry-error">{error}</p>}

        <div className="category-manager-body">
          <div className="subscription-modal-form">
            <label className="subscription-modal-field">
              <span>Service</span>
              <input
                type="text"
                className="txn-entry-input"
                value={service}
                onChange={(e) => setService(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave() }}
                placeholder="Netflix"
                autoFocus
              />
            </label>

            <label className="subscription-modal-field">
              <span>Amount (₹)</span>
              <input
                type="number"
                step="any"
                min="0"
                className="txn-entry-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave() }}
                placeholder="199"
              />
            </label>

            <label className="subscription-modal-field">
              <span>Billing cycle</span>
              <select
                className="txn-entry-input"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
              >
                {BILLING_CYCLES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="subscription-modal-field">
              <span>Next due date</span>
              <input
                type="date"
                className="txn-entry-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>

            <label className="subscription-modal-field">
              <span>Notes</span>
              <input
                type="text"
                className="txn-entry-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave() }}
                placeholder="Optional"
              />
            </label>
          </div>
        </div>

        <div className="subscription-modal-actions">
          <button type="button" className="action-button is-ghost" onClick={onClose} disabled={success}>Cancel</button>
          <SuccessButton type="button" disabled={!canSave || saving || success} saving={saving} success={success} onClick={handleSave}>
            {isEdit ? 'Save changes' : 'Add subscription'}
          </SuccessButton>
        </div>
      </Sheet>
    </Scrim>
  )
}
