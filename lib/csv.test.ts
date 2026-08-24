import { describe, it, expect } from 'vitest'
import { csvField, defangFormula, toCsv } from './csv'

describe('defangFormula', () => {
  it('prefixes a leading = so spreadsheet apps do not execute it as a formula', () => {
    expect(defangFormula('=HYPERLINK("http://evil","click")')).toBe('\'=HYPERLINK("http://evil","click")')
  })

  it('prefixes leading +, -, @, tab, and CR the same way', () => {
    expect(defangFormula('+1+1')).toBe("'+1+1")
    expect(defangFormula('-2+3')).toBe("'-2+3")
    expect(defangFormula('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(defangFormula('\tx')).toBe("'\tx")
    expect(defangFormula('\rx')).toBe("'\rx")
  })

  it('leaves ordinary text alone, including a mid-string dash', () => {
    expect(defangFormula('Groceries')).toBe('Groceries')
    expect(defangFormula('Coffee - 100')).toBe('Coffee - 100')
  })
})

describe('csvField', () => {
  it('defangs a formula-looking value before quote-wrapping', () => {
    // Contains a comma, so it also gets quote-wrapped — defanging must happen first.
    expect(csvField('=A1,B1')).toBe(`"'=A1,B1"`)
  })

  it('quotes a field containing a comma without defanging ordinary text', () => {
    expect(csvField('Rent, October')).toBe('"Rent, October"')
  })

  it('leaves a plain field unquoted and unprefixed', () => {
    expect(csvField('Groceries')).toBe('Groceries')
  })
})

describe('toCsv', () => {
  it('renders a header row plus one row per record, defanging as it goes', () => {
    const csv = toCsv(['item', 'amount'], [{ item: '=cmd', amount: '100' }, { item: 'Rent', amount: '5,000' }])
    expect(csv).toBe(['item,amount', "'=cmd,100", 'Rent,"5,000"'].join('\n'))
  })

  it('defaults a missing field to an empty string', () => {
    const csv = toCsv(['item', 'notes'], [{ item: 'Coffee' }])
    expect(csv).toBe('item,notes\nCoffee,')
  })
})
