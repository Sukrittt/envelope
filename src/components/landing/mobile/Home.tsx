'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, ChevronsDownUp, LineChart } from 'lucide-react'
import { categoryEmoji, groupEmoji, splitEmoji } from '@/src/lib/emoji'
import { formatCurrency } from '@/src/lib/format'
import { AmountText, AutoHeight, BottomSheet, IconButton, NAV_HEIGHT, PHONE, T, col, font, pressable, radius, row, space, type } from './kit'
import { fillColor } from './LogExpense'
import { DAYS_LEFT, GROUPS, MONTH_LABEL, toEnvelope, type DemoCategory, type Envelope } from './demo'

/** Twin of Mobile's app/(tabs)/index.tsx with envelope/{EnvelopeGroup,EnvelopeRow,ProgressBar}.tsx. */

const GROUP_SPRING = { type: 'spring', damping: 90, stiffness: 900, mass: 1 } as const
const LAYOUT_SPRING = { type: 'spring', damping: 64, stiffness: 900, mass: 1 } as const

export function HomeScreen({
  categories,
  onOpenInsights,
  notice,
}: {
  categories: DemoCategory[]
  onOpenInsights: () => void
  /** For sheet actions whose screens live only in the app. */
  notice: (message: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['🏠 House']))
  const envelopes = categories.map(toEnvelope)
  const grouped = GROUPS.map((group) => ({ group, envelopes: envelopes.filter((e) => e.group === group) }))
  const allCollapsed = grouped.every((g) => collapsed.has(g.group))

  function toggle(group: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <div style={{ ...col, height: '100%', background: T.bg }}>
      <div style={{ ...row, justifyContent: 'space-between', paddingTop: PHONE.top + space.md, paddingInline: space.lg, paddingBottom: space.md }}>
        <span style={{ color: T.text, ...font.displayBold, fontSize: type.heading, letterSpacing: -0.5 }}>Aviary</span>
        <IconButton icon={LineChart} label="Insights" onPress={onOpenInsights} />
      </div>

      <div
        className="m-noscroll"
        style={{ flex: 1, overflowY: 'auto', paddingInline: space.lg, paddingBottom: NAV_HEIGHT + PHONE.bottom + space.lg }}
      >
        <div style={{ ...col, gap: space.lg }}>
          <div style={{ ...col, alignItems: 'center', gap: 6, paddingBlock: space.xl }}>
            <span style={{ color: T.text2, ...font.bodySemiBold, fontSize: 10, letterSpacing: 0.6 }}>READY TO ASSIGN</span>
            <AmountText value={0} size={type.hero} color={T.text} weight="displayBold" animate />
            <span style={{ color: T.text2, ...font.bodyMedium, fontSize: type.caption }}>
              {MONTH_LABEL} · {DAYS_LEFT} days left
            </span>
          </div>

          <AutoHeight
            transition={LAYOUT_SPRING}
            style={{ background: T.card, borderRadius: radius.lg, border: `1px solid ${T.border}`, overflow: 'hidden' }}
            innerStyle={{ padding: space.lg }}
          >
            <div style={{ ...row, justifyContent: 'space-between' }}>
              <div style={{ ...row, gap: space.xs }}>
                <span style={{ color: T.text, ...font.displaySemiBold, fontSize: type.bodyLg }}>Envelopes</span>
                <IconButton
                  icon={ChevronsDownUp}
                  label={allCollapsed ? 'Expand all' : 'Collapse all'}
                  onPress={() => setCollapsed(allCollapsed ? new Set() : new Set(GROUPS))}
                  size={28}
                  color={T.accentInk}
                  background="transparent"
                />
              </div>
              <button type="button" style={pressable} onClick={() => notice('Manage lives in the app. Poke the envelopes here.')}>
                <span style={{ color: T.accentInk, fontSize: type.caption, ...font.bodySemiBold }}>Manage</span>
              </button>
            </div>
            <div style={{ marginTop: space.xs }}>
              {grouped.map(({ group, envelopes }) => (
                <EnvelopeGroup
                  key={group}
                  group={group}
                  envelopes={envelopes}
                  expanded={!collapsed.has(group)}
                  onToggle={toggle}
                  notice={notice}
                />
              ))}
            </div>
          </AutoHeight>

          <button
            type="button"
            onClick={onOpenInsights}
            style={{ ...pressable, ...row, justifyContent: 'center', gap: 4, paddingBlock: 14, borderRadius: radius.lg }}
          >
            <span style={{ color: T.text2, fontSize: type.caption, ...font.bodySemiBold }}>Trends, daily spend and subscriptions</span>
            <ChevronRight size={16} color={T.text2} />
          </button>
        </div>
      </div>
    </div>
  )
}

function EnvelopeGroup({
  group,
  envelopes,
  expanded,
  onToggle,
  notice,
}: {
  group: string
  envelopes: Envelope[]
  expanded: boolean
  onToggle: (group: string) => void
  notice: (message: string) => void
}) {
  const totalAvailable = envelopes.reduce((s, e) => s + e.available, 0)
  return (
    <motion.div layout="position" transition={GROUP_SPRING} style={{ borderTop: `1px solid ${T.border}`, paddingBlock: 8 }}>
      <button
        type="button"
        onClick={() => onToggle(group)}
        style={{ ...pressable, ...row, width: '100%', justifyContent: 'space-between', paddingBlock: 4 }}
      >
        <div style={{ ...row, gap: 8 }}>
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={GROUP_SPRING} style={{ display: 'flex' }}>
            <ChevronRight size={16} color={T.text2} strokeWidth={2} />
          </motion.div>
          <span style={{ fontSize: 14 }}>{groupEmoji(group)}</span>
          <span style={{ color: T.text, ...font.bodyExtraBold, fontSize: 13 }}>{splitEmoji(group).text}</span>
        </div>
        <span style={{ color: T.mint, ...font.bodySemiBold, fontSize: 12 }}>{formatCurrency(totalAvailable)} left</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            style={{ paddingLeft: 12, paddingBottom: 10, marginLeft: 6, borderLeft: `0.5px solid ${T.border}` }}
          >
            {envelopes.map((e, i) => (
              <div
                key={e.category}
                style={i > 0 ? { borderTop: `0.5px solid ${T.border}`, marginTop: 2, marginLeft: -12, paddingLeft: 12 } : undefined}
              >
                <EnvelopeRow envelope={e} emoji={categoryEmoji(e.category, group)} notice={notice} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function usedPctLabel(e: Envelope): string {
  if (e.assigned > 0) return `${Math.round((e.spent / e.assigned) * 100)}%`
  return e.spent > 0 ? '∞' : '—'
}

function lastSpentLabel(days: number): string {
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`
}

function EnvelopeRow({ envelope, emoji, notice }: { envelope: Envelope; emoji: string; notice: (message: string) => void }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const name = splitEmoji(envelope.category).text
  const pct = Math.max(0, Math.min(100, envelope.spentPct))

  function action() {
    setSheetOpen(false)
    notice('That screen lives in the app.')
  }

  const sheetBtn = { ...pressable, display: 'block', width: '100%', textAlign: 'left', paddingBlock: 12 } as const

  return (
    <div style={{ ...row, gap: 10, paddingBlock: 8 }}>
      <button type="button" onClick={() => setSheetOpen(true)} style={{ ...pressable, ...col, flex: 1, gap: 6, minWidth: 0, textAlign: 'left' }}>
        <div style={{ ...row, gap: 8, width: '100%' }}>
          <span style={{ fontSize: 14 }}>{emoji}</span>
          <span style={{ color: T.text, ...font.bodySemiBold, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </span>
          <span style={{ marginLeft: 'auto', color: T.text2, ...font.bodyMedium, fontSize: 12, whiteSpace: 'nowrap' }}>
            {formatCurrency(envelope.spent)}/{formatCurrency(envelope.assigned)}
          </span>
        </div>
        <div style={{ width: '100%', height: 5, borderRadius: 100, overflow: 'hidden', background: T.borderStrong }}>
          <div style={{ height: '100%', borderRadius: 100, width: `${pct}%`, background: fillColor(pct, T) }} />
        </div>
        <span style={{ color: T.text3, ...font.bodyMedium, fontSize: 10, marginTop: 2 }}>
          Used {usedPctLabel(envelope)} · Last spent {lastSpentLabel(envelope.lastSpentDaysAgo)}
        </span>
      </button>
      <span
        style={{
          color: envelope.isOverspent ? T.coral : T.mint,
          ...font.bodySemiBold,
          fontSize: 12,
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {formatCurrency(envelope.available)}
      </span>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div style={{ color: T.text, ...font.displaySemiBold, fontSize: 16, marginBottom: 8 }}>{name}</div>
        {['Move money between envelopes', 'Edit assigned amount', 'View transactions'].map((label) => (
          <button key={label} type="button" style={sheetBtn} onClick={action}>
            <span style={{ color: T.text, ...font.bodyMedium, fontSize: 14 }}>{label}</span>
          </button>
        ))}
      </BottomSheet>
    </div>
  )
}
