import { describe, expect, it } from 'vitest'
import { splitEmoji, groupEmoji, categoryEmoji } from './emoji'

describe('splitEmoji', () => {
  it('splits a leading emoji from text', () => {
    expect(splitEmoji('🏠 Rent')).toEqual({ icon: '🏠', text: 'Rent' })
  })

  it('handles a ZWJ sequence emoji (cook)', () => {
    expect(splitEmoji('👨‍🍳 Cook')).toEqual({ icon: '👨‍🍳', text: 'Cook' })
  })

  it('passes through text with no leading emoji', () => {
    expect(splitEmoji('Plain Name')).toEqual({ icon: '', text: 'Plain Name' })
  })

  it('falls back to the full trimmed string when the emoji is the whole value', () => {
    expect(splitEmoji('🏠')).toEqual({ icon: '', text: '🏠' })
  })
})

describe('groupEmoji', () => {
  it('prefers an embedded emoji over the lookup table', () => {
    expect(groupEmoji('🎁 Home')).toBe('🎁')
  })

  it('falls back to the group lookup table', () => {
    expect(groupEmoji('Home')).toBe('🏠')
  })

  it('falls back to a default folder icon for unknown groups', () => {
    expect(groupEmoji('Unknown Group')).toBe('📁')
  })
})

describe('categoryEmoji', () => {
  it('prefers an embedded emoji', () => {
    expect(categoryEmoji('🚗 Car')).toBe('🚗')
  })

  it('falls back to the category lookup table (case-insensitive)', () => {
    expect(categoryEmoji('Groceries')).toBe('🍅')
  })

  it('falls back to the group emoji when the category is unknown', () => {
    expect(categoryEmoji('Mystery Category', 'Travel')).toBe('🛵')
  })

  it('falls back to a default money icon when nothing matches', () => {
    expect(categoryEmoji('Mystery Category')).toBe('💰')
  })
})
