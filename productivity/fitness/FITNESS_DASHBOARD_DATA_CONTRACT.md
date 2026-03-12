# Fitness Dashboard Data Contract (v1.0)

This defines the source payload consumed by dashboard adapters and frontend panels.

## Canonical files
- Schema: `fitness-dashboard.schema.json`
- Sample payload: `fitness-dashboard.sample.json`

## Root object
| Field | Type | Required | Notes |
|---|---|---:|---|
| `meta` | object | yes | versioning + generation context |
| `athleteProfile` | object | yes | static + latest bodyweight context |
| `targets` | object | yes | current weekly process targets |
| `dailyLogs` | array | yes | daily raw facts (minimum 7 rows) |
| `kpis` | object | yes | precomputed KPIs for quick rendering |

## Minimal daily row fields
- `date` (`YYYY-MM-DD`)
- `morningWeightKg` (number)
- `caloriesKcal` (integer)
- `proteinG` (integer)
- `steps` (integer)
- `sleepHours` (number)
- `workout.status` (`done` | `rest`)
- `workout.type` (`push` | `pull` | `legs` | `cardio` | `rest`)

## KPI payload fields
- `weightTrendKgPerWeek`
- `adherencePct`
- `avgProteinG`
- `avgSteps`
- `trainingCompletionPct`

Detailed formulas: `FITNESS_KPI_DEFINITIONS.md`

## Nullability and edge behavior
- Use `null` for unavailable derived values; do not send fake zeroes.
- Keep numeric units explicit in field names (`Kg`, `Kcal`, `Pct`, `G`).
- Date format must remain ISO (`YYYY-MM-DD`) for deterministic sorting.
