import { describe, expect, it } from 'vitest'
import { parseChatMarkdown, parseInline } from './chatMarkdown'

describe('parseInline', () => {
  it('alternates plain and bold runs', () => {
    expect(parseInline('You spent **₹4,200** on food')).toEqual([
      { text: 'You spent ', bold: false },
      { text: '₹4,200', bold: true },
      { text: ' on food', bold: false },
    ])
  })

  it('bolds the tail of an unclosed marker instead of showing asterisks', () => {
    expect(parseInline('You spent **₹4,2')).toEqual([
      { text: 'You spent ', bold: false },
      { text: '₹4,2', bold: true },
    ])
  })
})

describe('parseChatMarkdown', () => {
  it('keeps old plain-text answers as one paragraph', () => {
    expect(parseChatMarkdown('Food is at ₹3,000. You have ₹1,000 left.')).toEqual([
      { type: 'p', runs: [{ text: 'Food is at ₹3,000. You have ₹1,000 left.', bold: false }] },
    ])
  })

  it('splits paragraphs on blank lines and keeps single newlines', () => {
    expect(parseChatMarkdown('a\nb\n\nc')).toEqual([
      { type: 'p', runs: [{ text: 'a\nb', bold: false }] },
      { type: 'p', runs: [{ text: 'c', bold: false }] },
    ])
  })

  it('groups bullets into one list, even across blank lines', () => {
    const blocks = parseChatMarkdown('Top three:\n- **Food** ₹3,000\n\n- Rent ₹20,000\n* Fuel ₹900')
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toEqual({
      type: 'ul',
      items: [
        [{ text: 'Food', bold: true }, { text: ' ₹3,000', bold: false }],
        [{ text: 'Rent ₹20,000', bold: false }],
        [{ text: 'Fuel ₹900', bold: false }],
      ],
    })
  })

  it('keeps the starting number of a numbered list', () => {
    expect(parseChatMarkdown('2. Cut takeout\n3. Pause Netflix')).toEqual([
      { type: 'ol', start: 2, items: [[{ text: 'Cut takeout', bold: false }], [{ text: 'Pause Netflix', bold: false }]] },
    ])
  })

  it('starts a new list after a paragraph in between', () => {
    const blocks = parseChatMarkdown('- a\nmiddle\n- b')
    expect(blocks.map((b) => b.type)).toEqual(['ul', 'p', 'ul'])
  })

  it('turns a stray heading into a bold line', () => {
    expect(parseChatMarkdown('### Summary')).toEqual([{ type: 'p', runs: [{ text: 'Summary', bold: true }] }])
  })

  it('handles an empty or half-started stream', () => {
    expect(parseChatMarkdown('')).toEqual([])
    expect(parseChatMarkdown('- ')).toEqual([{ type: 'ul', items: [[]] }])
  })
})
