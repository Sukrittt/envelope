import type {
  AnyBulkWriteOperation,
  BulkWriteOptions,
  BulkWriteResult,
  Collection,
  CountDocumentsOptions,
  DeleteOptions,
  DeleteResult,
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

type Doc = Record<string, unknown>

/**
 * Ownership-scoped view of a Mongo collection.
 *
 * Every filter gets `user_id` merged in and every inserted document gets it
 * stamped on, so a handler cannot read or write another user's documents even
 * if it forgets to think about tenancy. The check lives here instead of in the
 * ~50 `getCollection` call sites that would each otherwise have to remember it.
 *
 * Method signatures mirror the driver's, so existing handler code (including
 * `.find(...).sort(...).limit(...).toArray()` chains) works unchanged.
 *
 * Upserts need no special handling: Mongo copies equality conditions from the
 * filter into the document it creates, and `user_id` is always one of them.
 *
 * ponytail: enforcement is application-side, not row-level security in the
 * database — a raw `db.collection(...)` handle still sees every user's rows.
 * Move to per-user databases only if that ever stops being acceptable.
 */
export function scoped(coll: Collection<Doc>, userId: string) {
  const own = (filter: Filter<Doc> = {}): Filter<Doc> => ({ ...filter, user_id: userId })
  const stamp = (doc: Doc): Doc => ({ ...doc, user_id: userId })

  return {
    /** The user this view is scoped to. */
    userId,

    find(filter: Filter<Doc> = {}, options?: FindOptions): FindCursor<WithId<Doc>> {
      return coll.find(own(filter), options)
    },

    findOne(filter: Filter<Doc> = {}, options?: FindOptions): Promise<WithId<Doc> | null> {
      return coll.findOne(own(filter), options)
    },

    countDocuments(filter: Filter<Doc> = {}, options?: CountDocumentsOptions): Promise<number> {
      return coll.countDocuments(own(filter), options)
    },

    distinct(key: string, filter: Filter<Doc> = {}): Promise<unknown[]> {
      return coll.distinct(key, own(filter))
    },

    /** Aggregation with an ownership `$match` forced as the first stage. */
    aggregate<T extends Doc = Doc>(pipeline: Doc[] = []) {
      return coll.aggregate<T>([{ $match: { user_id: userId } }, ...pipeline])
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
      return coll.updateOne(own(filter), update, options)
    },

    updateMany(
      filter: Filter<Doc>,
      update: UpdateFilter<Doc>,
      options?: UpdateOptions,
    ): Promise<UpdateResult<Doc>> {
      return coll.updateMany(own(filter), update, options)
    },

    replaceOne(
      filter: Filter<Doc>,
      replacement: Doc,
      options?: ReplaceOptions,
    ): Promise<UpdateResult<Doc>> {
      return coll.replaceOne(own(filter), stamp(replacement), options) as Promise<UpdateResult<Doc>>
    },

    deleteOne(filter: Filter<Doc>, options?: DeleteOptions): Promise<DeleteResult> {
      return coll.deleteOne(own(filter), options)
    },

    deleteMany(filter: Filter<Doc>, options?: DeleteOptions): Promise<DeleteResult> {
      return coll.deleteMany(own(filter), options)
    },

    bulkWrite(
      ops: AnyBulkWriteOperation<Doc>[],
      options?: BulkWriteOptions,
    ): Promise<BulkWriteResult> {
      return coll.bulkWrite(ops.map((op) => scopeBulkOp(op, own, stamp)), options)
    },
  }
}

export type ScopedCollection = ReturnType<typeof scoped>

/** Apply the same filter/stamp rules to one operation inside a bulkWrite. */
function scopeBulkOp(
  op: AnyBulkWriteOperation<Doc>,
  own: (filter?: Filter<Doc>) => Filter<Doc>,
  stamp: (doc: Doc) => Doc,
): AnyBulkWriteOperation<Doc> {
  if ('insertOne' in op) {
    return { insertOne: { document: stamp(op.insertOne.document as Doc) as never } }
  }
  if ('updateOne' in op) {
    return { updateOne: { ...op.updateOne, filter: own(op.updateOne.filter) } }
  }
  if ('updateMany' in op) {
    return { updateMany: { ...op.updateMany, filter: own(op.updateMany.filter) } }
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
