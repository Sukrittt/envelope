import { it, expect, vi } from 'vitest'
vi.mock('@workos-inc/authkit-nextjs', () => ({saveSession: vi.fn()}))
vi.mock('@/lib/users', () => ({ensureUser: vi.fn()}))
vi.mock('@/lib/rateLimit', () => ({isRateLimited: async () => false, clientIp: () => 'test'}))
vi.mock('@/lib/workosClient', () => ({getWorkOSClient: () => ({userManagement: {authenticateWithMagicAuth: async () => ({user: {},accessToken:'access',refreshToken:'refresh'})}})}))
const {POST} = await import('./route')
it.each([undefined, 'iPhone'])('only echoes tokens to a labeled mobile device (%s)', async device => {
 const response = await POST(new Request('https://example.com/api/auth/magic-auth/verify',{method:'POST',body:JSON.stringify({email:'a@example.com',code:'123456',device})}))
 expect(await response.json()).toEqual(device ? {ok:true,accessToken:'access',refreshToken:'refresh'} : {ok:true})
})
