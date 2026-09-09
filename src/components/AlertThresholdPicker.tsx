'use client'

import { AnimatePresence } from 'motion/react'
import { Scrim, Sheet } from './MotionSheet'
import { ALERT_PRESET_PCTS, MAX_ALERT_PCTS, DEFAULT_ALERT_PCTS } from '../lib/alerts'

interface Props {
  categoryName: string
  value: number[]
  onChange: (next: number[]) => void
  onClose: () => void
  onSave: () => void
}

/**
 * Which percentages of an envelope trigger a notification. Web counterpart of
 * the thresholds section in Mobile's envelopes edit sheet.
 *
 * The alert itself is a mobile push, but the choice is account data, not a
 * device setting — so it is editable here and applies wherever it fires.
 */
export function AlertThresholdPicker({ categoryName, value, onChange, onClose, onSave }: Props) {
  const atLimit = value.length >= MAX_ALERT_PCTS
  const isDefault =
    value.length === DEFAULT_ALERT_PCTS.length && value.every((v, i) => [...value].sort((a, b) => a - b)[i] === DEFAULT_ALERT_PCTS[i])

  function toggle(pct: number) {
    if (value.includes(pct)) onChange(value.filter((p) => p !== pct))
    else if (!atLimit) onChange([...value, pct].sort((a, b) => a - b))
  }

  return (
    <AnimatePresence>
      <Scrim key="scrim" onClick={onClose} />
      <Sheet key="sheet" className="env-sheet" role="dialog" aria-label={`Alerts for ${categoryName}`}>
        <div className="env-sheet-title">Alerts for {categoryName}</div>
        <p className="env-sheet-copy">
          You&apos;ll get a nudge when this envelope crosses each of these.
        </p>

        <div className="env-pct-row">
          {ALERT_PRESET_PCTS.map((pct) => {
            const on = value.includes(pct)
            return (
              <button
                key={pct}
                type="button"
                className={`env-pct${on ? ' is-on' : ''}`}
                onClick={() => toggle(pct)}
                disabled={!on && atLimit}
                aria-pressed={on}
              >
                {pct}%
              </button>
            )
          })}
        </div>

        {atLimit && <p className="env-sheet-hint">That&apos;s the most you can pick. Turn one off to add another.</p>}
        {value.length === 0 && <p className="env-sheet-hint">No alerts. This envelope stays quiet.</p>}
        {isDefault && <p className="env-sheet-hint">These are the defaults.</p>}

        <div className="env-sheet-actions">
          <button type="button" className="auth-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="auth-btn auth-btn--primary" onClick={onSave}>
            Save
          </button>
        </div>
      </Sheet>
    </AnimatePresence>
  )
}
