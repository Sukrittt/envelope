import { it, expect, vi } from 'vitest'
vi.mock('@/lib/access', () => ({getAuth: async () => ({userId:'user_b',readOnly:false}),readOnlyGuard: () => null}))
const deleteOne = vi.fn(async () => ({deletedCount:0}))
vi.mock('@/lib/mongodb', () => ({getDb: async () => ({collection: () => ({deleteOne})})}))
vi.mock('@/lib/push', async importOriginal => {
 const original = await importOriginal<typeof import('@/lib/push')>()
 return {...original, registerPushToken: async () => {throw new original.PushTokenConflict()}}
})
const route = await import('./route')
const request = () => new Request('https://example.com/api/notifications/register', {method:'POST',body:JSON.stringify({token:'ExponentPushToken[victim]',platform:'ios'})})
it('returns 409 for an already-owned token', async () => expect((await route.POST(request())).status).toBe(409))
it('unregisters only the authenticated account registration', async () => {
 await route.DELETE(request())
 expect(deleteOne).toHaveBeenCalledWith({token:'ExponentPushToken[victim]',user_id:'user_b'})
})
