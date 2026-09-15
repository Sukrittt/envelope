'use client'
import { useState } from 'react'
import { CURRENCIES, currencyInfo } from '@/src/lib/currencies'
import { useCurrency } from '@/src/context/CurrencyContext'
import { useUpdateUser } from '@/src/hooks/useUser'

export function CurrencyPicker({ value, onChange, disabled = false }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('')
  const matches = CURRENCIES.filter(c => `${c.name} ${c.code} ${c.symbol}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <div style={{ width: '100%', minWidth: 0 }}>
    <p style={{ margin: '0 0 12px' }}>Selected: {currencyInfo(value).name} ({value})</p>
    <input type="search" aria-label="Search currencies" placeholder="Search currency or code" value={search} onChange={e => setSearch(e.target.value)} className="txn-entry-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
    <div role="group" aria-label="Currency" style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
      {matches.map(c => <button key={c.code} type="button" disabled={disabled} aria-pressed={value === c.code} onClick={() => onChange(c.code)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', minHeight: 48, color: 'var(--text)', background: value === c.code ? 'var(--mint-soft)' : 'transparent', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', font: 'inherit' }}>
        <span style={{ flex: 1 }}>{c.name}<small style={{ display: 'block', color: 'var(--text-2)' }}>{c.code}{c.symbol !== c.code ? ` · ${c.symbol}` : ''}</small></span>
        {value === c.code && <span aria-hidden="true">✓</span>}
      </button>)}
      {!matches.length && <p style={{ padding: 12 }}>No currencies found.</p>}
    </div>
  </div>
}

export function CurrencySetting() {
  const { currencyCode } = useCurrency()
  const update = useUpdateUser()
  const [open, setOpen] = useState(false)
  const current = currencyInfo(currencyCode)
  return <div>
    <button type="button" className="account-row" aria-expanded={open} onClick={() => setOpen(!open)} style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit' }}>
      <span className="account-row-label">Currency</span><span>{current.code}{current.symbol !== current.code ? ` · ${current.symbol}` : ''} {open ? '⌃' : '⌄'}</span>
    </button>
    {open && <div style={{ padding: 16 }}>
      <p>Changing currency updates how amounts are displayed. Amounts aren’t converted.</p>
      <CurrencyPicker value={currencyCode} disabled={update.isPending} onChange={code => update.mutate({ currencyCode: code }, { onSuccess: () => setOpen(false) })} />
      {update.isPending && <p role="status">Saving…</p>}
      {update.isError && <p role="alert">Couldn’t save currency. Please try again.</p>}
    </div>}
  </div>
}
