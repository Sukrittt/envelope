import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getAuthMock = vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null }))
const readOnlyGuardMock = vi.fn((): Response | null => null)
vi.mock('@/lib/access', () => ({
  getAuth: getAuthMock,
  readOnlyGuard: readOnlyGuardMock,
}))

const isRateLimitedMock = vi.fn(async () => false)
vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: isRateLimitedMock,
}))

const { POST } = await import('./route')

function postRequest(body: unknown): Request {
  return new Request('https://example.com/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  type: 'bug',
  title: 'Envelope balance is wrong',
  description: 'Moved money and the target envelope did not update.',
  diagnostics: { appVersion: '1.4.0 (12)', device: 'iPhone 15 · iOS 17.4', screen: '/account/help' },
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  getAuthMock.mockClear()
  getAuthMock.mockResolvedValue({ userId: 'user_a', readOnly: false, sessionId: null })
  readOnlyGuardMock.mockClear()
  readOnlyGuardMock.mockReturnValue(null)
  isRateLimitedMock.mockClear()
  isRateLimitedMock.mockResolvedValue(false)
  process.env.GITHUB_ISSUES_TOKEN = 'fake-token'
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ html_url: 'https://github.com/Sukrittt/ynab-replacement/issues/1' }), { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GITHUB_ISSUES_TOKEN
})

describe('POST /api/feedback', () => {
  it('files a bug issue with the bug label and Bug: title prefix', async () => {
    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sent = JSON.parse(init.body as string)
    expect(sent.title).toBe('Bug: Envelope balance is wrong')
    expect(sent.labels).toEqual(['bug'])
  })

  it('files an idea issue with the enhancement label and Idea: title prefix', async () => {
    const res = await POST(postRequest({ ...validBody, type: 'idea', title: 'Dark mode for charts' }))
    expect(res.status).toBe(200)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sent = JSON.parse(init.body as string)
    expect(sent.title).toBe('Idea: Dark mode for charts')
    expect(sent.labels).toEqual(['enhancement'])
  })

  it('never includes the user id in the issue body', async () => {
    await POST(postRequest(validBody))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sent = JSON.parse(init.body as string)
    expect(sent.body).not.toContain('user_a')
  })

  it('rejects an invalid type', async () => {
    const res = await POST(postRequest({ ...validBody, type: 'nonsense' }))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an empty title', async () => {
    const res = await POST(postRequest({ ...validBody, title: '  ' }))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an empty description', async () => {
    const res = await POST(postRequest({ ...validBody, description: '' }))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes through the read-only guard response for the demo user', async () => {
    const guardResponse = new Response(JSON.stringify({ error: 'read-only in demo mode' }), { status: 403 })
    readOnlyGuardMock.mockReturnValue(guardResponse)
    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 429 without calling GitHub once the rate limit is hit', async () => {
    isRateLimitedMock.mockResolvedValue(true)
    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a generic 502 when GitHub rejects the request', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 422 }))
    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).not.toMatch(/nope/)
  })

  it('returns a generic 502 when the token is missing', async () => {
    delete process.env.GITHUB_ISSUES_TOKEN
    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(502)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
