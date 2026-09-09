import { apiFetch } from './client'
import type { CategoryMap } from '@/src/types'

export async function getCategoryMap(): Promise<CategoryMap> {
  const resp = await apiFetch('/api/category-map')
  if (!resp.ok) throw new Error(`Failed to load category map: ${resp.status}`)
  return resp.json()
}

/** LLM fallback for when the local keyword match finds nothing. Never throws. */
export async function suggestCategoryLLM(item: string, categories: string[]): Promise<string> {
  if (!item.trim()) return ''
  try {
    const resp = await apiFetch('/api/category-map/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, categories }),
    })
    if (!resp.ok) return ''
    const data: { category?: string } = await resp.json()
    return data.category ?? ''
  } catch {
    return ''
  }
}
