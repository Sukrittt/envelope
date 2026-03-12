# Fitness Dashboard Data Contract (v1.1)

Canonical source payload for the fitness section in Mission Control.

## Canonical files
- Schema: `fitness-dashboard.schema.json`
- Sample payload: `fitness-dashboard.sample.json`

## Root object
| Field | Type | Required | Notes |
|---|---|---:|---|
| `meta` | object | yes | versioning + generation context |
| `athleteProfile` | object | yes | static + latest bodyweight context |
| `targets` | object | yes | weekly process targets |
| `dailyLogs` | array | yes | daily raw facts (minimum 21 rows) |
| `kpis` | object | yes | top-line KPI strip |
| `summaries` | object | yes | card-ready summary blocks |
| `chartSeries` | object | yes | chart-ready date/value series |
| `edgeCaseHandling` | string[] | yes | renderer/data safety notes |

## Required summary blocks (card-ready)
- `summaries.adherence`
  - `weekPct`, `monthPct`
  - `weekChecksPassed`, `weekChecksTotal`
  - `monthChecksPassed`, `monthChecksTotal`
- `summaries.weightTrend`
  - `trend7dKgPerWeek`, `trend14dKgPerWeek`, `direction`
- `summaries.protein`
  - `targetG`, `avg7dG`, `avg21dG`, `daysMet7d`, `daysMet21d`, `consistencyBand`
- `summaries.steps`
  - `targetMin`, `avg7d`, `avg21d`, `targetAttainment7dPct`, `targetAttainment21dPct`
- `summaries.training`
  - `plannedSessionsWeek`, `completedSessionsWeek`, `extraSessionsWeek`, `completionPctWeek`
  - `splitByType.push`, `splitByType.pull`, `splitByType.legs`

## Chart payload
All chart series are pre-normalized arrays of `{ date: YYYY-MM-DD, value: number|null }`.

- `chartSeries.weightDaily21d`
- `chartSeries.weightMovingAvg7d`
- `chartSeries.proteinDaily21d`
- `chartSeries.stepsDaily21d`
- `chartSeries.adherenceDaily21d`

## KPI fields
- `weightTrendKgPerWeek`
- `adherencePct`
- `avgProteinG`
- `avgSteps`
- `trainingCompletionPct`

Detailed formulas: `FITNESS_KPI_DEFINITIONS.md`

## Nullability + edge behavior
- Use `null` when a derived metric is not computable (never fake zero).
- Keep units explicit in field names (`Kg`, `Kcal`, `Pct`, `G`).
- Date format must stay ISO (`YYYY-MM-DD`) for deterministic sort.
- Keep sparse data sparse; do not backfill missing days with zeroes.
