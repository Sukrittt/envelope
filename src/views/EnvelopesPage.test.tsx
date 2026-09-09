import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { EnvelopesPage } from './EnvelopesPage'
import { getCategories, addCategory, deleteCategory, updateCategory } from '@/src/api/categories'
import { getGroups, addGroup, deleteGroup } from '@/src/api/groups'

vi.mock('@/src/api/categories', () => ({
  getCategories: vi.fn(),
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  moveCategory: vi.fn(),
}))
vi.mock('@/src/api/groups', () => ({
  getGroups: vi.fn(),
  addGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  moveGroup: vi.fn(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/expense/envelopes' }))
// The sidebar reads the WorkOS session, which drags @workos-inc/authkit-nextjs
// (and next/server) into a jsdom run. It is chrome, not what this file tests.
vi.mock('../components/ExpenseSidebar', () => ({ ExpenseSidebar: () => null }))
vi.mock('../../components/AppearanceProvider', () => ({
  useAppearance: () => ({ theme: 'dark', setTheme: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderPage() {
  return render(<EnvelopesPage />, { wrapper })
}

/**
 * Waits for the categories to land and scopes queries to the group list.
 * "Home" is also a tab-bar destination, so an unscoped findByText('Home')
 * resolves against the tab while the list is still loading.
 */
async function groupList() {
  await screen.findByText('Rent')
  return within(screen.getByRole('list', { name: 'Envelope groups' }))
}

beforeEach(() => {
  window.localStorage.clear()
  ;(getCategories as Mock).mockResolvedValue([
    { name: '🏠 Rent', group: 'Home' },
    { name: '🚿 Water', group: 'Home', alertPcts: [25, 50] },
    { name: 'Odds' },
  ])
  ;(getGroups as Mock).mockResolvedValue(['Home'])
  ;(addCategory as Mock).mockResolvedValue(undefined)
  ;(updateCategory as Mock).mockResolvedValue(undefined)
  ;(deleteCategory as Mock).mockResolvedValue(undefined)
  ;(addGroup as Mock).mockResolvedValue(undefined)
  ;(deleteGroup as Mock).mockResolvedValue(undefined)
})

describe('EnvelopesPage', () => {
  it('lists groups with their categories, and ungrouped ones under Other', async () => {
    renderPage()
    const list = await groupList()
    expect(list.getByText('Home')).toBeInTheDocument()
    expect(list.getByText('Rent')).toBeInTheDocument()
    expect(list.getByText('Other')).toBeInTheDocument()
    expect(list.getByText('Odds')).toBeInTheDocument()
  })

  it('shows a category its own thresholds, and the defaults for one with none', async () => {
    renderPage()
    expect(await screen.findByText('25% · 50%')).toBeInTheDocument()
    expect(screen.getAllByText('50% · 90% · 100%').length).toBeGreaterThan(0)
  })

  it('creates a category in the group whose add button was used', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByLabelText('Add a category to Home'))
    await user.type(screen.getByPlaceholderText('Category name'), 'Gas')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(addCategory).toHaveBeenCalledWith('Gas', 'Home'))
  })

  it('re-homes stranded categories into Archived before deleting their group', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByLabelText('Delete Home'))
    // Archived does not exist yet, so it is created, then both of Home's
    // categories are moved into it, and only then is Home removed.
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith('Home'))
    expect(addGroup).toHaveBeenCalledWith('Archived')
    expect(updateCategory).toHaveBeenCalledWith('🏠 Rent', { group: 'Archived' })
    expect(updateCategory).toHaveBeenCalledWith('🚿 Water', { group: 'Archived' })
  })

  it('will not offer to delete the Archived group', async () => {
    ;(getGroups as Mock).mockResolvedValue(['Home', 'Archived'])
    renderPage()
    expect(await screen.findByLabelText('Delete Home')).toBeInTheDocument()
    expect(screen.queryByLabelText('Delete Archived')).not.toBeInTheDocument()
  })

  it('writes null for the default thresholds rather than pinning a copy', async () => {
    const user = userEvent.setup()
    renderPage()
    // Water is on a custom set; switching it back to the defaults should
    // clear the override so later default changes still reach it.
    await user.click(await screen.findByText('25% · 50%'))
    await user.click(screen.getByRole('button', { name: '25%' }))
    await user.click(screen.getByRole('button', { name: '75%' }))
    await user.click(screen.getByRole('button', { name: '90%' }))
    await user.click(screen.getByRole('button', { name: '100%' }))
    await user.click(screen.getByRole('button', { name: '75%' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateCategory).toHaveBeenCalledWith('🚿 Water', { alertPcts: null }))
  })

  it('surfaces a written message, never the raw server text', async () => {
    const user = userEvent.setup()
    ;(addGroup as Mock).mockRejectedValue(new Error('Failed to add group: 409 already exists'))
    renderPage()
    await user.click(await screen.findByRole('button', { name: /New group/ }))
    await user.type(screen.getByPlaceholderText('Group name'), 'Home')
    await user.keyboard('{Enter}')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That group already exists.')
    expect(alert).not.toHaveTextContent('409')
  })

  it('remembers which groups were collapsed', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.click((await groupList()).getByRole('button', { name: /^Home/ }))
    await waitFor(() => expect(window.localStorage.getItem('mc-collapsed-envelopes')).toContain('Home'))
    expect(screen.queryByText('Rent')).not.toBeInTheDocument()
    first.unmount()

    renderPage()
    // Collapsed, so Rent is not rendered and groupList()'s readiness signal
    // does not apply — wait on the group's own toggle instead.
    const list = within(await screen.findByRole('list', { name: 'Envelope groups' }))
    await waitFor(() => expect(list.getByRole('button', { name: /^Home/ })).toHaveAttribute('aria-expanded', 'false'))
  })
})
