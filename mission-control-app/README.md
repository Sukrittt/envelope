# Mission Control App

React + Vite + TypeScript app focused on daily operations visibility across departments.

## What shipped in this run

### 1) Route-driven app structure
Added route navigation with active state support:

- `/` → Dashboard
- `/departments` → Department overview
- `/departments/:departmentId` → Department drill-down
- `/risks` → Risk register
- `/learnings` → Learning feed

### 2) Centralized data loading + retry behavior
Introduced `DashboardProvider` context to handle fetch/load states app-wide:

- loading state panel
- error state panel
- retry button wired to reload the dashboard

### 3) High-value operations UX
Implemented end-to-end workflow upgrades:

- Department drill-down page with full Done/Changed/Next/Risk details
- Risk register filtering (severity + department)
- Learning feed filtering (department + tag)
- Activity Timeline panel on dashboard for latest cross-team signals

## Validation

```bash
cd /root/.openclaw/workspace/mission-control-app
npm install
npm run lint
npm run build
```

## Local development

```bash
npm run dev
```

## Data source configuration

By default, app reads from `src/data/mockData.json`.

For API mode, set:

```bash
VITE_API_BASE_URL=https://your-api.example.com
```

The app will fetch:

```text
GET {VITE_API_BASE_URL}/mission-control/dashboard
```

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
cd /root/.openclaw/workspace/mission-control-app
vercel
vercel --prod
```

### Option B: Vercel dashboard settings

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Root directory: `mission-control-app` (if deploying from workspace root)
- Env vars: set `VITE_API_BASE_URL` if using backend mode
