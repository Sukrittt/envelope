# Mission Control App

React + Vite + TypeScript operations dashboard.

## What was added in this update

### 1) Route-based pages
Implemented app routing with `react-router-dom`:
- `/` → Dashboard
- `/departments/:id` → Department detail page
- `/risks` → Full risk register page
- `/learnings` → Learning feed page

### 2) Filtering controls
Implemented practical filters on dedicated pages:
- Risks page:
  - Severity filter (`critical/high/med/low`)
  - Department filter
- Learnings page:
  - Department filter
  - Tag filter

### 3) Loading / empty / error states
Added clearer states:
- App-level loading state while fetching data
- Error state with actionable guidance when fetch fails
- Empty-state fallbacks for filtered results and department sub-panels

### 4) Data service robustness
`dashboardService.ts` now includes typed normalization and safe defaults:
- Validates/normalizes incoming payload shape
- Prevents crashes from malformed API data
- Provides sane fallback values for missing fields

### 5) Usability and accessibility polish
- Focus-visible styles for links, selects, and summary controls
- Better mobile spacing/layout collapse on smaller screens
- Improved keyboard navigation affordances via visible focus rings

---

## Local setup

```bash
cd /root/.openclaw/workspace/mission-control-app
npm install
```

## Run locally

```bash
npm run dev
```

Open the Vite URL shown in terminal (typically `http://localhost:5173`).

## Quality checks

```bash
npm run lint
npm run build
```

Both should pass before pushing.

## Environment notes

By default, app reads `src/data/mockData.json`.
If `VITE_API_BASE_URL` is set, app calls:

`{VITE_API_BASE_URL}/mission-control/dashboard`

Response is normalized defensively before rendering.
