import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = {
  docs: [] as Array<{ token: string; user_id: string; platform: string; createdAt: string; updatedAt: string }>,
}

function fakeCollection() {
  return {
    updateOne: vi.fn(async (filter: { token: string; user_id: string }, update: { $set: Record<string, unknown> }) => {
      const doc = state.docs.find((d) => d.token === filter.token && d.user_id === filter.user_id)
      if (!doc) return { matchedCount: 0 }
      Object.assign(doc, update.$set)
      return { matchedCount: 1 }
    }),
    deleteOne: vi.fn(async (filter: { token: string }) => {
      state.docs = state.docs.filter((d) => d.token !== filter.token)
      return { deletedCount: 1 }
    }),
    insertOne: vi.fn(async (doc: (typeof state.docs)[number]) => {
      state.docs.push(doc)
      return { insertedId: doc.token }
    }),
  }
}

vi.mock('./mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => fakeCollection()),
  })),
}))

const { registerPushToken } = await import('./push')

const VALID_TOKEN = 'ExponentPushToken[abc123XYZ_-]'

beforeEach(() => {
  state.docs = []
})

describe('registerPushToken', () => {
  it('rejects a token that does not look like an Expo push token', async () => {
    await expect(registerPushToken('not-a-real-token', 'ios', 'user_a')).rejects.toThrow()
    expect(state.docs).toHaveLength(0)
  })

  it('inserts a brand-new token for its owner', async () => {
    await registerPushToken(VALID_TOKEN, 'ios', 'user_a')
    expect(state.docs).toHaveLength(1)
    expect(state.docs[0]).toMatchObject({ token: VALID_TOKEN, user_id: 'user_a', platform: 'ios' })
  })

  it('updates in place when the same user re-registers the same token', async () => {
    await registerPushToken(VALID_TOKEN, 'ios', 'user_a')
    await registerPushToken(VALID_TOKEN, 'android', 'user_a')
    expect(state.docs).toHaveLength(1)
    expect(state.docs[0].platform).toBe('android')
  })

  it('moves a token to a new owner on re-registration under a different account, rather than duplicating it', async () => {
    await registerPushToken(VALID_TOKEN, 'ios', 'user_a')
    await registerPushToken(VALID_TOKEN, 'ios', 'user_b')
    expect(state.docs).toHaveLength(1)
    expect(state.docs[0].user_id).toBe('user_b')
  })
})
