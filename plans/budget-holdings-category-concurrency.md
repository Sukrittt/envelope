# Budget, holdings and category write concurrency

Follow-up to `plans/expense-write-concurrency.md`. That plan covers expenses only. This one covers the three other places where concurrent writes can lose data or leave it inconsistent. Everything else (groups, subscriptions, recurring expenses, group/category move) is low-frequency and low-stakes, and is deliberately out of scope.

Status: parts 3 and 4 implemented; parts 1 and 2 proposed. Not verified: client behavior for budgets/holdings editors and the notification cron's interaction with these rows. Check both before starting.

## Problem

| Area | Today | Failure |
| --- | --- | --- |
| Budget `assigned` (`app/api/budgets/route.ts`, PUT) | Blind upsert by `(month, category)` | Two devices editing the same envelope silently overwrite each other |
| Holdings PUT (`app/api/holdings/route.ts`) | `findOne` then blind `updateOne` by name | Stale read; `value` is overwritten without the editor having seen the latest |
| Category rename (`app/api/categories/route.ts`) and reorder (`app/api/categories/move/route.ts`) | Several sequential writes, no transaction | A crash or concurrent write partway leaves budgets, expenses and categories with different names, or duplicate `order` values | (done)

## 1. Budget `assigned`: versioned edits

Same optimistic model as expenses: per-row integer `version`, client sends the version it loaded, stale version returns 409 with the latest row.

- GET budgets returns `version` per row. Rows without a stored version read as 0; no backfill.
- PUT requires `version`. Missing returns 428, invalid returns 400, stale returns 409 with `current`.
- The read, version check and conditional write run in one `withTx`, with the version in the update filter (`{ month, category, version }`), exactly as `app/api/expenses/route.ts` does. Throw inside the transaction on a miss.
- Successful edits `$inc` the version.
- Every server-side writer of `assigned`/`rolled_over` must also bump the version, otherwise a client edit can pass the check after a server-side change it never saw. Known writers: `lib/createExpense.ts` (`casRetry` on the envelope) and `app/api/budgets/transfer/route.ts`. Grep for others before implementing.
- Open question: the current PUT upserts when the envelope has no row yet. A conditional write against a missing row needs a unique index on `(month, category)` and a defined "version 0 / row absent" contract so two concurrent first-writes don't both insert. Decide before implementing. Also confirm `budgets` fields aren't in the encrypted set, since `lib/scoped.ts` rejects `$inc` on encrypted fields.

## 2. Holdings PUT: versioned edits

Same contract as budgets, keyed by holding.

- GET holdings returns `version`; PUT requires it; 428/400/409 as above.
- Move the `findOne` and `updateOne` into one `withTx` and reread inside the callback so retries see fresh state.
- `applyHoldingAction` (`lib/holdings.ts`, already in `withTx`) and any other writer of `value` must bump the version. Decide whether the notification cron's `recurring_last_run` update (`app/api/notifications/run/route.ts`) bumps it: it is bookkeeping, not a user-visible edit, so probably not, but that means it must not be a field an editor can overwrite.
- Rename changes the lookup key (`name`). Keep the version check keyed on the loaded name and make sure a rename racing an edit fails cleanly rather than 404ing ambiguously.

## 3. Category rename and reorder: transactions only — done

No version and no client work; mobile and web were both unaffected. This is atomicity, not stale-edit detection.

- Rename: the category `updateOne`, the budgets `updateMany` and the expenses `updateMany` run in one `withTx`. `alertPcts` validation moved ahead of the transaction so a bad threshold list cannot roll back an otherwise-fine rename.
- Reorder: `app/api/categories/reorder/route.ts` had no callers — both clients reorder through `/api/categories/move` — so it was deleted rather than transactioned. `move` now reads the group and runs its renumbering `bulkWrite` in one `withTx`.
- Rename and create both map Mongo's duplicate-key error to the 409 the clients already render: the `findOne` pre-check loses to a concurrent write, and the unique `(user_id, name)` index is what actually decides.
- The callbacks are pure DB writes. They can rerun on a transient error, so cache invalidation happens after they resolve (see `lib/mongodb.ts`).
- Verified by `app/api/categories/concurrency.test.ts`.

## 4. Stale category references — done

Categories are keyed by their own mutable `name`, so versioning the row would not have helped here: a client holding a category list from before a rename is not editing the category, it is *referencing* it. Writing the old name through orphaned the row — it showed under a category in no group and counted against no envelope.

- The rename cascade now covers every collection that stores a category name. It previously reached only `budgets` and `expenses`, which meant a rename silently broke `recurring_expenses` (the nightly cron kept logging under the dead name), `bill_scans` and `category_map_overrides`. All five run in the same `withTx`.
- Rename `$push`es the old name onto the category's `previousNames`. `lib/categoryName.ts::resolveCategoryName` maps a name forward through it, preferring a live category so a recreated name is never redirected. No index needed — a user has tens of categories.
- Resolution runs on the three writes that take a category name from a client: `lib/createExpense.ts` (also covers the offline flush and the recurring cron), `app/api/budgets/route.ts` PUT (which otherwise upserted a ghost envelope and lost the assignment), and `app/api/expenses/route.ts` PUT (recategorize).
- Rejecting these writes with a 409 was the alternative. It was dropped because a mobile expense logged offline and flushed after a rename would be refused — the user loses a transaction they already recorded.
- Known ceiling: resolution runs inside the writer's transaction, so a rename committing between that read and the insert can still orphan one row. The window is the commit gap, not the minutes-long stale-list case. Re-keying categories to `_id` is the real fix and is not done.
- Category DELETE still has no cascade at all: expenses, budgets and recurring rows keep pointing at a deleted category. Open.

## Release

- Parts 1 and 2 add required versions to PUT. Old mobile clients and already-open old web editors will get 428 on these edits, same as the expense rollout. Coordinate with the mobile update; do not add a versionless fallback. Per the project rule, concurrency work stays on `staging` until the mobile release.
- Part 3 is server-only and can ship independently.

## Client work (parts 1 and 2)

Reuse the expense conflict flow: keep the loaded version, send only changed fields, on 409 preserve the draft and show the latest values, offer "Reload latest" and "Keep my changes" (rebase onto the latest snapshot, then require another explicit save). Budget assigned edits are often inline/optimistic, so decide how a 409 surfaces there (revert plus toast versus the full review UI) before building.

## Verification

Test first (money/balance math and concurrency bugs are in the TDD list). Extend the pattern in `app/api/expenses/concurrency.test.ts`: isolated mongodb-memory-server replica set, competing reads scheduled before writes.

- Budgets: edit/edit stale version returns 409; server-side writer bumps version so a stale client edit is rejected; first-write race on an absent row produces one row.
- Holdings: edit/edit, edit vs `applyHoldingAction`, rename vs edit.
- Categories: force a failure between the steps and assert nothing changed (rollback); concurrent reorder produces no duplicate `order` values.
- Client tests for draft preservation and rebasing, as in the expense editors.

## Order of work

1. ~~Category rename/reorder transactions (smallest, no release coordination).~~ Done.
2. Budget `assigned` versioning (highest real-world conflict risk, money).
3. Holdings PUT versioning.
