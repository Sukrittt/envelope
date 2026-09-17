'use client'

import './MoneyScreens.css'

import { useCurrency } from '@/src/context/CurrencyContext'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Search, Trash2, X } from 'lucide-react'
import { Scrim } from './MotionSheet'
import { useButtonPhase } from './SuccessButton'
import { LoadingCaption } from './LoadingCaption'
import { AmountText, CheckIcon, cssEase, ease, type as typeScale } from './landing/mobile/kit'
import { useAddBudget, useBudgets, useTransferBudget, useUpdateBudget } from '../hooks/useBudgets'
import { useCategories } from '../hooks/useCategories'
import { useExpenses } from '../hooks/useExpenses'
import { useGroups } from '../hooks/useGroups'
import { useHideAmounts } from '../hooks/useHideAmounts'
import { EMPTY } from '../lib/constants'
import { categoryEmoji, splitEmoji } from '../lib/emoji'
import {
  computeEnvelopeState,
  currentMonthKey,
  incomeForReadyToAssign,
  INCOME_CATEGORY,
  monthLabel,
  prevMonthKey,
} from '../lib/envelope'

/**
 * Web twins of Mobile's app/modals/move-money.tsx, edit-assigned-amount.tsx and
 * edit-ready-to-assign.tsx. Layout, copy, and motion (odometer, shake, step
 * dots, source-row springs, progress tween, check draw) follow the RN source.
 * Compact web dialogs use native amount inputs instead of the mobile numpad.
 */

const RTA_SENTINEL = '__ready_to_assign__'
const MAX_AUTO_SOURCES = 3
const QUICK_PICKS = [500, 1000, 2500]
const cents = (value: number) => Math.round(value * 100) / 100

// Mobile's SOURCE_TRANSITION (LinearTransition.springify().damping(90).stiffness(900)),
// SOURCE_ENTER (ZoomIn 150ms from 0.9) and SOURCE_EXIT (FadeOut 120ms).
const SOURCE_SPRING = { type: 'spring', damping: 90, stiffness: 900, mass: 1 } as const
const FADE_IN = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.15 } } }
const ZOOM_IN = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.15 } },
}
const FADE_OUT = { opacity: 0, transition: { duration: 0.12 } }

const CARD_SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const

function useMoneyData() {
  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  return {
    isLoading: budgetsQ.isLoading || expensesQ.isLoading || categoriesQ.isLoading || groupsQ.isLoading,
    budgets: budgetsQ.data ?? EMPTY,
    expenses: expensesQ.data ?? EMPTY,
    categories: categoriesQ.data ?? EMPTY,
    groups: groupsQ.data ?? EMPTY,
  }
}

// ─── Shell ───────────────────────────────────────────────────────────────────

function Screen({
  title,
  onClose,
  onBack,
  busy,
  dots,
  showHeader = true,
  children,
}: {
  title: string
  onClose: () => void
  /** Swaps the close button for a back arrow (move money's sources step). */
  onBack?: () => void
  busy: boolean
  dots?: ReactNode
  showHeader?: boolean
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')
        if (controls?.length) {
          const first = controls[0], last = controls[controls.length - 1]
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            e.preventDefault(); last.focus()
          } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
            e.preventDefault(); first.focus()
          }
        } else e.preventDefault()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        if (!busy) (onBack ?? onClose)()
        return
      }

    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onBack, onClose])

  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.96, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0, transition: CARD_SPRING },
        exit: { opacity: 0, scale: 0.96, y: 8, transition: CARD_SPRING },
      }

  return (
    <MotionConfig reducedMotion="user">
    <Scrim className="money-overlay" onClick={busy ? undefined : onClose}>
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        className="money-screen"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        {...motionProps}
      >
        {showHeader && <header className="money-head">
          <button
            type="button"
            className="money-head-btn"
            aria-label={onBack ? 'Back' : 'Close'}
            onClick={onBack ?? onClose}
            disabled={busy}
          >
            {onBack ? <ArrowLeft size={16} /> : <X size={16} />}
          </button>
          <div className="money-dots">{dots}</div>
          <h2 className="money-title">{title}</h2>
        </header>}
        <fieldset className="money-content" disabled={busy}>{children}</fieldset>
      </motion.div>
    </Scrim>
    </MotionConfig>
  )
}

function StepDot({ active }: { active: boolean }) {
  return <span className={`money-dot ${active ? 'is-active' : ''}`} style={{ transitionTimingFunction: cssEase(ease.ease) }} />
}

function SubjectCard({ emoji, label, name, detail }: { emoji: string; label: string; name: string; detail: string }) {
  return (
    <div className="money-card">
      <span className="money-card-icon">{emoji}</span>
      <div className="money-card-text">
        <span className="money-label">{label}</span>
        <span className="money-card-name">{name}</span>
        <span className="money-card-detail">{detail}</span>
      </div>
    </div>
  )
}

function QuickChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <button type="button" className={`money-chip ${active ? 'is-active' : ''}`} onClick={onPress}>
      {label}
    </button>
  )
}

/** Native input supports typing, selecting, and pasting; the unfocused value keeps the odometer. */
function HeroAmount({ amountText, onChange, children }: {
  amountText: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const { formatAmountInput, currencySymbol } = useCurrency()
  return (
    <div className="money-amount">
      <label className="money-amount-field">
        <span className="money-amount-preview" aria-hidden="true">
          <AmountText value={Number(amountText) || 0} rawText={formatAmountInput(amountText)}
            size={40} weight="displayBold" color="var(--tk-text)" animate />
        </span>
        <span className="money-amount-editor">
          <span aria-hidden="true">{currencySymbol}</span>
          <input aria-label="Amount" inputMode="decimal" autoComplete="off" placeholder="0"
            value={amountText}
            style={{ width: `${Math.max(1, amountText.length)}ch`, maxWidth: '100%' }}
            onChange={(e) => {
              const value = e.target.value
              if (/^\d{0,9}(\.\d{0,2})?$/.test(value)) onChange(value)
            }}
            onFocus={(e) => e.target.select()}
          />
        </span>
      </label>
      {children}
    </div>
  )
}

/** Keep a decimal separator while typing; numeric allocations remain capped separately. */
function SourceAmountInput({ value, max, name, onChange }: {
  value: number; max: number; name: string; onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState({ value, text: String(value) })
  if (draft.value !== value) setDraft({ value, text: String(value) })
  return <input inputMode="decimal" aria-label={`Amount from ${name}`} value={draft.text}
    onChange={(e) => {
      const text = e.target.value
      if (!/^\d{0,9}(\.\d{0,2})?$/.test(text)) return
      const next = Math.min(max, Number(text) || 0)
      setDraft({ value: next, text: Number(text) > max ? String(next) : text })
      onChange(next)
    }}
    onBlur={() => setDraft({ value, text: String(value) })}
  />
}

function Cta({
  label,
  enabled,
  saving,
  success,
  onPress,
  checkSize,
}: {
  label: string
  enabled: boolean
  saving: boolean
  success: boolean
  onPress: () => void
  checkSize?: number
}) {
  return (
    <button
      type="button"
      className={`money-cta ${success ? 'is-success' : enabled ? 'is-ready' : ''} ${saving ? 'is-saving' : ''}`}
      onClick={onPress}
      disabled={!enabled || saving || success}
    >
      {success ? (
        <span role="status" aria-label="Saved" style={{ display: 'inline-flex' }}>
          <CheckIcon color="currentColor" size={checkSize} />
        </span>
      ) : (
        label
      )}
    </button>
  )
}

// ─── Move money ──────────────────────────────────────────────────────────────

interface SourceItem {
  key: string
  name: string
  emoji: string
  available: number
  /** Higher = safer to borrow from. Ready to Assign always ranks first. */
  score: number
}

export function MoveMoneyScreen({ targetCategory, onClose }: { targetCategory: string; onClose: () => void }) {
  const data = useMoneyData()
  if (data.isLoading) return <Screen title="Move money" onClose={onClose} busy={false}><LoadingCaption /></Screen>
  return <MoveMoneyBody targetCategoryName={targetCategory} onClose={onClose} data={data} />
}

function MoveMoneyBody({
  targetCategoryName,
  onClose,
  data,
}: {
  targetCategoryName: string
  onClose: () => void
  data: ReturnType<typeof useMoneyData>
}) {
  const { formatCurrency, formatMoney, currencySymbol } = useCurrency()
  const [hideAmounts] = useHideAmounts()
  const transferBudget = useTransferBudget()
  const phase = useButtonPhase()

  const month = useMemo(() => currentMonthKey(), [])
  const envelopeState = useMemo(
    () => computeEnvelopeState(data.budgets, data.expenses, month, data.categories, data.groups),
    [data.budgets, data.expenses, month, data.categories, data.groups],
  )

  const target = envelopeState.envelopes.find((e) => e.category === targetCategoryName)
  const targetAvail = target?.available ?? 0
  const isOverspent = targetAvail < 0
  const shortfall = isOverspent ? Math.abs(targetAvail) : 0
  const readyToAssign = envelopeState.readyToAssign
  const targetName = splitEmoji(targetCategoryName).text

  const envelopeSources = envelopeState.envelopes.filter(
    (e) => e.available > 0 && e.category !== targetCategoryName && !e.isCreditCardPayment,
  )

  const [step, setStep] = useState<'amount' | 'sources'>('amount')
  const [allocs, setAllocs] = useState<Record<string, number>>({})
  const [amountStr, setAmountStr] = useState(isOverspent ? String(cents(shortfall)) : '')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const amount = Number(amountStr) || 0
  const allocated = cents(Object.values(allocs).reduce((a, b) => a + b, 0))
  const remaining = Math.max(0, cents(amount - allocated))
  const ready = amount > 0 && allocated === amount && Object.entries(allocs).every(([key, value]) => value <= (key === RTA_SENTINEL ? readyToAssign : envelopeSources.find((e) => e.category === key)?.available ?? 0))
  const busy = phase.saving || phase.success
  const progressPct = amount > 0 ? Math.min(100, Math.round((allocated / amount) * 100)) : 0

  const sources: SourceItem[] = (() => {
    const items: SourceItem[] = []
    if (readyToAssign > 0) {
      items.push({ key: RTA_SENTINEL, name: 'Ready to Assign', emoji: '💰', available: readyToAssign, score: Infinity })
    }
    for (const e of envelopeSources) {
      items.push({
        key: e.category,
        name: splitEmoji(e.category).text,
        emoji: categoryEmoji(e.category, e.group),
        available: e.available,
        score: e.assigned > 0 ? e.available / e.assigned : 1,
      })
    }
    return items.sort((a, b) => b.score - a.score)
  })()

  const pickedRows = sources.filter((s) => s.key in allocs)
  const q = query.trim().toLowerCase()
  const poolRows = sources.filter((s) => !(s.key in allocs) && (!q || s.name.toLowerCase().includes(q)))

  // Typing a value down to 0 keeps the row in `allocs`; only "Remove" deletes it,
  // so the focused input isn't unmounted mid-edit.
  function setAllocValue(key: string, value: number) {
    setAllocs((prev) => ({ ...prev, [key]: Math.max(0, cents(value)) }))
  }
  function removeAlloc(key: string) {
    setAllocs((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }
  function maxFor(item: SourceItem) {
    return Math.min(item.available, (allocs[item.key] ?? 0) + remaining)
  }
  function pick(item: SourceItem) {
    if (remaining <= 0 || busy) return
    setAllocValue(item.key, Math.min(item.available, remaining))
  }
  function autoFillNow() {
    if (amount <= 0) return
    let left = amount
    const next: Record<string, number> = {}
    for (const item of sources) {
      if (left <= 0 || Object.keys(next).length >= MAX_AUTO_SOURCES) break
      const take = Math.min(item.available, left)
      if (take > 0) {
        next[item.key] = take
        left = cents(left - take)
      }
    }
    setAllocs(next)
  }

  async function handleSubmit() {
    if (!ready || !target || busy) return
    setError('')
    phase.start()
    try {
      const picked = Object.entries(allocs)
        .filter(([, alloc]) => alloc > 0)
        .map(([category, alloc]) => ({ category, amount: alloc }))
      await transferBudget.mutateAsync({ month, to: targetCategoryName, sources: picked })
      phase.succeed(onClose)
    } catch {
      phase.fail()
      setError("Couldn't move money. Check your connection and try again.")
    }
  }

  const noOptions = !target || (envelopeSources.length === 0 && readyToAssign <= 0)

  if (noOptions) {
    return (
      <Screen title="Move money" onClose={onClose} busy={false}>
        <div className="money-body">
          <p className="money-hint">
            {!target ? `${targetCategoryName} isn't set up as an envelope.` : 'No funds available to pull from.'}
          </p>
          <button type="button" className="money-cta is-plain" onClick={onClose}>
            Close
          </button>
        </div>
      </Screen>
    )
  }

  const stepRow = (
    <div className="money-step-row">
      <div className="money-step-label">
        <span className="money-label">{step === 'amount' ? 'STEP 1 OF 2 · AMOUNT' : 'STEP 2 OF 2 · SOURCES'}</span>
        <span className="money-dots" aria-hidden="true">
          <StepDot active />
          <StepDot active={step === 'sources'} />
        </span>
      </div>
      <button type="button" className="money-head-btn" aria-label="Close" onClick={onClose} disabled={busy}>
        <X size={16} />
      </button>
    </div>
  )

  if (step === 'amount') {
    return (
      <Screen title="Move money" onClose={onClose} busy={busy} showHeader={false}>
        <div className="money-body">
          {stepRow}
          <SubjectCard
            emoji={splitEmoji(targetCategoryName).icon || categoryEmoji(targetCategoryName)}
            label="MOVING TO"
            name={targetName}
            detail={
              isOverspent
                ? `${formatCurrency(shortfall, hideAmounts)} overspent`
                : `${formatCurrency(targetAvail, hideAmounts)} available`
            }
          />
          <HeroAmount amountText={amountStr} onChange={(value) => { setAmountStr(value); setAllocs({}) }}>
            <p className="money-hint">
              {amount === 0
                ? 'Type an amount to get started'
                : isOverspent && amount >= shortfall
                  ? amount > shortfall
                    ? `Clears the overspend, ${formatCurrency(amount - shortfall, hideAmounts)} extra`
                    : 'Clears the overspend exactly'
                  : isOverspent
                    ? `${formatCurrency(shortfall - amount, hideAmounts)} more needed to clear it`
                    : `Adds to ${targetName}`}
            </p>
          </HeroAmount>
          <div className="money-chips">
            {isOverspent && shortfall > 0 && (
              <QuickChip
                label={`Cover overspend · ${formatCurrency(shortfall, hideAmounts)}`}
                active={amount === cents(shortfall)}
                onPress={() => {
                  setAmountStr(String(cents(shortfall)))
                  setAllocs({})
                }}
              />
            )}
            {QUICK_PICKS.map((v) => (
              <QuickChip
                key={v}
                label={formatMoney(v)}
                active={amount === v}
                onPress={() => {
                  setAmountStr(String(v))
                  setAllocs({})
                }}
              />
            ))}
          </div>
        </div>
        <div className="money-foot">
          <Cta
            label={amount > 0 ? 'Pick sources →' : 'Add an amount'}
            enabled={amount > 0}
            saving={false}
            success={false}
            onPress={() => amount > 0 && setStep('sources')}
          />
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="Move money" onClose={onClose} onBack={() => setStep('amount')} busy={busy} showHeader={false}>
      <div className="money-sources-head">
        {stepRow}
        <div className="money-cover-row">
          <div>
            <span className="money-label">{remaining > 0 ? 'STILL NEEDED' : 'FULLY COVERED'}</span>
            <AmountText
              value={remaining > 0 ? remaining : amount}
              size={typeScale.heading}
              weight="displayBold"
              color={remaining > 0 ? 'var(--tk-text)' : 'var(--tk-mint)'}
              style={{ display: 'block' }}
            />
          </div>
          <span className="money-cover-to">
            → {formatCurrency(amount, hideAmounts)} to {targetName}
          </span>
        </div>
        <ProgressBar pct={progressPct} done={remaining === 0} />
        <div className="money-search-row">
          <label className="money-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an envelope" />
          </label>
          <button type="button" className="money-autofill" onClick={autoFillNow}>
            Auto-fill
          </button>
        </div>
      </div>

      <div className="money-body money-sources">
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {pickedRows.length > 0 && (
              // One block, so the FROM label stays attached to its rows as the block grows or shrinks.
              <motion.div key="picked" className="money-source-block" layout="position" transition={SOURCE_SPRING} {...FADE_IN} exit={FADE_OUT}>
                <span className="money-label">FROM</span>
                <AnimatePresence mode="popLayout">
                  {pickedRows.map((item) => {
                    const alloc = allocs[item.key] ?? 0
                    return (
                      <motion.div
                        key={item.key}
                        className="money-source is-picked"
                        layout="position"
                        transition={SOURCE_SPRING}
                        {...ZOOM_IN}
                        exit={FADE_OUT}
                      >
                        <div className="money-source-top">
                          <span className="money-source-icon">{item.emoji}</span>
                          <div className="money-source-text">
                            <span className="money-source-name">{item.name}</span>
                            <span className="money-source-sub">
                              {formatCurrency(item.available, hideAmounts)} → {formatCurrency(item.available - alloc, hideAmounts)}
                            </span>
                          </div>
                          <button type="button" className="money-remove" aria-label="Remove" onClick={() => removeAlloc(item.key)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <label className="money-alloc">
                          <span>{currencySymbol}</span>
                          <SourceAmountInput value={alloc} max={maxFor(item)} name={item.name}
                            onChange={(value) => setAllocValue(item.key, value)} />
                        </label>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            <motion.div
              key="pool"
              className="money-source-block"
              layout="position"
              transition={SOURCE_SPRING}
              style={{ marginTop: pickedRows.length > 0 ? 8 : 0 }}
            >
              <span className="money-label">{q ? 'SEARCH RESULTS' : 'SUGGESTED SOURCES'}</span>
              <AnimatePresence mode="popLayout">
                {poolRows.map((item) => (
                  <motion.button
                    type="button"
                    key={item.key}
                    className="money-source money-source-top"
                    layout="position"
                    transition={SOURCE_SPRING}
                    {...FADE_IN}
                    exit={FADE_OUT}
                    disabled={busy || remaining === 0}
                    onClick={() => pick(item)}
                  >
                    <span className="money-source-icon">{item.emoji}</span>
                    <span className="money-source-name">{item.name}</span>
                    <span className="money-source-avail">
                      <span>{formatCurrency(item.available, hideAmounts)}</span>
                      <small>AVAILABLE</small>
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
        {poolRows.length === 0 && pickedRows.length === 0 && (
          <p className="money-hint money-empty">{q ? `Nothing named "${query}"` : 'Nothing else to pull from'}</p>
        )}
      </div>

      <div className="money-foot">
        <button type="button" className="money-back" onClick={() => setStep('amount')} disabled={busy}>
          <ArrowLeft size={14} /> Back to amount
        </button>
        {error !== '' && <p role="alert" className="money-error">{error}</p>}
        <Cta
          label={
            phase.saving
              ? 'Moving…'
              : ready
                ? `Move ${formatCurrency(amount, hideAmounts)}`
                : remaining === amount
                  ? 'Choose where to pull from'
                  : `${formatCurrency(remaining, hideAmounts)} more to allocate`
          }
          enabled={ready}
          saving={phase.saving}
          success={phase.success}
          onPress={handleSubmit}
        />
      </div>
    </Screen>
  )
}

/** Mobile's useProgressWidth: 900ms in-out-cubic tween, 500ms delay on first reveal only. */
function ProgressBar({ pct, done }: { pct: number; done: boolean }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="money-progress">
      <motion.div
        onAnimationComplete={() => setRevealed(true)}
        className={`money-progress-fill ${done ? 'is-done' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: ease.inOutCubic, delay: revealed ? 0 : 0.5 }}
      />
    </div>
  )
}

// ─── Edit assigned amount ────────────────────────────────────────────────────

export function EditAssignedScreen({ category, onClose, assign = false }: { category: string; onClose: () => void; assign?: boolean }) {
  const data = useMoneyData()
  // Mounted only once data has settled, so the numpad seeds from the real envelope.
  if (data.isLoading) return <Screen title={assign ? 'Assign money' : 'Edit amount'} onClose={onClose} busy={false}><LoadingCaption /></Screen>

  const month = currentMonthKey()
  const state = computeEnvelopeState(data.budgets, data.expenses, month, data.categories, data.groups)
  const prevState = computeEnvelopeState(data.budgets, data.expenses, prevMonthKey(month), data.categories, data.groups)
  const envelope = state.envelopes.find((e) => e.category === category)

  return (
    <EditAssignedBody
      category={category}
      assign={assign}
      month={month}
      exists={data.budgets.some((b) => b.month === month && b.category === category)}
      currentAssigned={envelope?.assigned ?? 0}
      spent={envelope?.spent ?? 0}
      isCreditCardPayment={!!envelope?.isCreditCardPayment}
      group={envelope?.group ?? ''}
      lastMonthAssigned={prevState.envelopes.find((e) => e.category === category)?.assigned}
      readyToAssign={state.readyToAssign}
      onClose={onClose}
    />
  )
}

export function AssignMoneyScreen(props: { category: string; onClose: () => void }) {
  return <EditAssignedScreen {...props} assign />
}

function EditAssignedBody({
  category,
  assign,
  month,
  exists,
  currentAssigned,
  spent,
  isCreditCardPayment,
  group,
  lastMonthAssigned,
  readyToAssign,
  onClose,
}: {
  category: string
  assign: boolean
  month: string
  exists: boolean
  currentAssigned: number
  spent: number
  isCreditCardPayment: boolean
  group: string
  lastMonthAssigned: number | undefined
  readyToAssign: number
  onClose: () => void
}) {
  const { formatCurrency, formatMoney } = useCurrency()
  const [hideAmounts] = useHideAmounts()
  const updateBudget = useUpdateBudget()
  const addBudget = useAddBudget()
  const transfer = useTransferBudget()
  const phase = useButtonPhase()
  const busy = phase.saving || phase.success

  const name = isCreditCardPayment ? 'Credit Card Payment' : splitEmoji(category).text
  const emoji = isCreditCardPayment ? '💳' : categoryEmoji(category, group)

  const [amountText, setAmountText] = useState(assign ? '' : String(currentAssigned))
  const [error, setError] = useState('')

  const value = Number(amountText) || 0
  const delta = assign ? value : cents(value - currentAssigned)
  const projectedRTA = cents(readyToAssign - delta)
  const valid = !assign || (value > 0 && value <= readyToAssign)
  const impactText =
    delta === 0
        ? `${formatCurrency(currentAssigned, hideAmounts)} already assigned this month`
        : delta > 0
          ? `Pulls ${formatCurrency(delta, hideAmounts)} from Ready to Assign`
          : `Frees ${formatCurrency(-delta, hideAmounts)} back to Ready to Assign`

  async function submit() {
    if (busy) return
    phase.start()
    setError('')
    try {
      if (assign) {
        if (!valid) { phase.fail(); return }
        await transfer.mutateAsync({ month, to: category, sources: [{ category: RTA_SENTINEL, amount: value }] })
      } else if (exists) {
        await updateBudget.mutateAsync({ month, category, updates: { assigned: String(value) } })
      } else {
        await addBudget.mutateAsync({ month, category, assigned: String(value) })
      }
      phase.succeed(onClose)
    } catch {
      phase.fail()
      setError("Couldn't save. Check your connection and try again.")
    }
  }

  return (
    <Screen title={assign ? "Assign money" : "Edit amount"} onClose={onClose} busy={busy} showHeader={false}>
      <div className="money-body">
        <div className="money-month-row">
          <span className="money-label">{assign ? "FROM READY TO ASSIGN" : "ASSIGNED AMOUNT"}</span>
          <button type="button" className="money-head-btn" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <SubjectCard
          emoji={emoji}
          label={assign ? "ASSIGNING TO" : "EDITING"}
          name={name}
          detail={`${formatCurrency(spent, hideAmounts)} spent · ${formatCurrency(currentAssigned, hideAmounts)} assigned`}
        />
        <HeroAmount amountText={amountText} onChange={setAmountText}>
          <motion.p
            key={impactText}
            className={`money-hint ${projectedRTA < 0 ? 'is-neg' : ''}`}
            {...FADE_IN}
          >
            {impactText}
            {value > 0 && projectedRTA < 0 ? ` · ${formatCurrency(-projectedRTA, hideAmounts)} over` : ''}
          </motion.p>
        </HeroAmount>
        <div className="money-chips">
          {QUICK_PICKS.map((v) => (
            <QuickChip key={v} label={formatMoney(v)} active={value === v} onPress={() => setAmountText(String(v))} />
          ))}
        </div>
        {!assign && !isCreditCardPayment && !!lastMonthAssigned && (
          <div className="money-chips">
            <QuickChip
              label={`Last month · ${formatCurrency(lastMonthAssigned, hideAmounts)}`}
              active={value === lastMonthAssigned}
              onPress={() => setAmountText(String(lastMonthAssigned))}
            />
          </div>
        )}
        {error !== '' && <p role="alert" className="money-error">{error}</p>}
      </div>
      <div className="money-foot">
        <Cta label={phase.saving ? 'Saving…' : assign ? 'Assign' : 'Save'} enabled={valid} saving={phase.saving} success={phase.success} onPress={submit} checkSize={16} />
      </div>
    </Screen>
  )
}

// ─── Edit Ready to Assign ────────────────────────────────────────────────────

/** Opened by tapping the Ready to Assign hero. The user types the RTA they actually
 * have, and this month's income is backed out from it. */
export function EditReadyToAssignScreen({ onClose }: { onClose: () => void }) {
  const data = useMoneyData()
  if (data.isLoading) return <Screen title="Edit Ready to Assign" onClose={onClose} busy={false}><LoadingCaption /></Screen>
  const month = currentMonthKey()
  const state = computeEnvelopeState(data.budgets, data.expenses, month, data.categories, data.groups)
  return (
    <EditReadyToAssignBody
      month={month}
      income={state.income}
      totalAssigned={state.totalAssigned}
      readyToAssign={state.readyToAssign}
      onClose={onClose}
    />
  )
}

function EditReadyToAssignBody({
  month,
  income,
  totalAssigned,
  readyToAssign,
  onClose,
}: {
  month: string
  income: number
  totalAssigned: number
  readyToAssign: number
  onClose: () => void
}) {
  const { formatCurrency } = useCurrency()
  const [hideAmounts] = useHideAmounts()
  const updateBudget = useUpdateBudget()
  const phase = useButtonPhase()
  const busy = phase.saving || phase.success

  // Start an over-assigned month at zero, matching the native screen.
  const [amountText, setAmountText] = useState(String(Math.max(0, readyToAssign)))
  const [error, setError] = useState('')

  const value = Number(amountText) || 0
  const newIncome = incomeForReadyToAssign(totalAssigned, value)
  const delta = Math.round((newIncome - income) * 100) / 100
  const impactText = delta === 0 ? "Type what's left to assign" : `Income ${formatCurrency(newIncome, hideAmounts)}`

  async function submit() {
    if (busy) return
    phase.start()
    setError('')
    try {
      // PUT upserts, so this creates the month's income row when it's still carried from last month.
      await updateBudget.mutateAsync({ month, category: INCOME_CATEGORY, updates: { assigned: String(newIncome) } })
      phase.succeed(onClose)
    } catch {
      phase.fail()
      setError("Couldn't save. Check your connection and try again.")
    }
  }

  return (
    <Screen title="Edit Ready to Assign" onClose={onClose} busy={busy} showHeader={false}>
      <div className="money-body">
        <div className="money-month-row">
          <span className="money-label">{monthLabel(month).toUpperCase()}</span>
          <button type="button" className="money-head-btn" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <SubjectCard
          emoji="💰"
          label="EDITING"
          name="Ready to Assign"
          detail={`${formatCurrency(income, hideAmounts)} income · ${formatCurrency(totalAssigned, hideAmounts)} assigned`}
        />
        <HeroAmount amountText={amountText} onChange={setAmountText}>
          <motion.p key={impactText} className="money-hint" {...FADE_IN}>
            {impactText}
          </motion.p>
        </HeroAmount>
        {error !== '' && <p role="alert" className="money-error">{error}</p>}
      </div>
      <div className="money-foot">
        <Cta label={phase.saving ? 'Saving…' : 'Save'} enabled saving={phase.saving} success={phase.success} onPress={submit} checkSize={16} />
      </div>
    </Screen>
  )
}
