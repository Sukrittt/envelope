export interface NavItem {
  label: string
  path: string
  exact?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Mission',
    items: [
      { label: 'Overview', path: '/', exact: true },
      { label: 'Departments', path: '/departments' },
      { label: 'Risks', path: '/risks' },
      { label: 'Learnings', path: '/learnings' },
      { label: 'Activity', path: '/activity' },
    ],
  },
  {
    label: 'Master Dashboard',
    items: [
      { label: 'Expense', path: '/expense' },
      { label: 'Fitness', path: '/fitness' },
      { label: 'Integrations', path: '/integrations' },
    ],
  },
  {
    label: 'Admin',
    items: [{ label: 'Settings', path: '/settings' }],
  },
]
