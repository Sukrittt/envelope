export type Status = 'green' | 'amber' | 'red'
export type RiskSeverity = 'low' | 'med' | 'high' | 'critical'

export interface Kpi {
  label: string
  value: string
  tone?: Status
}

export interface DepartmentCard {
  id: string
  name: string
  lead: string
  status: Status
  lastUpdate: string
  activeInitiatives: number
  openRisks: number
}

export interface DailyUpdate {
  departmentId: string
  departmentName: string
  status: Status
  done: string[]
  changed: string[]
  next: string[]
  risk: string[]
  updatedAt: string
}

export interface LearningItem {
  id: string
  departmentName: string
  title: string
  note: string
  tags: string[]
  author: string
  time: string
  importance: 'normal' | 'high'
}

export interface RiskItem {
  id: string
  title: string
  severity: RiskSeverity
  owner: string
  departmentName: string
  mitigation: string
  dueDate: string
  state: 'open' | 'monitoring' | 'mitigated' | 'closed'
}

export interface ActivityItem {
  id: string
  title: string
  detail: string
  departmentName: string
  timestamp: string
  type: 'update' | 'risk' | 'learning'
}

export interface ExternalModuleLink {
  label: string
  url: string
}

export interface ExternalModuleSummary {
  module: 'expense' | 'fitness'
  title: string
  health: Status
  lastSync: string
  primaryMetric: string
  secondaryMetric: string
  deepLinks: ExternalModuleLink[]
  notes: string
}

export interface DepartmentSyncStatus {
  department: 'Engineering' | 'UI/UX' | 'Fitness' | 'Ops'
  owner: string
  status: Status
  updatedAt: string
  block: string
  next: string
}

export interface DashboardData {
  dateLabel: string
  overallHealth: Status
  kpis: Kpi[]
  departments: DepartmentCard[]
  dailyUpdates: DailyUpdate[]
  learnings: LearningItem[]
  risks: RiskItem[]
  activities: ActivityItem[]
  externalModules: ExternalModuleSummary[]
  crossDepartmentSync: DepartmentSyncStatus[]
}
