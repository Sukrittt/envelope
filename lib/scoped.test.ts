import { describe, it, expect } from 'vitest'
import { scoped } from './scoped'

type Call = { method: string; args: unknown[] }

/** Fake Mongo collection that records every call it's handed. */
function spy() {
  const calls: Call[] = []
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args })
      return method === 'find' || method === 'aggregate' ? { toArray: async () => [], map: () => ({ toArray: async () => [] }) } : Promise.resolve({})
    }
  return {
    calls,
    find: record('find'),
    findOne: record('findOne'),
    insertOne: record('insertOne'),
    insertMany: record('insertMany'),
    updateOne: record('updateOne'),
    updateMany: record('updateMany'),
    replaceOne: record('replaceOne'),
    deleteOne: record('deleteOne'),
    deleteMany: record('deleteMany'),
    countDocuments: record('countDocuments'),
    distinct: record('distinct'),
    aggregate: record('aggregate'),
    bulkWrite: record('bulkWrite'),
  }
}

describe('scoped()', () => {
  it('injects user_id into every filter and stamps it on every insert', () => {
    const s = spy()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = scoped(s as any, 'user_alice')

    c.find({ date: '2026-01-01' })
    c.findOne({ name: 'Rent' })
    c.updateOne({ month: '2026-01' }, { $set: { assigned: '1' } })
    c.deleteOne({ name: 'Gone' })
    c.countDocuments({})
    c.insertOne({ item: 'Coffee' })
    c.bulkWrite([{ updateOne: { filter: { name: 'A' }, update: { $set: { order: 1 } } } }])

    expect(s.calls.length).toBe(7)
    for (const { method, args } of s.calls) {
      if (method === 'insertOne') {
        expect((args[0] as Record<string, unknown>).user_id).toBe('user_alice')
      } else if (method === 'bulkWrite') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((args[0] as any[])[0].updateOne.filter.user_id).toBe('user_alice')
      } else {
        expect((args[0] as Record<string, unknown>).user_id).toBe('user_alice')
      }
    }
  })

  it('does not let a caller-supplied user_id override the scope', () => {
    const s = spy()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scoped(s as any, 'user_alice').find({ user_id: 'user_bob' })
    expect((s.calls[0].args[0] as Record<string, unknown>).user_id).toBe('user_alice')
  })

  it('insertMany stamps user_id on every document', () => {
    const s = spy()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scoped(s as any, 'user_alice').insertMany([{ item: 'A' }, { item: 'B' }])
    const docs = s.calls[0].args[0] as Record<string, unknown>[]
    expect(docs.every((d) => d.user_id === 'user_alice')).toBe(true)
  })

  it('bulkWrite scopes every operation kind', () => {
    const s = spy()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scoped(s as any, 'user_alice').bulkWrite([
      { insertOne: { document: { item: 'A' } } },
      { updateMany: { filter: { x: 1 }, update: { $set: { y: 1 } } } },
      { deleteMany: { filter: { x: 1 } } },
      { replaceOne: { filter: { x: 1 }, replacement: { item: 'B' } } },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops = s.calls[0].args[0] as any[]
    expect(ops[0].insertOne.document.user_id).toBe('user_alice')
    expect(ops[1].updateMany.filter.user_id).toBe('user_alice')
    expect(ops[2].deleteMany.filter.user_id).toBe('user_alice')
    expect(ops[3].replaceOne.filter.user_id).toBe('user_alice')
    expect(ops[3].replaceOne.replacement.user_id).toBe('user_alice')
  })

  it('aggregate forces a user_id $match as the first stage', () => {
    const s = spy()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scoped(s as any, 'user_alice').aggregate([{ $group: { _id: '$category' } }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline = s.calls[0].args[0] as any[]
    expect(pipeline[0]).toEqual({ $match: { user_id: 'user_alice' } })
  })
})
