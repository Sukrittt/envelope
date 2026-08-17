import { NextResponse } from 'next/server'
import { getDb } from './mongodb'
import { resolveCollection, type Scope } from './access'
import type { Collection } from 'mongodb'

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

/** Parse a JSON request body, tolerating empty/malformed bodies (as the legacy middleware did). */
export async function readBody(req: Request): Promise<Record<string, string | number>> {
  try {
    const parsed = await req.json()
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Resolve a Mongo collection for a base name + scope (real vs demo_*). */
export async function getCollection(base: string, scope: Scope): Promise<Collection<Record<string, unknown>>> {
  const db = await getDb()
  return db.collection(resolveCollection(base, scope))
}

/** Force handlers to run dynamically (never prerendered at build time). */
export const dynamic = 'force-dynamic'

/** Current instant as IST wall-clock date/timestamp strings (always +05:30, regardless of server locale). */
export function nowIST(): { date: string; timestamp: string } {
  const iso = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString()
  return { date: iso.slice(0, 10), timestamp: `${iso.slice(0, 19)}+05:30` }
}
