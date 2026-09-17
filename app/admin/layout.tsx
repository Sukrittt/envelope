import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { AdminNav } from './AdminNav'
import '../../src/expense-redesign.css'
import './admin.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Aviary Admin', robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()

  return (
    <section className="expense-redesign">
      <div className="erd-main">
        <AdminNav />
        <main className="erd-content adm">{children}</main>
      </div>
    </section>
  )
}
