import { describe, it, expect, vi, beforeEach } from 'vitest'

const findOneMock = vi.fn()
const getDbMock = vi.fn(async () => ({ collection: () => ({ findOne: findOneMock, updateOne: vi.fn() }) }))
vi.mock('./mongodb', () => ({ getDb: () => getDbMock() }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('system settings', () => {
  it('fails open to defaults when the DB is unreachable', async () => {
    getDbMock.mockRejectedValueOnce(new Error('down'))
    const { aiDisabledResponse, getSystemSettings } = await import('./systemSettings')
    expect(await getSystemSettings()).toEqual({
      aiDisabled: false,
      maintenance: { on: false, message: '' },
      appUpdate: {
        android: {
          latestVersion: '',
          storeUrl: 'https://play.google.com/store/apps/details?id=com.sukrit04.envelope',
        },
      },
    })
    getDbMock.mockRejectedValueOnce(new Error('down'))
    expect(await aiDisabledResponse()).toBeNull()
  })

  it('answers 503 when AI is disabled, and caches the read', async () => {
    findOneMock.mockResolvedValue({ _id: 'global', aiDisabled: true })
    const { aiDisabledResponse } = await import('./systemSettings')
    expect((await aiDisabledResponse())?.status).toBe(503)
    await aiDisabledResponse()
    expect(findOneMock).toHaveBeenCalledTimes(1)
  })

  it('backfills update defaults for an older settings document', async () => {
    findOneMock.mockResolvedValue({ _id: 'global', aiDisabled: false, maintenance: { on: true, message: 'Soon' } })
    const { getSystemSettings } = await import('./systemSettings')
    const settings = await getSystemSettings()
    expect(settings.appUpdate.android.latestVersion).toBe('')
    expect(settings.appUpdate.android.storeUrl).toContain('com.sukrit04.envelope')
  })
})
