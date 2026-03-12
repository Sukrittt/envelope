# FITNESS_DASHBOARD_SPEC

## Purpose
Single-page operational dashboard for Sukrit’s fat-loss phase (target: **58 kg**) with daily logging + weekly coaching review.

## Core Modules
1. **Nutrition**
   - Daily calories vs target range
   - Protein intake
   - Meal compliance (yes/no)
2. **Workouts**
   - Session done (yes/no)
   - Split type (Push/Pull/Legs/Rest/Cardio)
   - Training effort (RPE)
3. **PR Tracker**
   - Lift/exercise
   - New best (weight/reps/volume)
   - Date + notes
4. **Bodyweight Trend**
   - Daily morning weight
   - 7-day moving average
   - Weekly change (kg)
5. **Goal Progress**
   - Start weight, current weight, target weight
   - Total lost
   - Remaining to goal
   - Estimated pace check (on-track / off-track)

## Daily Minimal Inputs (Required)
- Date
- Morning bodyweight (kg)
- Calories (kcal)
- Protein (g)
- Workout status (Done/Rest)
- Steps (count)
- Sleep duration (hours)

## Dashboard KPIs (Auto-computed)
- 7-day avg weight
- Weekly weight delta
- Avg calories (7-day)
- Avg protein (7-day)
- Workout adherence (% of planned sessions)
- Step adherence (% days >= 8k)

## Weekly Coaching Output (Standard Format)
```text
WEEKLY CHECK-IN (Week of YYYY-MM-DD)
1) Outcome
- Weight: start X -> end Y (Δ Z kg), 7d avg trend: ...
- Adherence: nutrition __%, workouts __%, steps __%

2) What Worked
- ...

3) Friction / Misses
- ...

4) Coaching Adjustments (next 7 days)
- Calories: keep / adjust by ±100–150 kcal max
- Protein: target __ g/day
- Training: keep split / deload / add 1 light cardio block
- Recovery: sleep + hydration focus

5) Next Week Targets
- Scale trend target: __ kg/week
- Process targets: calories __/7 days, protein __/7 days, workouts __/__, steps __/7

6) Risk Flags
- Energy crash / poor sleep / persistent soreness / binge signals
```

## Suggestion Policy (Mandatory)
- Safe, evidence-based, sustainable.
- No extreme cuts, starvation diets, dehydration tricks, or reckless overtraining.
- Deficit adjustments only in small steps (typically 100–150 kcal).
- Prioritize protein, training quality, sleep, and consistency over aggressive scale drops.
- If warning signs appear (dizziness, persistent fatigue, sharp performance drop), reduce load and recover first.

## Cadence
- **Daily:** log minimal inputs + 1-line learning update.
- **Weekly:** run coaching output format and set next-week targets.

## Dashboard Integration Artifacts (v1.0)
- Canonical contract doc: `FITNESS_DASHBOARD_DATA_CONTRACT.md`
- JSON Schema: `fitness-dashboard.schema.json`
- Sample populated payload: `fitness-dashboard.sample.json`
- KPI formulas: `FITNESS_KPI_DEFINITIONS.md`
- Engineering handoff: `JOE_INTEGRATION_NOTE.md`
