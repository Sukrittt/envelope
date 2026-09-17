import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
import { ADMIN_AUDIT, type AdminAuditDoc } from '@/lib/adminAudit'
import type { UserDoc } from '@/lib/users'
import { fmtDateTime } from '../format'

export default async function AdminAudit() {
  const db = await getDb()
  const rows = await db.collection<AdminAuditDoc>(ADMIN_AUDIT).find().sort({ at: -1 }).limit(200).toArray()

  const ids = [...new Set(rows.flatMap((r) => [r.adminId, r.targetUserId]).filter((id): id is string => !!id))]
  const emails = new Map(
    (await db.collection<UserDoc>('users').find({ _id: { $in: ids } }, { projection: { email: 1 } }).toArray()).map((u) => [u._id, u.email]),
  )
  // Hard-deleted targets have no users doc left; their email was recorded in the entry itself.
  const who = (id: string | null, fallback?: unknown) => (id ? (emails.get(id) ?? (typeof fallback === 'string' ? fallback : id)) : '—')

  return (
    <>
      <div className="adm-head">
        <h1>Audit log</h1>
        <span className="adm-sub">Latest 200 admin actions</span>
      </div>
      <section className="erd-card">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r._id)}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.at)}</td>
                  <td>{who(r.adminId)}</td>
                  <td className="adm-mono">{r.action}</td>
                  <td>{r.targetUserId && emails.has(r.targetUserId) ? <Link href={`/admin/users/${encodeURIComponent(r.targetUserId)}`}>{who(r.targetUserId)}</Link> : who(r.targetUserId, r.detail.email)}</td>
                  <td className="adm-mono adm-muted">{JSON.stringify(r.detail)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="adm-muted">
                    No admin actions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
