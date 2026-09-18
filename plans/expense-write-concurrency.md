# Expense write concurrency

Implemented in the expense API and the web/mobile transaction clients.

## Contract

- GET expenses (both full and paginated) returns a numeric `version` alongside `id`. CSV exports keep their original columns.
- Existing records without a stored version read as version 0; new creates start at 0. No backfill is needed.
- PUT and DELETE require `id` and the `version` loaded by the client. Missing version returns 428; invalid ID/version returns 400.
- A stale version returns 409 with an error and the latest `current` row. An already-deleted row returns 404. Neither response changes the expense or envelope.
- Successful edits increment the version. Soft deletes advance it too, so restoring a record does not revive an old editor. Category renames advance affected expense versions.
- Reads, version checks, conditional writes and credit-card calculations all run inside the same Mongo transaction. Driver retries reread the expense. A conditional write miss throws inside the transaction.

## Clients

Both editors retain the loaded version and send only changed fields. A 409 preserves the draft and shows the latest saved values alongside it. “Reload latest” adopts the server values. “Keep my changes” rebases only the user's changes onto that snapshot. Both actions require another explicit save, checked against the reviewed version; another concurrent change produces another conflict.

Deleted-elsewhere errors preserve the editor draft and disable saving. Delete conflicts refresh the list and require a fresh confirmation. Mobile create responses carry the creation version through to Undo. A replay also returns version 0, so Undo cannot delete a subsequent edit the user never reviewed.

## Release

Coordinate the backend/web release with the mobile update. Older mobile clients and already-open old web editors do not send versions and will receive 428 on edits/deletes after this backend is deployed. They must update/reload; do not add a versionless fallback, since that reintroduces lost updates. Reads and new expense creation remain available. This change does not deploy itself or force an app-store update.

Existing envelope discrepancies are not repaired by this change. It prevents these races for future writes.

## Verification

`npm test -- app/api/expenses/concurrency.test.ts` starts an isolated local Mongo replica set through mongodb-memory-server, with real scoped/encrypted collections, transactions and unique indexes. It never uses production data. The first run may download a Mongo binary.

The tests schedule competing reads before writes and check edit/edit, edit/delete, delete/delete, rejected conditional writes, existing unversioned records, category renames and delete/restore versions. Client tests cover draft preservation, changed-field rebasing, deleted records and version propagation.
