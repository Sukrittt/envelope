export type SplitType = 'push' | 'pull' | 'legs' | 'rest'

export interface FitnessDailyLog {
  date: string
  morningWeightKg: number
  caloriesKcal: number | null
  proteinG: number | null
  steps: number | null
  sleepHours: number | null
  hydrationL: number | null
  workout: {
    status: 'done' | 'rest' | 'missed' | string
    type: SplitType | string
    topSet?: string
    rpe?: number
    completed?: boolean
  }
  adherence: { calorieInRange: boolean; proteinMet: boolean; stepsMet: boolean }
  notes?: string
}

export interface FitnessDashboardContract {
  meta: { generatedAt: string; weekStart: string; version: string }
  athleteProfile: {
    name: string
    startWeightKg: number
    currentWeightKg: number
    targetWeightKg: number
  }
  targets: {
    calorieRange: { min: number; max: number }
    proteinG: number
    stepsMin: number
    plannedTrainingSessions: number
  }
  dailyLogs: FitnessDailyLog[]
  kpis: {
    weightTrendKgPerWeek: number
    adherencePct: number
    avgProteinG: number
    avgSteps: number
    trainingCompletionPct: number
  }
  summaries: {
    adherence: {
      weekPct: number
      monthPct: number
      weekChecksPassed: number
      weekChecksTotal: number
    }
    weightTrend: {
      trend7dKgPerWeek: number
      trend14dKgPerWeek: number
      direction: string
    }
    protein: {
      targetG: number
      avg7dG: number
      avg21dG: number
      daysMet7d: number
      consistencyBand: string
    }
    steps: {
      targetMin: number
      avg7d: number
      avg21d: number
      targetAttainment7dPct: number
    }
    training: {
      plannedSessionsWeek: number
      completedSessionsWeek: number
      completionPctWeek: number
      splitByType: Record<SplitType, number>
    }
  }
  chartSeries: {
    weightDaily21d: Array<{ date: string; value: number }>
    weightMovingAvg7d: Array<{ date: string; value: number }>
    proteinDaily21d: Array<{ date: string; value: number }>
    stepsDaily21d: Array<{ date: string; value: number }>
    adherenceDaily21d: Array<{ date: string; value: number }>
  }
  foodLog: Array<{
    date: string
    mealType: string
    items: string
    caloriesKcal: number | null
    proteinG: number | null
    loggedAt?: string
  }>
  prList: Array<{
    date: string
    lift: string
    prType: string
    value: number
    unit: string
    bodyWeightKg: number
    notes: string
  }>
  pplRoutines: Array<{
    routineName: string
    dayType: string
    exerciseOrder: number
    exercise: string
    sets: number
    reps: string
    targetRir: number
    restSec: number
    notes: string
  }>
  weightTrajectory: Array<{
    date: string
    weightKg: number
    trendKg: number
    bodyFatPct: number | null
    waistCm: number | null
    notes: string
  }>
}

export interface WorkoutLog {
  date: string
  type: string
  topSet: string | null
  rpe: number | null
  completed: boolean
  notes: string | null
}

export interface ExercisePR {
  exercise: string
  weight: number
  reps: number
  unit: string
  split: string
  lastUpdated: string
}

export interface FitnessDashboardPanel {
  lastUpdated: string
  athleteName: string
  currentWeightKg: number
  startWeightKg: number
  targetWeightKg: number
  remainingKg: number
  adherencePct: number
  trainingCompletionPct: number
  avgProteinG: number
  proteinTargetG: number
  caloriesBand: { min: number; max: number }
  workoutStreakDays: number
  weightSeries: Array<{ date: string; value: number }>
  weightTrend7d: number
  weightTrend14d: number
  proteinSeries: Array<{ date: string; value: number }>
  nutritionCompliance: {
    hitDays7d: number
    missDays7d: number
    proteinConsistencyBand: string
  }
  trainingDetail: {
    splitCounts7d: Record<SplitType, number>
    plannedSessions: number
    completedSessions: number
  }
  summaryCards: {
    adherenceWeekPct: number
    adherenceMonthPct: number
    proteinAvg7d: number
    proteinDaysMet7d: number
  }
  dailyInsight: {
    date: string
    action: string
    reason: string
  }
  workoutLogs: WorkoutLog[]
  exercisePRs: ExercisePR[]
  foodLog: Array<{
    date: string
    mealType: string
    items: string
    loggedAt?: string
  }>
}


export function toFitnessDashboardPanel(input: FitnessDashboardContract): FitnessDashboardPanel {
  const sortedLogs = [...input.dailyLogs].sort((a, b) => a.date.localeCompare(b.date))
  const recent7 = sortedLogs.slice(-7)

  let streak = 0
  for (let index = recent7.length - 1; index >= 0; index -= 1) {
    if (recent7[index]?.workout.completed) {
      streak += 1
      continue
    }
    break
  }

  const splitCounts7d: Record<SplitType, number> = { push: 0, pull: 0, legs: 0, rest: 0 }
  for (const row of recent7) {
    const split = row.workout.type as SplitType
    if (split in splitCounts7d) splitCounts7d[split] += 1
  }

  const hitDays7d = recent7.filter((row) => row.adherence?.calorieInRange).length
  const avgProtein7d = recent7.reduce((sum, row) => sum + (row.proteinG ?? 0), 0) / recent7.filter((row) => row.proteinG !== null).length

  const workoutLogs: WorkoutLog[] = sortedLogs
    .filter((log) => log.workout.status === 'done')
    .map((log) => ({
      date: log.date,
      type: log.workout.type,
      topSet: log.workout.topSet ?? null,
      rpe: log.workout.rpe ?? null,
      completed: log.workout.completed ?? false,
      notes: log.notes ?? null,
    }))
    .reverse()

  const exercisePRs: ExercisePR[] = []

  if (input.prList) {
    for (const pr of input.prList) {
      const raw = pr as Record<string, unknown>
      const name = pr.lift.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      exercisePRs.push({
        exercise: name,
        weight: pr.value,
        reps: raw.reps as number ?? 1,
        unit: raw.unit as string ?? 'kg',
        split: raw.split as string ?? '',
        lastUpdated: raw.lastUpdated as string ?? '',
      })
    }
  }

  const weightSeries = (input.chartSeries?.weightDaily21d?.length
    ? input.chartSeries.weightDaily21d
    : sortedLogs
        .filter((log) => log.morningWeightKg !== null)
        .map((log) => ({
          date: log.date,
          value: log.morningWeightKg,
        })))

  const proteinSeries = sortedLogs
    .filter((log) => log.proteinG !== null)
    .map((log) => ({
      date: log.date,
      value: log.proteinG as number,
    }))

  const trend7d = weightSeries.slice(-7)
  const trend14d = weightSeries.slice(-14)
  const weightTrend7d = trend7d.length >= 2
    ? Number((((trend7d[trend7d.length - 1].value - trend7d[0].value) / Math.max(trend7d.length - 1, 1)) * 7).toFixed(2))
    : 0
  const weightTrend14d = trend14d.length >= 2
    ? Number((((trend14d[trend14d.length - 1].value - trend14d[0].value) / Math.max(trend14d.length - 1, 1)) * 7).toFixed(2))
    : 0

  return {
    lastUpdated: input.meta.generatedAt,
    athleteName: input.athleteProfile.name,
    currentWeightKg: input.athleteProfile.currentWeightKg,
    startWeightKg: input.athleteProfile.startWeightKg,
    targetWeightKg: input.athleteProfile.targetWeightKg,
    remainingKg: Number((input.athleteProfile.currentWeightKg - input.athleteProfile.targetWeightKg).toFixed(1)),
    adherencePct: input.kpis.adherencePct,
    trainingCompletionPct: input.kpis.trainingCompletionPct,
    avgProteinG: Number(avgProtein7d.toFixed(1)),
    proteinTargetG: input.targets.proteinG,
    caloriesBand: input.targets.calorieRange,
    workoutStreakDays: streak,
    weightSeries,
    weightTrend7d,
    weightTrend14d,
    proteinSeries,
    nutritionCompliance: {
      hitDays7d,
      missDays7d: recent7.length - hitDays7d,
      proteinConsistencyBand: input.summaries.protein.consistencyBand,
    },
    trainingDetail: {
      splitCounts7d,
      plannedSessions: input.summaries.training.plannedSessionsWeek,
      completedSessions: input.summaries.training.completedSessionsWeek,
    },
    summaryCards: {
      adherenceWeekPct: input.summaries.adherence.weekPct,
      adherenceMonthPct: input.summaries.adherence.monthPct,
      proteinAvg7d: input.summaries.protein.avg7dG,
      proteinDaysMet7d: input.summaries.protein.daysMet7d,
    },
    dailyInsight: {
      date: recent7[recent7.length - 1]?.date ?? input.meta.weekStart,
      action: recent7[recent7.length - 1]?.workout.status === 'done'
        ? `Great job on ${recent7[recent7.length - 1]?.workout.type} day!`
        : 'Keep pushing towards your goals!',
      reason: `${input.summaries.training.completedSessionsWeek}/${input.summaries.training.plannedSessionsWeek} sessions completed this week`,
    },
    workoutLogs,
    exercisePRs,
    foodLog: input.foodLog.map((f) => ({
      date: f.date,
      mealType: f.mealType,
      items: f.items,
      loggedAt: f.loggedAt,
    })),
  }
}
