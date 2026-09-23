import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { Collection } from 'mongodb'

// chat_sessions has encrypted fields, so scoped() needs a key to stamp a doc.
process.env.FIELD_KEY_V1 = randomBytes(32).toString('base64')

const invalidateBrief = vi.fn(async () => undefined)
vi.mock('./ai/briefCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ai/briefCache')>()
  return { ...actual, invalidateBrief: (...args: unknown[]) => invalidateBrief(...(args as [])) }
})

const { scoped } = await import('./scoped')

function fake(collectionName: string) {
  return {
    collectionName,
    find: () => ({ toArray: async () => [] }),
    findOne: async () => null,
    insertOne: async () => ({}),
    updateOne: async () => ({ acknowledged: true, matchedCount: 1 }),
    updateMany: async () => ({ acknowledged: true, matchedCount: 1 }),
    deleteOne: async () => ({}),
    deleteMany: async () => ({}),
    bulkWrite: async () => ({}),
  } as unknown as Collection<Record<string, unknown>>
}

beforeEach(() => vi.clearAllMocks())

describe('money brief cache invalidation', () => {
  it.each(['expenses', 'budgets', 'categories', 'groups', 'subscriptions', 'holdings'])(
    'drops the cached brief after a write to %s',
    async (name) => {
      await scoped(fake(name), 'user_1').insertOne({ any: 'thing' })
      expect(invalidateBrief).toHaveBeenCalledWith('user_1')
    },
  )

  it('drops it on updates and soft deletes too, not just inserts', async () => {
    const coll = scoped(fake('expenses'), 'user_1')

    await coll.updateOne({ client_id: 'c1' }, { $set: { amount_inr: 10 } })
    await coll.deleteOne({ client_id: 'c1' })
    await coll.bulkWrite([{ insertOne: { document: { a: 1 } } }])

    expect(invalidateBrief).toHaveBeenCalledTimes(3)
  })

  it('leaves the cache alone for collections the brief never reads', async () => {
    await scoped(fake('chat_sessions'), 'user_1').insertOne({ title: 'hi' })
    await scoped(fake('ai_brief'), 'user_1').updateOne({ client_id: 'c1' }, { $set: { payload: {} } })

    expect(invalidateBrief).not.toHaveBeenCalled()
  })

  it('never fails the write when clearing the cache fails', async () => {
    invalidateBrief.mockRejectedValue(new Error('mongo down'))

    await expect(scoped(fake('expenses'), 'user_1').insertOne({ any: 'thing' })).resolves.toBeDefined()
  })
})
