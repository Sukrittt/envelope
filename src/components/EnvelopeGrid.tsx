import { useCurrency } from '@/src/context/CurrencyContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ChevronsDownUp } from 'lucide-react'
import { SpringChevron, SpringCollapse } from './SpringCollapse'
import { categoryEmoji, groupEmoji, splitEmoji } from '../lib/emoji'
import type { Envelope } from '../types/expense'

/** Web twin of Mobile's app/(tabs)/index.tsx envelopes card (EnvelopeGroup + EnvelopeRow). */

interface Props {
  envelopes: Envelope[]
  groups: string[]
  hideAmounts: boolean
  onManage: () => void
  onMoveMoney: (category: string) => void
  onAssignFromRTA: (category: string) => void
  onSetAssigned: (category: string) => void
  onPayCreditCard?: () => void
}

const UNGROUPED_LABEL = 'Other'

function usedPct(e: Envelope): number {
  if (e.assigned > 0) return Math.round((e.spent / e.assigned) * 100)
  return e.spent > 0 ? Infinity : 0
}

function usedPctLabel(e: Envelope): string {
  if (e.assigned > 0) return `${usedPct(e)}%`
  return e.spent > 0 ? '∞' : '—'
}

function lastSpentLabel(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  if (iso === todayStr) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  const days = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (days >= 1 && days <= 31) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function EnvelopeGrid({ envelopes, groups, hideAmounts, onManage, onMoveMoney, onAssignFromRTA, onSetAssigned, onPayCreditCard }: Props) {
  const { formatCurrency } = useCurrency()
  const money = (n: number) => (hideAmounts ? '---' : formatCurrency(n))

  const router = useRouter()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menuCategory, setMenuCategory] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null)
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuPortalRef = useRef<HTMLDivElement | null>(null)

  function closeMenu() {
    setMenuCategory(null)
    setMenuAnchor(null)
    setMenuPortalTarget(null)
  }

  useEffect(() => {
    if (!menuCategory) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (menuPortalRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuCategory])

  // Portaled to <body> with viewport-fixed coordinates so the menu escapes
  // the card's clipping ancestors (.erd-main / .erd-content both clip
  // overflow regardless of z-index) instead of getting cropped.
  function openMenu(category: string, trigger: HTMLElement) {
    if (menuCategory === category) return closeMenu()
    const rect = trigger.getBoundingClientRect()
    setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    // Portal inside .expense-redesign (not document.body) so the menu still
    // inherits the --erd-* theme variables scoped to that wrapper; its
    // `overflow: hidden` doesn't clip position:fixed descendants.
    setMenuPortalTarget(trigger.closest<HTMLElement>('.expense-redesign'))
    setMenuCategory(category)
  }

  const ccEnvelope = useMemo(() => envelopes.find((e) => e.isCreditCardPayment) ?? null, [envelopes])

  const grouped = useMemo(() => {
    const regular = envelopes.filter((e) => !e.isCreditCardPayment)
    const list = groups
      .map((g) => ({ label: g, items: regular.filter((e) => e.group === g) }))
      .filter((g) => g.items.length > 0)
    const ungrouped = regular.filter((e) => !e.group)
    if (ungrouped.length > 0) list.push({ label: UNGROUPED_LABEL, items: ungrouped })
    return list
  }, [envelopes, groups])

  const allCollapsed = grouped.length > 0 && grouped.every((g) => collapsed.has(g.label))

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function renderRow(e: Envelope, group?: string) {
    const isCC = e.isCreditCardPayment
    const name = isCC ? 'Credit Card Payment' : splitEmoji(e.category).text
    const pct = Math.max(0, Math.min(100, e.spentPct))
    // Unclamped, for color only — see Mobile's ProgressBar thresholds: muted
    // at exactly 100%, coral past 90%, warn past 75%.
    const rawPct = usedPct(e)
    const fill = (!e.assigned && !e.spent) || rawPct === 100 ? 'is-done' : rawPct > 90 ? 'is-coral' : rawPct > 75 ? 'is-warn' : 'is-mint'
    const isMenuOpen = menuCategory === e.category

    return (
      <div key={e.category} className={`env2-row ${isMenuOpen ? 'is-open' : ''}`} ref={isMenuOpen ? menuRef : undefined}>
        <button
          type="button"
          className="env2-row-main"
          onClick={(ev) => openMenu(e.category, ev.currentTarget)}
          aria-expanded={isMenuOpen}
        >
          <span className="env2-row-top">
            <span className="env2-emoji">{isCC ? '💳' : categoryEmoji(e.category, group)}</span>
            <span className="env2-name">{name}</span>
            <span className="env2-spent-of">
              {money(e.spent)}/{money(e.assigned)}
            </span>
          </span>
          <span className="env-bar-track env2-bar">
            <span className={`env-bar-fill ${fill}`} style={{ display: 'block', width: `${pct}%` }} />
          </span>
          {!isCC && (
            <span className="env2-meta">
              Used {usedPctLabel(e)} · Last spent {lastSpentLabel(e.lastSpentDate)}
            </span>
          )}
        </button>
        <span className={`env2-available ${e.isOverspent ? 'is-neg' : ''}`}>{money(e.available)}</span>

        {isMenuOpen && menuAnchor && createPortal(
          <div
            className="env-menu env2-menu"
            ref={menuPortalRef}
            style={{ position: 'fixed', top: menuAnchor.top, right: menuAnchor.right }}
          >
            <button type="button" className="env-menu-item" onClick={() => { onMoveMoney(e.category); closeMenu() }}>
              Pull money from envelopes
            </button>
            <button type="button" className="env-menu-item" onClick={() => { onAssignFromRTA(e.category); closeMenu() }}>
              Assign from Ready to Assign
            </button>
            <button type="button" className="env-menu-item" onClick={() => { onSetAssigned(e.category); closeMenu() }}>
              Edit assigned amount
            </button>
            {!isCC && (
              <button
                type="button"
                className="env-menu-item"
                onClick={() => router.push(`/expense/transactions?category=${encodeURIComponent(e.category)}`)}
              >
                View transactions
              </button>
            )}
            {isCC && e.available > 0 && (
              <button type="button" className="env-menu-item env-menu-item-danger" onClick={() => { onPayCreditCard?.(); closeMenu() }}>
                Pay credit card bill
              </button>
            )}
          </div>,
          menuPortalTarget ?? document.body
        )}
      </div>
    )
  }

  return (
    <>
      <div className="env2-head">
        <div className="env2-head-title">
          <h3>Envelopes</h3>
          <button
            type="button"
            className="env2-icon-btn"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(grouped.map((g) => g.label)))}
            aria-label={allCollapsed ? 'Expand all' : 'Collapse all'}
            title={allCollapsed ? 'Expand all' : 'Collapse all'}
          >
            <ChevronsDownUp size={16} />
          </button>
        </div>
        <button type="button" className="erd-manage-btn" onClick={onManage}>
          Manage
        </button>
      </div>

      {!envelopes.length ? (
        <div className="account-empty">
          <span aria-hidden="true">🗂️</span>
          <div className="account-empty-title">No envelopes yet</div>
          <p className="account-row-meta">Envelopes hold your money for each kind of spending.</p>
          <button type="button" className="action-button is-active erd-accent-action" onClick={onManage}>
            Add your first envelope
          </button>
        </div>
      ) : (
        <div className="env2-list">
          {grouped.map(({ label, items }) => {
            const expanded = !collapsed.has(label)
            const totalAvailable = items.reduce((s, e) => s + e.available, 0)
            return (
              <div key={label} className="env2-group">
                <button type="button" className="env2-group-head" onClick={() => toggleGroup(label)} aria-expanded={expanded}>
                  <span className="env2-group-name">
                    <SpringChevron open={expanded} size={16} className="env2-chevron" />
                    <span className="env2-emoji">{groupEmoji(label)}</span>
                    <span>{splitEmoji(label).text}</span>
                  </span>
                  <span className={`env2-group-left ${totalAvailable < 0 ? 'is-neg' : ''}`}>{money(totalAvailable)} left</span>
                </button>
                <SpringCollapse open={expanded}>
                  <div className="env2-group-rows">{items.map((e) => renderRow(e, label))}</div>
                </SpringCollapse>
              </div>
            )
          })}
          {ccEnvelope && (
            <div className="env2-cc">
              <span className="env2-cc-badge">PAYOFF</span>
              {renderRow(ccEnvelope)}
            </div>
          )}
        </div>
      )}
    </>
  )
}
