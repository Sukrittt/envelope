import { NextResponse } from 'next/server'
import { getDb } from './mongodb'
import { scoped, type ScopedCollection } from './scoped'
import type { Auth } from './access'

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

export function error(msg: string, status = 400): NextResponse {
  return NextResponse.json({ error: msg }, { status })
}

/** Escape a string for safe use inside a RegExp literal. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Parse a JSON request body, tolerating empty/malformed bodies (as the legacy middleware did). */
export async function readBody(req: Request): Promise<Record<string, string | number>> {
  try {
    const parsed = await req.json()
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Resolve a Mongo collection, scoped to the requesting user. The returned
 * handle injects `user_id` into every filter and insert, so handlers cannot
 * reach another user's documents — see `lib/scoped.ts`.
 */
export async function getCollection(base: string, auth: Auth): Promise<ScopedCollection> {
  const db = await getDb()
  return scoped(db.collection(base), auth.userId)
}

/** Force handlers to run dynamically (never prerendered at build time). */
export const dynamic = 'force-dynamic'

/** Current instant as IST wall-clock date/timestamp strings (always +05:30, regardless of server locale). */
export function nowIST(): { date: string; timestamp: string } {
  const iso = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString()
  return { date: iso.slice(0, 10), timestamp: `${iso.slice(0, 19)}+05:30` }
}
