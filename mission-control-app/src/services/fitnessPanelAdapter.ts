export interface FitnessContractDailyLog {
  date: string
  morningWeightKg: number
  steps: number
}

export interface FitnessContractPayload {
  meta: { generatedAt: string }
  athleteProfile: {
    currentWeightKg: number
    targetWeightKg: number
  }
  kpis: {
    weightTrendKgPerWeek: number
    adherencePct: number
    avgProteinG: number
    avgSteps: number
    trainingCompletionPct: number
  }
  dailyLogs: FitnessContractDailyLog[]
}

export interface FitnessPanelData {
  departmentId: 'fitness'
  departmentName: 'Fitness'
  lead: 'Arnold'
  lastUpdated: string
  hero: {
    currentWeightKg: number
    targetWeightKg: number
    remainingKg: number
  }
  kpis: {
    weightTrend: number
    adherence: number
    proteinAvg: number
    stepsAvg: number
    trainingCompletion: number
  }
  chart: {
    weightSeries: Array<{ date: string; value: number }>
    stepsSeries: Array<{ date: string; value: number }>
  }
}

/**
 * Converts canonical fitness contract payload to mission-control panel shape.
 */
export function toFitnessPanelData(input: FitnessContractPayload): FitnessPanelData {
  const trailing7 = [...input.dailyLogs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)

  return {
    departmentId: 'fitness',
    departmentName: 'Fitness',
    lead: 'Arnold',
    lastUpdated: input.meta.generatedAt,
    hero: {
      currentWeightKg: input.athleteProfile.currentWeightKg,
      targetWeightKg: input.athleteProfile.targetWeightKg,
      remainingKg: Number(
        (input.athleteProfile.currentWeightKg - input.athleteProfile.targetWeightKg).toFixed(1),
      ),
    },
    kpis: {
      weightTrend: input.kpis.weightTrendKgPerWeek,
      adherence: input.kpis.adherencePct,
      proteinAvg: input.kpis.avgProteinG,
      stepsAvg: input.kpis.avgSteps,
      trainingCompletion: input.kpis.trainingCompletionPct,
    },
    chart: {
      weightSeries: trailing7.map((d) => ({ date: d.date, value: d.morningWeightKg })),
      stepsSeries: trailing7.map((d) => ({ date: d.date, value: d.steps })),
    },
  }
}
