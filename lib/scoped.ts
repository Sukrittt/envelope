import type {
  AggregateOptions,
  AnyBulkWriteOperation,
  BulkWriteOptions,
  BulkWriteResult,
  Collection,
  CountDocumentsOptions,
  DeleteOptions,
  DeleteResult,
  DistinctOptions,
  Filter,
  FindCursor,
  FindOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  ReplaceOptions,
  UpdateFilter,
  UpdateOptions,
  UpdateResult,
  WithId,
} from 'mongodb'
import { encrypt, decrypt, isEncrypted } from './crypto'
import { fieldsFor, fieldAad as aad } from './encryptedFields'

type Doc = Record<string, unknown>

/** Encrypts a doc's encrypted fields before insert/replace. Idempotent — skips a value already `enc:`. */
function encDoc(doc: Doc, fields: string[], userId: string, collectionName: string): Doc {
  if (fields.length === 0) return doc
  const out: Doc = { ...doc }
  for (const field of fields) {
    if (field === 'messages.text') {
      if (Array.isArray(out.messages)) {
        out.messages = (out.messages as Doc[]).map((m) =>
          typeof m.text === 'string' && !isEncrypted(m.text)
            ? { ...m, text: encrypt(m.text, aad(userId, collectionName, field)) }
            : m,
        )
      }
      continue
    }
    const value = out[field]
    if (typeof value === 'string' && !isEncrypted(value)) {
      out[field] = encrypt(value, aad(userId, collectionName, field))
    }
  }
  return out
}

/** Decrypts a doc's encrypted fields after read. `decrypt()` itself passes plaintext through untouched. */
function decDoc(doc: Doc, fields: string[], userId: string, collectionName: string): Doc {
  if (fields.length === 0) return doc
  const out: Doc = { ...doc }
  for (const field of fields) {
    if (field === 'messages.text') {
      if (Array.isArray(out.messages)) {
        out.messages = (out.messages as Doc[]).map((m) =>
          typeof m.text === 'string' ? { ...m, text: decrypt(m.text, aad(userId, collectionName, field)) } : m,
        )
      }
      continue
    }
    if (typeof out[field] === 'string') {
      out[field] = decrypt(out[field], aad(userId, collectionName, field))
    }
  }
  return out
}

/** Throws if `filter` names an encrypted field — non-deterministic ciphertext can never match one. */
function assertFilterSafe(filter: Doc, fields: string[]): void {
  for (const key of Object.keys(filter)) {
    if (fields.includes(key)) {
      throw new Error(`scoped(): cannot filter on encrypted field "${key}" — use _id or a plaintext field instead`)
    }
  }
}

/** Encrypts the encrypted fields named in an update's $set/$setOnInsert/$push; rejects $inc/$mul/$unset on one. */
function encUpdate(update: Doc, fields: string[], userId: string, collectionName: string): Doc {
  if (fields.length === 0) return update
  const out: Doc = { ...update }

  for (const op of ['$set', '$setOnInsert'] as const) {
    const opDoc = out[op]
    if (opDoc && typeof opDoc === 'object') {
      const flat: Doc = { ...(opDoc as Doc) }
      for (const field of fields) {
        if (field.includes('.')) continue // handled via $push below
        const value = flat[field]
        if (typeof value === 'string' && !isEncrypted(value)) {
          flat[field] = encrypt(value, aad(userId, collectionName, field))
        }
      }
      out[op] = flat
    }
  }

  if (out.$push && typeof out.$push === 'object') {
    const push: Doc = {}
    for (const [key, rawValue] of Object.entries(out.$push as Doc)) {
      const nestedField = `${key}.text`
      if (!fields.includes(nestedField)) {
        push[key] = rawValue
        continue
      }
      const aadStr = aad(userId, collectionName, nestedField)
      const encItem = (item: unknown): unknown =>
        item && typeof item === 'object' && typeof (item as Doc).text === 'string' && !isEncrypted((item as Doc).text)
          ? { ...(item as Doc), text: encrypt((item as Doc).text as string, aadStr) }
          : item
      if (rawValue && typeof rawValue === 'object' && '$each' in (rawValue as Doc)) {
        const each = (rawValue as Doc).$each
        push[key] = { ...(rawValue as Doc), $each: Array.isArray(each) ? each.map(encItem) : each }
      } else {
        push[key] = encItem(rawValue)
      }
    }
    out.$push = push
  }

  for (const op of ['$inc', '$mul', '$unset'] as const) {
    const opDoc = out[op]
    if (opDoc && typeof opDoc === 'object') {
      for (const key of Object.keys(opDoc as Doc)) {
        if (fields.includes(key)) {
          throw new Error(`scoped(): ${op} on encrypted field "${key}" is not supported — read, decrypt, and $set instead`)
        }
      }
    }
  }

  return out
}

/**
 * Ownership-scoped view of a Mongo collection.
 *
 * Every filter gets `user_id` merged in and every inserted document gets it
 * stamped on, so a handler cannot read or write another user's documents even
 * if it forgets to think about tenancy. The check lives here instead of in the
 * ~50 `getCollection` call sites that would each otherwise have to remember it.
 *
 * Also the one choke point for field-level encryption (see
 * lib/encryptedFields.ts and lib/crypto.ts): inserts/replaces/$set/$push
 * encrypt on the way in, find/findOne/aggregate decrypt on the way out, and
 * any filter/distinct naming an encrypted field throws rather than silently
 * matching nothing.
 *
 * Method signatures mirror the driver's, so existing handler code (including
 * `.find(...).sort(...).limit(...).toArray()` chains) works unchanged.
 *
 * Upserts need no special handling for tenancy OR encryption: Mongo copies
 * equality conditions from the filter into the document it creates, and
 * `user_id` is always one of them — and the filter guard above already
 * proves every filter equality is a plaintext field, since an encrypted one
 * would have thrown.
 *
 * ponytail: enforcement is application-side, not row-level security in the
 * database — a raw `db.collection(...)` handle still sees every user's rows
 * (and ciphertext, unreadable without the key). Move to per-user databases
 * only if that ever stops being acceptable.
 */
/** Extra behavior for read/delete methods, beyond the driver's own options. */
interface ScopeOpts {
  /** Include soft-deleted (archived) docs instead of the default live-only view. */
  includeDeleted?: boolean
}

export function scoped(coll: Collection<Doc>, userId: string) {
  const collectionName = coll.collectionName
  const fields = fieldsFor(collectionName)
  const nowIso = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString()

  const own = (filter: Filter<Doc> = {}, opts: ScopeOpts = {}): Filter<Doc> => {
    assertFilterSafe(filter as Doc, fields)
    return { ...filter, user_id: userId, ...(opts.includeDeleted ? {} : { deleted_at: null }) }
  }
  const stamp = (doc: Doc): Doc => ({ ...encDoc(doc, fields, userId, collectionName), user_id: userId, deleted_at: null })
  const decode = (doc: Doc): Doc => decDoc(doc, fields, userId, collectionName)

  return {
    /** The user this view is scoped to. */
    userId,

    find(filter: Filter<Doc> = {}, options?: FindOptions, scopeOpts?: ScopeOpts): FindCursor<WithId<Doc>> {
      return coll.find(own(filter, scopeOpts), options).map((d) => decode(d) as WithId<Doc>)
    },

    async findOne(filter: Filter<Doc> = {}, options?: FindOptions, scopeOpts?: ScopeOpts): Promise<WithId<Doc> | null> {
      const doc = await coll.findOne(own(filter, scopeOpts), options)
      return doc ? (decode(doc) as WithId<Doc>) : null
    },

    countDocuments(filter: Filter<Doc> = {}, options?: CountDocumentsOptions, scopeOpts?: ScopeOpts): Promise<number> {
      return coll.countDocuments(own(filter, scopeOpts), options)
    },

    distinct(key: string, filter: Filter<Doc> = {}, options: DistinctOptions = {}): Promise<unknown[]> {
      if (fields.includes(key)) {
        throw new Error(`scoped(): cannot distinct() on encrypted field "${key}" — every value is unique under random IVs`)
      }
      return coll.distinct(key, own(filter), options)
    },

    /** Aggregation with an ownership+live `$match` forced as the first stage. Decrypts top-level output fields by name. */
    aggregate<T extends Doc = Doc>(pipeline: Doc[] = [], options?: AggregateOptions) {
      return coll
        .aggregate<T>([{ $match: { user_id: userId, deleted_at: null } }, ...pipeline], options)
        .map((d) => decode(d as Doc) as T)
    },

    insertOne(doc: Doc, options?: InsertOneOptions): Promise<InsertOneResult<Doc>> {
      return coll.insertOne(stamp(doc) as never, options)
    },

    insertMany(docs: Doc[], options?: BulkWriteOptions): Promise<InsertManyResult<Doc>> {
      return coll.insertMany(docs.map(stamp) as never, options)
    },

    updateOne(
      filter: Filter<Doc>,
      update: UpdateFilter<Doc>,
      options?: UpdateOptions,
    ): Promise<UpdateResult<Doc>> {
      return coll.updateOne(own(filter), encUpdate(update as Doc, fields, userId, collectionName) as never, options)
    },

    updateMany(
      filter: Filter<Doc>,
      update: UpdateFilter<Doc>,
      options?: UpdateOptions,
    ): Promise<UpdateResult<Doc>> {
      return coll.updateMany(own(filter), encUpdate(update as Doc, fields, userId, collectionName) as never, options)
    },

    replaceOne(
      filter: Filter<Doc>,
      replacement: Doc,
      options?: ReplaceOptions,
    ): Promise<UpdateResult<Doc>> {
      return coll.replaceOne(own(filter), stamp(replacement), options) as Promise<UpdateResult<Doc>>
    },

    /** Soft delete: stamps `deleted_at` rather than removing the document. See `purge` for a real delete. */
    async deleteOne(filter: Filter<Doc>, options?: DeleteOptions): Promise<DeleteResult> {
      const result = await coll.updateOne(own(filter), { $set: { deleted_at: nowIso() } } as never, options)
      return { acknowledged: result.acknowledged, deletedCount: result.matchedCount }
    },

    /** Soft delete: stamps `deleted_at` on every match rather than removing them. See `purgeMany` for a real delete. */
    async deleteMany(filter: Filter<Doc>, options?: DeleteOptions): Promise<DeleteResult> {
      const result = await coll.updateMany(own(filter), { $set: { deleted_at: nowIso() } } as never, options)
      return { acknowledged: result.acknowledged, deletedCount: result.matchedCount }
    },

    /** Un-does a soft delete: clears `deleted_at` on a previously archived document. */
    restore(filter: Filter<Doc>, options?: UpdateOptions): Promise<UpdateResult<Doc>> {
      return coll.updateOne(own(filter, { includeDeleted: true }), { $set: { deleted_at: null } } as never, options)
    },

    /** Real, unrecoverable delete of an archived document — only the GC cron should call this. */
    purge(filter: Filter<Doc>, options?: DeleteOptions): Promise<DeleteResult> {
      return coll.deleteOne(own(filter, { includeDeleted: true }), options)
    },

    /** Real, unrecoverable delete of every matching document — only the GC cron should call this. */
    purgeMany(filter: Filter<Doc>, options?: DeleteOptions): Promise<DeleteResult> {
      return coll.deleteMany(own(filter, { includeDeleted: true }), options)
    },

    bulkWrite(
      ops: AnyBulkWriteOperation<Doc>[],
      options?: BulkWriteOptions,
    ): Promise<BulkWriteResult> {
      return coll.bulkWrite(
        ops.map((op) => scopeBulkOp(op, own, stamp, (u) => encUpdate(u, fields, userId, collectionName))),
        options,
      )
    },
  }
}

export type ScopedCollection = ReturnType<typeof scoped>

/** Apply the same filter/stamp/encryption rules to one operation inside a bulkWrite. */
function scopeBulkOp(
  op: AnyBulkWriteOperation<Doc>,
  own: (filter?: Filter<Doc>) => Filter<Doc>,
  stamp: (doc: Doc) => Doc,
  encUpdateFn: (update: Doc) => Doc,
): AnyBulkWriteOperation<Doc> {
  if ('insertOne' in op) {
    return { insertOne: { document: stamp(op.insertOne.document as Doc) as never } }
  }
  if ('updateOne' in op) {
    return {
      updateOne: {
        ...op.updateOne,
        filter: own(op.updateOne.filter),
        update: encUpdateFn(op.updateOne.update as Doc) as never,
      },
    }
  }
  if ('updateMany' in op) {
    return {
      updateMany: {
        ...op.updateMany,
        filter: own(op.updateMany.filter),
        update: encUpdateFn(op.updateMany.update as Doc) as never,
      },
    }
  }
  if ('replaceOne' in op) {
    return {
      replaceOne: {
        ...op.replaceOne,
        filter: own(op.replaceOne.filter),
        replacement: stamp(op.replaceOne.replacement as Doc) as never,
      },
    }
  }
  if ('deleteOne' in op) {
    return { deleteOne: { ...op.deleteOne, filter: own(op.deleteOne.filter) } }
  }
  if ('deleteMany' in op) {
    return { deleteMany: { ...op.deleteMany, filter: own(op.deleteMany.filter) } }
  }
  return op
}
