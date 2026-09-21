'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
  /** Muted second line, e.g. a balance or a code. */
  hint?: string
  disabled?: boolean
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Shown when `value` matches no option (e.g. the empty "Assign to" state). */
  placeholder?: string
  'aria-label'?: string
  id?: string
  disabled?: boolean
  className?: string
}

const MAX_MENU_HEIGHT = 280
const GAP = 6
const EDGE = 12

interface Placement {
  top: number
  left: number
  width: number
  maxHeight: number
  above: boolean
}

/**
 * Themed replacement for the native `<select>` — the menu is a portalled,
 * fixed-position listbox so modals with `overflow: auto` never clip it, and it
 * flips above the trigger when there is no room below. Keyboard: arrows / Home /
 * End move, Enter / Space pick, Escape closes, typing jumps to a match.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  'aria-label': ariaLabel,
  id,
  disabled = false,
  className = '',
}: Props) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<Placement | null>(null)

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const measure = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - GAP - EDGE
    const above = r.top - GAP - EDGE
    const flip = below < 160 && above > below
    const maxHeight = Math.max(120, Math.min(MAX_MENU_HEIGHT, flip ? above : below))
    setPlace({
      top: flip ? r.top - GAP : r.bottom + GAP,
      left: Math.max(EDGE, Math.min(r.left, window.innerWidth - r.width - EDGE)),
      width: r.width,
      maxHeight,
      above: flip,
    })
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    const firstEnabled = options.findIndex((o) => !o.disabled)
    setActive(selectedIndex >= 0 ? selectedIndex : firstEnabled)
    setOpen(true)
  }, [disabled, options, selectedIndex])

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const pick = useCallback((i: number) => {
    const opt = options[i]
    if (!opt || opt.disabled) return
    onChange(opt.value)
    close()
  }, [options, onChange, close])

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, measure])

  // Dismiss on outside press; follow the trigger on resize, but close on any
  // outer scroll (a fixed menu would otherwise float away from its trigger).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close(false)
    }
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      close(false)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close, measure])

  useEffect(() => {
    if (!open || active < 0) return
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, place])

  function step(from: number, dir: 1 | -1) {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i
    }
    return from
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => step(a, 1)); break
      case 'ArrowUp': e.preventDefault(); setActive((a) => step(a, -1)); break
      case 'Home': e.preventDefault(); setActive(step(-1, 1)); break
      case 'End': e.preventDefault(); setActive(step(options.length, -1)); break
      case 'Enter':
      case ' ': e.preventDefault(); pick(active); break
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break
      case 'Tab': close(false); break
      default: {
        if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return
        const now = Date.now()
        const t = typeahead.current
        t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase()
        t.at = now
        const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().includes(t.text))
        if (hit >= 0) setActive(hit)
      }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        className={`ui-select${open ? ' is-open' : ''}${selected ? '' : ' is-placeholder'}${className ? ` ${className}` : ''}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="ui-select-value">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="ui-select-chevron" size={16} aria-hidden="true" />
      </button>
      {open && place && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`ui-select-menu${place.above ? ' is-above' : ''}`}
          style={{
            left: place.left,
            width: place.width,
            maxHeight: place.maxHeight,
            ...(place.above ? { bottom: window.innerHeight - place.top } : { top: place.top }),
          }}
        >
          {options.length === 0 && <div className="ui-select-empty">No options</div>}
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              data-index={i}
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={`ui-select-option${i === active ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
              // mousedown, not click: keeps focus on the trigger.
              onMouseDown={(e) => { e.preventDefault(); pick(i) }}
              onMouseMove={() => !o.disabled && setActive(i)}
            >
              <span className="ui-select-option-text">
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </span>
              {o.value === value && <Check size={15} aria-hidden="true" />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
