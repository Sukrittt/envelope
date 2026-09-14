import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// The `test` script sets NODE_OPTIONS=--no-experimental-webstorage: Node 25's
// own global `localStorage` (stable, on by default) otherwise wins over
// jsdom's and is missing `.clear()`, breaking every test that resets storage
// in beforeEach.

// vitest.config.ts leaves `globals` off, so @testing-library/react never
// registers its own auto-cleanup and rendered trees pile up across tests in a
// file — every query after the first then finds duplicates. Registering it
// here fixes that for every test file at once.
afterEach(cleanup)
