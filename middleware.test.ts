import { it, expect, vi } from 'vitest'
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server'
vi.mock('@workos-inc/authkit-nextjs', () => ({authkitMiddleware: () => async () => NextResponse.next()}))
vi.mock('@/lib/access', () => ({bearerToken: () => 'cron-secret', verifyBearerToken: vi.fn(async () => null)}))
const { default: middleware } = await import('./middleware')
it.each(['/api/cron/gc', '/api/cron/future', '/api/notifications/run'])('lets the handler authenticate %s', async path => {
 expect((await middleware(new NextRequest('https://example.com'+path), {} as NextFetchEvent))?.status).toBe(200)
})
it('rejects invalid bearer on ordinary API routes', async () => {
 expect((await middleware(new NextRequest('https://example.com/api/expenses'), {} as NextFetchEvent))?.status).toBe(401)
})

it.each(['/privacy-policy', '/legal/privacy', '/expense', '/account'])('keeps %s public without a session', async path => {
 const response = await middleware(new NextRequest('https://example.com'+path), {} as NextFetchEvent)
 expect(response?.status).toBe(200)
 expect(response?.headers.get('location')).toBeNull()
})
