'use client'

import { useState } from 'react'
import { Scrim, Sheet } from './MotionSheet'
import { DatePicker } from './DatePicker'
import { CategoryPicker } from './CategoryPicker'
import { SuccessButton, useButtonPhase } from './SuccessButton'
import {
  useAddRecurringExpense,
  useDeleteRecurringExpense,
  usePauseRecurringExpense,
  useRecurringExpenses,
  useResumeRecurringExpense,
  useUpdateRecurringExpense,
} from '../hooks/useRecurringExpenses'
import { todayIST } from '../lib/date'
import { splitEmoji } from '../lib/emoji'

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly']
const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit card' },
]
const RETRY = 'Check your connection and try again.'

interface Props {
  /** Present: edit that row. Absent: add a new one. Same split as Mobile's route params. */
  id?: string
  onClose: () => void
}

/** Twin of Mobile's modals/recurring-expense.tsx, as a dialog over /account/recurring. */
export function RecurringExpenseModal({ id, onClose }: Props) {
  const recurringQ = useRecurringExpenses()
  const addRecurring = useAddRecurringExpense()
  const updateRecurring = useUpdateRecurringExpense()
  const pauseRecurring = usePauseRecurringExpense()
  const resumeRecurring = useResumeRecurringExpense()
  const deleteRecurring = useDeleteRecurringExpense()
  // Opened from a row of an already-loaded list, so unlike Mobile there's no
  // cold cache to backfill the form from once it arrives.
  const existing = id ? recurringQ.data?.find((r) => r.id === id) : undefined
  // Keyed off the id, not the row: a delete refetches the list mid-tick, and
  // the title shouldn't flip to "New recurring" while the dialog closes.
  const isEdit = id !== undefined
  const isActive = existing ? existing.status === 'active' : true

  const [item, setItem] = useState(existing?.item ?? '')
  const [amount, setAmount] = useState(existing?.amount_inr ?? '')
  const [frequency, setFrequency] = useState(existing?.frequency || 'monthly')
  const [startDate, setStartDate] = useState(existing?.start_date || todayIST())
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method || 'bank')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')
  const { saving, success, start, succeed, fail } = useButtonPhase()

  const parsedAmount = Number(amount)
  const endsBeforeStart = endDate !== '' && endDate < startDate
  const canSubmit =
    item.trim() !== '' && amount.trim() !== '' && parsedAmount > 0 && category !== '' && startDate !== '' && !endsBeforeStart
  const mutatingAction = pauseRecurring.isPending || resumeRecurring.isPending || deleteRecurring.isPending
  const busy = saving || success || mutatingAction

  function onFailure(title: string) {
    fail()
    setError(`${title}. ${RETRY}`)
  }

  async function handleSubmit() {
    if (!canSubmit || busy) return
    const fields = {
      item: item.trim(),
      amount_inr: String(parsedAmount),
      category,
      frequency,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim(),
      payment_method: paymentMethod,
    }
    setError('')
    start()
    try {
      if (id) await updateRecurring.mutateAsync({ id, updates: fields })
      else await addRecurring.mutateAsync(fields)
      succeed(onClose)
    } catch {
      onFailure(isEdit ? "Couldn't save" : "Couldn't add this")
    }
  }

  async function runAction(action: 'toggle' | 'delete') {
    if (!existing || busy) return
    setError('')
    try {
      if (action === 'delete') await deleteRecurring.mutateAsync(existing.id)
      else await (isActive ? pauseRecurring : resumeRecurring).mutateAsync(existing.id)
      setConfirmingDelete(false)
      succeed(onClose)
    } catch {
      setConfirmingDelete(false)
      onFailure(action === 'delete' ? "Couldn't delete this" : "Couldn't update this")
    }
  }

  return (
    <Scrim className="erd-modal-overlay" onClick={busy ? undefined : onClose}>
      <Sheet className="erd-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit recurring' : 'New recurring'}>
        <div className="erd-modal-head">
          <h3>{isEdit ? 'Edit recurring' : 'New recurring'}</h3>
          <button type="button" className="erd-modal-close" onClick={onClose} aria-label="Close" disabled={success}>
            ✕
          </button>
        </div>

        <label className="erd-log-label" htmlFor="recurring-item">
          What is it
        </label>
        <input
          id="recurring-item"
          className="erd-log-input"
          placeholder="e.g. Rent"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          autoFocus={!isEdit}
        />

        <label className="erd-log-label" htmlFor="recurring-amount">
          Amount (₹)
        </label>
        <input
          id="recurring-amount"
          className="erd-log-input"
          type="number"
          min={0}
          step="any"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="erd-log-label">How often</div>
        <div className="erd-chip-row">
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              className={`erd-chip ${frequency === f ? 'is-selected' : ''}`}
              aria-pressed={frequency === f}
              onClick={() => setFrequency(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="erd-log-label">Starts</div>
        <DatePicker mode="single" value={startDate} onChange={setStartDate} disableFuture={false} />

        <div className="erd-log-label recurring-label-row">
          <span>Ends (optional)</span>
          {endDate && (
            <button type="button" className="scan-link-btn" onClick={() => setEndDate('')}>
              Clear
            </button>
          )}
        </div>
        <DatePicker mode="single" value={endDate} onChange={setEndDate} disableFuture={false} />
        {endsBeforeStart ? (
          <p className="erd-log-error">The end date can&apos;t be before the start date.</p>
        ) : (
          <p className="recurring-hint">Leave this empty and it keeps going until you stop it.</p>
        )}

        <div className="erd-log-label">Paid with</div>
        <div className="erd-chip-row">
          {PAYMENT_METHODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`erd-chip ${paymentMethod === p.value ? 'is-selected' : ''}`}
              aria-pressed={paymentMethod === p.value}
              onClick={() => setPaymentMethod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="erd-log-label" htmlFor="recurring-notes">
          Notes (optional)
        </label>
        <input
          id="recurring-notes"
          className="erd-log-input"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="erd-log-label">Category</div>
        <CategoryPicker value={category} onChange={setCategory} />
        <p className="recurring-hint">
          {category
            ? `We'll add this expense in ${splitEmoji(category).text} on every due date.`
            : 'Pick one so we know which envelope to file it under.'}
        </p>

        {error && <p className="erd-log-error">{error}</p>}

        <SuccessButton
          type="button"
          baseClass="erd-log-submit"
          saving={saving}
          success={success}
          successLabel="Saved"
          disabled={!canSubmit || busy}
          onClick={handleSubmit}
        >
          {isEdit ? 'Save changes' : 'Add recurring expense'}
        </SuccessButton>

        {existing && !success && (
          <div className="recurring-danger-zone">
            {confirmingDelete ? (
              <div className="account-confirm-panel">
                <div className="account-confirm-copy">
                  Remove &quot;{existing.item}&quot;? Expenses already logged from it stay put.
                </div>
                <div className="account-confirm-actions">
                  <button type="button" className="account-confirm-cancel" disabled={mutatingAction} onClick={() => setConfirmingDelete(false)}>
                    Back
                  </button>
                  <button type="button" className="account-danger-btn" style={{ marginTop: 0 }} disabled={mutatingAction} onClick={() => runAction('delete')}>
                    {deleteRecurring.isPending ? 'Working…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={`scan-link-btn ${isActive ? 'is-coral' : 'is-mint'}`}
                  disabled={busy}
                  onClick={() => runAction('toggle')}
                >
                  {pauseRecurring.isPending || resumeRecurring.isPending ? 'Working…' : isActive ? 'Pause this' : 'Resume this'}
                </button>
                <button type="button" className="scan-link-btn" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>
    </Scrim>
  )
}
