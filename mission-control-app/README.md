# Mission Control App — Master Dashboard Foundation

React + Vite + TypeScript app that now acts as a **unified master dashboard shell** across:

- Overview
- Expense Dashboard
- Fitness Dashboard
- Mission Control

## What shipped in this run

### 1) Top-level dashboard switcher
Implemented a persistent, keyboard-accessible top navigation using route-based tabs:

- `/overview`
- `/expense`
- `/fitness`
- `/mission-control`

Navigation uses native anchors (`NavLink`) with visible focus styles for keyboard users.

### 2) Integrated expense + fitness modules
Added typed `externalModules` data model and in-app module cards with:

- health/status pill
- last sync timestamp
- primary + secondary summary metrics
- deep links to external apps/data sources

This gives one in-app summary while still allowing deep-link drill-down.

### 3) Cross-department sync panel (typed)
Added typed `crossDepartmentSync` model and rendered status blocks for:

- Engineering
- UI/UX
- Fitness
- Ops

Each block includes owner, status, updated time, current block, and next action.

### 4) Responsive + accessible UI baseline
- Responsive grids for mobile/tablet/desktop
- Focus-visible styles on nav, links, and expandable summaries
- Wrap-friendly top nav for smaller breakpoints

### 5) Validation
Run and verify:

```bash
npm install
npm run lint
npm run build
```

## Architecture (current)

```text
src/
  App.tsx                    # Route shell + overview/expense/fitness/mission-control pages
  App.css                    # Shared responsive styles + a11y focus styles
  data/mockData.json         # Mock payload including externalModules + crossDepartmentSync
  services/dashboardService.ts # Data source switch (mock vs API)
  types.ts                   # Typed contracts for dashboard and sync/module bindings
```

## Data binding extension guide

### A) Connect to real API
`src/services/dashboardService.ts` already supports backend mode via:

- `VITE_API_BASE_URL`

When set, app fetches:

- `${VITE_API_BASE_URL}/mission-control/dashboard`

Ensure API response includes all `DashboardData` fields from `src/types.ts`.

### B) Add/modify external module cards
Update `externalModules` in payload:

```ts
interface ExternalModuleSummary {
  module: 'expense' | 'fitness'
  title: string
  health: 'green' | 'amber' | 'red'
  lastSync: string
  primaryMetric: string
  secondaryMetric: string
  deepLinks: { label: string; url: string }[]
  notes: string
}
```

To add another module, extend the `module` union type and map it to a route/page.

### C) Extend cross-department sync blocks
Update `crossDepartmentSync` in payload:

```ts
interface DepartmentSyncStatus {
  department: 'Engineering' | 'UI/UX' | 'Fitness' | 'Ops'
  owner: string
  status: 'green' | 'amber' | 'red'
  updatedAt: string
  block: string
  next: string
}
```

To onboard another department, extend the `department` union and add entries in the payload.

## Deploy/Release checklist

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. Validate routes load correctly (`/overview`, `/expense`, `/fitness`, `/mission-control`)
5. Verify deep links open expected external targets
6. Verify keyboard-only navigation (Tab + Enter)
7. Deploy `dist/` to hosting target
