# Budget, holdings and category write concurrency

Follow-up to `plans/expense-write-concurrency.md`. That plan covers expenses only. This one covers the three other places where concurrent writes can lose data or leave it inconsistent. Everything else (groups, subscriptions, recurring expenses, group/category move) is low-frequency and low-stakes, and is deliberately out of scope.

Status: proposed, not implemented. Not verified: client behavior for budgets/holdings editors and the notification cron's interaction with these rows. Check both before starting.

## Problem

| Area | Today | Failure |
| --- | --- | --- |
| Budget `assigned` (`app/api/budgets/route.ts`, PUT) | Blind upsert by `(month, category)` | Two devices editing the same envelope silently overwrite each other |
| Holdings PUT (`app/api/holdings/route.ts`) | `findOne` then blind `updateOne` by name | Stale read; `value` is overwritten without the editor having seen the latest |
| Category rename (`app/api/categories/route.ts`) and reorder (`app/api/categories/reorder/route.ts`) | Several sequential writes, no transaction | A crash or concurrent write partway leaves budgets, expenses and categories with different names, or duplicate `order` values |

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

## 3. Category rename and reorder: transactions only

No version and no client work. This is atomicity, not stale-edit detection.

- Rename: wrap the category `updateOne`, the budgets `updateMany` and the expenses `updateMany` (already `$inc`s expense versions) in one `withTx`, passing `{ session }` to each.
- Reorder: wrap the two swapping `updateOne` calls in one `withTx`.
- Keep the callback to pure DB writes. It can rerun on a transient error, so cache invalidation and notifications go after it resolves (see `lib/mongodb.ts`).

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

1. Category rename/reorder transactions (smallest, no release coordination).
2. Budget `assigned` versioning (highest real-world conflict risk, money).
3. Holdings PUT versioning.
