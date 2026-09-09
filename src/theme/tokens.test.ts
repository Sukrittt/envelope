import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { darkTokens, lightTokens } from './tokens'

// tokens.css is generated from tokens.ts. If someone edits the palette and
// forgets `npm run gen:tokens`, every stylesheet keeps the old colours while
// tokens.ts claims the new ones — silently, since nothing else reads the .ts.
describe('tokens.css', () => {
  it('is in sync with tokens.ts', () => {
    const before = readFileSync('src/theme/tokens.css', 'utf8')
    execFileSync('node', ['scripts/generate-tokens.mjs'], { stdio: 'pipe' })
    const after = readFileSync('src/theme/tokens.css', 'utf8')
    expect(after, 'run `npm run gen:tokens` and commit the result').toBe(before)
  })

  it('emits every token of both schemes', () => {
    const css = readFileSync('src/theme/tokens.css', 'utf8')
    for (const name of Object.keys(darkTokens)) {
      const cssName = `--tk-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
      expect(css, `${name} is missing from tokens.css`).toContain(`${cssName}:`)
    }
    expect(Object.keys(lightTokens)).toEqual(Object.keys(darkTokens))
  })

  it('keeps the accent/accentInk contrast split mobile relies on', () => {
    // accent is for fills and large text only; accentInk is the one that
    // clears 4.5:1 for small text and icons. Collapsing them re-introduces
    // the contrast failure the split exists to avoid.
    expect(lightTokens.accent).not.toBe(lightTokens.accentInk)
    expect(darkTokens.accent).not.toBe(darkTokens.accentInk)
  })
})
