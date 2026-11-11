import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const {
  checkSustainedQuarters,
  getCurrentQuarter,
  compareQuarters,
  parseQuarter
} = require('../../../server/rubric/sustained-checker')

describe('parseQuarter', () => {
  it('parses valid quarter string', () => {
    const [year, quarter] = parseQuarter('2026-Q3')
    expect(year).toBe(2026)
    expect(quarter).toBe(3)
  })

  it('throws on invalid format', () => {
    expect(() => parseQuarter('2026-3')).toThrow('Invalid quarter format')
    expect(() => parseQuarter('Q3-2026')).toThrow('Invalid quarter format')
    expect(() => parseQuarter('2026Q3')).toThrow('Invalid quarter format')
  })

  it('throws on invalid quarter values', () => {
    expect(() => parseQuarter('2026-Q0')).toThrow('Invalid quarter value')
    expect(() => parseQuarter('2026-Q5')).toThrow('Invalid quarter value')
    expect(() => parseQuarter('2026-Q9')).toThrow('Invalid quarter value')
  })
})

describe('compareQuarters', () => {
  it('compares quarters in same year', () => {
    expect(compareQuarters('2026-Q1', '2026-Q2')).toBeLessThan(0)
    expect(compareQuarters('2026-Q3', '2026-Q2')).toBeGreaterThan(0)
    expect(compareQuarters('2026-Q2', '2026-Q2')).toBe(0)
  })

  it('compares quarters in different years', () => {
    expect(compareQuarters('2025-Q4', '2026-Q1')).toBeLessThan(0)
    expect(compareQuarters('2027-Q1', '2026-Q4')).toBeGreaterThan(0)
  })
})

describe('getCurrentQuarter', () => {
  it('returns quarter in YYYY-QN format', () => {
    const quarter = getCurrentQuarter()
    expect(quarter).toMatch(/^\d{4}-Q[1-4]$/)
  })
})

describe('checkSustainedQuarters', () => {
  const band = { min: 80, max: 100 }

  beforeEach(() => {
    // Pin the clock to 2026-10-15 (Q4 2026)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic sustained check', () => {
    it('returns sustained when enough consecutive quarters meet threshold', () => {
      const history = [
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q2', value: 90 },
        { quarter: '2026-Q3', value: 92 }
      ]
      const result = checkSustainedQuarters(88, band, history, 3)
      expect(result.isSustained).toBe(true)
      expect(result.consecutiveQuarters).toBeGreaterThanOrEqual(3)
    })

    it('returns not sustained when not enough quarters', () => {
      const history = [
        { quarter: '2026-Q2', value: 90 }
      ]
      const result = checkSustainedQuarters(88, band, history, 3)
      expect(result.isSustained).toBe(false)
      expect(result.consecutiveQuarters).toBe(2) // history + current
      expect(result.details).toContain('Only 2')
    })

    it('returns not sustained when streak broken', () => {
      const history = [
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q2', value: 70 }, // Below threshold
        { quarter: '2026-Q3', value: 92 }
      ]
      const result = checkSustainedQuarters(88, band, history, 3)
      expect(result.isSustained).toBe(false)
      expect(result.details).toContain('Streak broken')
    })
  })

  describe('missing quarter handling', () => {
    it('skips missing quarters without breaking streak', () => {
      // Q1, Q3, Q4 with Q2 missing - should count as 3 consecutive
      const history = [
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q3', value: 90 }
      ]
      const result = checkSustainedQuarters(92, band, history, 3)
      expect(result.isSustained).toBe(true)
      expect(result.details).toContain('Sustained for 3')
    })

    it('does not count missing quarters toward requirement', () => {
      // Only 2 observations, need 3
      const history = [
        { quarter: '2026-Q1', value: 85 }
        // Q2, Q3 missing
      ]
      const result = checkSustainedQuarters(90, band, history, 3)
      expect(result.isSustained).toBe(false)
      expect(result.consecutiveQuarters).toBe(2)
    })

    it('handles multiple gaps in history', () => {
      // Q1, Q4, Q5, Q8 with gaps - all meet threshold
      const history = [
        { quarter: '2025-Q1', value: 85 },
        { quarter: '2025-Q4', value: 88 },
        { quarter: '2026-Q1', value: 90 }
      ]
      const result = checkSustainedQuarters(92, band, history, 4)
      expect(result.isSustained).toBe(true)
    })
  })

  describe('boundary cases', () => {
    it('handles exactly at required count', () => {
      const history = [
        { quarter: '2026-Q2', value: 90 },
        { quarter: '2026-Q3', value: 92 }
      ]
      const result = checkSustainedQuarters(88, band, history, 3)
      expect(result.isSustained).toBe(true)
      expect(result.consecutiveQuarters).toBe(3)
    })

    it('handles more than required count', () => {
      const history = [
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q2', value: 90 },
        { quarter: '2026-Q3', value: 92 },
        { quarter: '2026-Q4', value: 88 }
      ]
      const result = checkSustainedQuarters(91, band, history, 3)
      expect(result.isSustained).toBe(true)
      expect(result.consecutiveQuarters).toBeGreaterThanOrEqual(3)
    })

    it('handles value at band minimum', () => {
      const history = [
        { quarter: '2026-Q2', value: 80 },
        { quarter: '2026-Q3', value: 80 }
      ]
      const result = checkSustainedQuarters(80, band, history, 3)
      expect(result.isSustained).toBe(true)
    })

    it('handles value at band maximum', () => {
      const history = [
        { quarter: '2026-Q2', value: 100 },
        { quarter: '2026-Q3', value: 100 }
      ]
      const result = checkSustainedQuarters(100, band, history, 3)
      expect(result.isSustained).toBe(true)
    })

    it('handles value just below minimum', () => {
      const history = [
        { quarter: '2026-Q2', value: 85 },
        { quarter: '2026-Q3', value: 90 }
      ]
      const result = checkSustainedQuarters(79, band, history, 3)
      expect(result.isSustained).toBe(false)
      expect(result.details).toContain('Streak broken')
    })
  })

  describe('null and missing value handling', () => {
    it('filters out null values from history', () => {
      const history = [
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q2', value: null },
        { quarter: '2026-Q3', value: 90 }
      ]
      const result = checkSustainedQuarters(92, band, history, 3)
      expect(result.isSustained).toBe(true)
    })

    it('filters out undefined values from history', () => {
      const history = [
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q2', value: undefined },
        { quarter: '2026-Q3', value: 90 }
      ]
      const result = checkSustainedQuarters(92, band, history, 3)
      expect(result.isSustained).toBe(true)
    })

    it('returns not sustained when no valid observations', () => {
      const history = [
        { quarter: '2026-Q1', value: null },
        { quarter: '2026-Q2', value: null }
      ]
      const result = checkSustainedQuarters(null, band, history, 3)
      expect(result.isSustained).toBe(false)
      expect(result.consecutiveQuarters).toBe(0)
      expect(result.details).toContain('No observations')
    })
  })

  describe('quarter boundary semantics', () => {
    it('treats Q1 as Jan-Mar observations', () => {
      // This is implicit in the quarter format but tested for documentation
      const [_year, quarter] = parseQuarter('2026-Q1')
      expect(quarter).toBe(1)
    })

    it('sorts quarters chronologically regardless of insertion order', () => {
      const history = [
        { quarter: '2026-Q3', value: 90 },
        { quarter: '2026-Q1', value: 85 },
        { quarter: '2026-Q2', value: 88 }
      ]
      const result = checkSustainedQuarters(92, band, history, 4)
      // Should count all 4 quarters in correct order
      expect(result.isSustained).toBe(true)
    })
  })

  describe('different required quarters', () => {
    const history = [
      { quarter: '2026-Q1', value: 85 },
      { quarter: '2026-Q2', value: 90 },
      { quarter: '2026-Q3', value: 92 },
      { quarter: '2026-Q4', value: 88 }
    ]

    it('handles requireQuarters = 2', () => {
      const result = checkSustainedQuarters(91, band, history.slice(0, 1), 2)
      expect(result.isSustained).toBe(true)
    })

    it('handles requireQuarters = 4', () => {
      const result = checkSustainedQuarters(91, band, history, 4)
      expect(result.isSustained).toBe(true)
    })

    it('handles requireQuarters = 5', () => {
      // History has only 4 distinct quarters, so 5 consecutive quarters not possible
      const result = checkSustainedQuarters(91, band, history, 5)
      expect(result.isSustained).toBe(false)
      expect(result.consecutiveQuarters).toBe(4)
    })
  })

  describe('band types', () => {
    it('handles min-only band', () => {
      const minOnlyBand = { min: 80 }
      const history = [
        { quarter: '2026-Q2', value: 85 },
        { quarter: '2026-Q3', value: 90 }
      ]
      const result = checkSustainedQuarters(100, minOnlyBand, history, 3)
      expect(result.isSustained).toBe(true)
    })

    it('handles max-only band', () => {
      const maxOnlyBand = { max: 100 }
      const history = [
        { quarter: '2026-Q2', value: 85 },
        { quarter: '2026-Q3', value: 90 }
      ]
      const result = checkSustainedQuarters(95, maxOnlyBand, history, 3)
      expect(result.isSustained).toBe(true)
    })
  })
})
