import { describe, it, expect } from 'vitest'

const { evaluateMetric, TIERS } = require('../../../server/rubric/evaluator')
const thresholds = require('../../../server/rubric/thresholds')

describe('evaluateMetric', () => {
  describe('not yet instrumented', () => {
    it('returns not instrumented for null value', () => {
      const result = evaluateMetric(null, thresholds['cve-closure-rate'])
      expect(result.tier).toBe(TIERS.NOT_INSTRUMENTED)
    })

    it('returns not instrumented for undefined value', () => {
      const result = evaluateMetric(undefined, thresholds['cve-closure-rate'])
      expect(result.tier).toBe(TIERS.NOT_INSTRUMENTED)
    })

    it('distinguishes not instrumented from failing score', () => {
      const nullResult = evaluateMetric(null, thresholds['cve-closure-rate'])
      const failingResult = evaluateMetric(50, thresholds['cve-closure-rate'])

      expect(nullResult.tier).toBe(TIERS.NOT_INSTRUMENTED)
      expect(failingResult.tier).toBe(TIERS.DOES_NOT_MEET)
      expect(nullResult.tier).not.toBe(failingResult.tier)
    })
  })

  describe('simple ordered bands', () => {
    const threshold = thresholds['cve-closure-rate']

    it('evaluates below threshold as Does Not Meet', () => {
      const result = evaluateMetric(79, threshold)
      expect(result.tier).toBe(TIERS.DOES_NOT_MEET)
    })

    it('evaluates boundary value at lower edge of Meets Some', () => {
      const result = evaluateMetric(80, threshold)
      expect(result.tier).toBe(TIERS.MEETS_SOME)
    })

    it('evaluates mid-range as Meets Some', () => {
      const result = evaluateMetric(87, threshold)
      expect(result.tier).toBe(TIERS.MEETS_SOME)
    })

    it('evaluates boundary value at upper edge of Meets Some', () => {
      const result = evaluateMetric(94, threshold)
      expect(result.tier).toBe(TIERS.MEETS_SOME)
    })

    it('evaluates boundary value at lower edge of Meets', () => {
      const result = evaluateMetric(95, threshold)
      expect(result.tier).toBe(TIERS.MEETS)
    })

    it('evaluates perfect score as Meets', () => {
      const result = evaluateMetric(100, threshold)
      expect(result.tier).toBe(TIERS.MEETS)
    })
  })

  describe('two-sided bands', () => {
    const threshold = thresholds['epic-cycle-time']

    it('fails for too-fast value (misclassified)', () => {
      const result = evaluateMetric(10, threshold)
      expect(result.tier).toBe(TIERS.DOES_NOT_MEET)
      expect(result.reason).toContain('Misclassified')
    })

    it('evaluates boundary at lower edge', () => {
      const result = evaluateMetric(14, threshold)
      expect(result.tier).toBe(TIERS.MEETS_SOME)
    })

    it('evaluates mid-range as Meets Some', () => {
      const result = evaluateMetric(50, threshold)
      expect(result.tier).toBe(TIERS.MEETS_SOME)
    })

    it('evaluates boundary at upper edge of Meets Some', () => {
      const result = evaluateMetric(89.99, threshold)
      expect(result.tier).toBe(TIERS.MEETS_SOME)
    })

    it('evaluates boundary at lower edge of Meets', () => {
      const result = evaluateMetric(90, threshold)
      expect(result.tier).toBe(TIERS.MEETS)
    })

    it('evaluates within Meets range', () => {
      const result = evaluateMetric(110, threshold)
      expect(result.tier).toBe(TIERS.MEETS)
    })

    it('evaluates boundary at upper edge of Meets', () => {
      const result = evaluateMetric(129.99, threshold)
      expect(result.tier).toBe(TIERS.MEETS)
    })

    it('fails for too-slow value (overrun)', () => {
      const result = evaluateMetric(150, threshold)
      expect(result.tier).toBe(TIERS.DOES_NOT_MEET)
      expect(result.reason).toContain('Overrun')
    })
  })

  describe('per-cohort thresholds', () => {
    const threshold = thresholds['reactive-work-pct']

    it('requires cohort to be provided', () => {
      const result = evaluateMetric(15, threshold)
      expect(result.tier).toBe(TIERS.NOT_INSTRUMENTED)
      expect(result.reason).toContain('Cohort required')
    })

    it('handles unknown cohort', () => {
      const result = evaluateMetric(15, threshold, { cohort: 'Unknown' })
      expect(result.tier).toBe(TIERS.NOT_INSTRUMENTED)
      expect(result.reason).toContain('No threshold defined')
    })

    describe('Value-Stream cohort', () => {
      const cohort = 'Value-Stream'

      it('evaluates low value as Meets for Value-Stream', () => {
        const result = evaluateMetric(15, threshold, { cohort })
        expect(result.tier).toBe(TIERS.MEETS)
      })

      it('evaluates boundary at 20 for Value-Stream', () => {
        const result = evaluateMetric(20, threshold, { cohort })
        expect(result.tier).toBe(TIERS.MEETS_SOME)
      })

      it('evaluates mid-range as Meets Some for Value-Stream', () => {
        const result = evaluateMetric(25, threshold, { cohort })
        expect(result.tier).toBe(TIERS.MEETS_SOME)
      })

      it('evaluates high value as Does Not Meet for Value-Stream', () => {
        const result = evaluateMetric(35, threshold, { cohort })
        expect(result.tier).toBe(TIERS.DOES_NOT_MEET)
      })
    })

    describe('Interrupt cohort', () => {
      const cohort = 'Interrupt'

      it('evaluates same value differently for Interrupt cohort', () => {
        // 35% is Does Not Meet for Value-Stream but Meets for Interrupt
        const vsResult = evaluateMetric(35, threshold, { cohort: 'Value-Stream' })
        const intResult = evaluateMetric(35, threshold, { cohort })

        expect(vsResult.tier).toBe(TIERS.DOES_NOT_MEET)
        expect(intResult.tier).toBe(TIERS.MEETS)
      })

      it('evaluates boundary at 60 for Interrupt', () => {
        const result = evaluateMetric(60, threshold, { cohort })
        expect(result.tier).toBe(TIERS.MEETS_SOME)
      })

      it('evaluates high value as Does Not Meet for Interrupt', () => {
        const result = evaluateMetric(85, threshold, { cohort })
        expect(result.tier).toBe(TIERS.DOES_NOT_MEET)
      })
    })
  })

  describe('compound cross-metric thresholds', () => {
    const threshold = thresholds['net-delivery-flow']

    it('evaluates base tier normally when not at Meets', () => {
      const result = evaluateMetric(50, threshold)
      expect(result.tier).toBe(TIERS.DOES_NOT_MEET)
    })

    it('stays at Meets when Surpasses requirements not met', () => {
      const result = evaluateMetric(85, threshold, {
        crossMetrics: {
          'wip-ratio': { value: 3.0, isInTargetRange: false }
        }
      })
      expect(result.tier).toBe(TIERS.MEETS)
      expect(result.reason).toContain('not in target range')
    })

    it('achieves Surpasses when all requirements met', () => {
      const result = evaluateMetric(85, threshold, {
        crossMetrics: {
          'wip-ratio': { value: 1.0, isInTargetRange: true },
          'flow-ratio': {
            value: 95,
            history: [
              { quarter: '2026-Q2', value: 95 },
              { quarter: '2026-Q3', value: 92 },
              { quarter: '2026-Q4', value: 90 }
            ]
          }
        }
      })
      expect(result.tier).toBe(TIERS.SURPASSES)
    })

    it('stays at Meets when cross-metric not sustained', () => {
      const result = evaluateMetric(85, threshold, {
        crossMetrics: {
          'wip-ratio': { value: 1.0, isInTargetRange: true },
          'flow-ratio': {
            value: 95,
            history: [
              { quarter: '2026-Q3', value: 95 }
            ]
          }
        }
      })
      expect(result.tier).toBe(TIERS.MEETS)
      expect(result.reason).toContain('not sustained')
    })
  })

  describe('stricter Surpasses thresholds', () => {
    const threshold = thresholds['test-coverage']

    it('achieves Surpasses without sustained check', () => {
      const result = evaluateMetric(92, threshold)
      expect(result.tier).toBe(TIERS.SURPASSES)
    })

    it('stays at Meets below Surpasses threshold', () => {
      const result = evaluateMetric(85, threshold)
      expect(result.tier).toBe(TIERS.MEETS)
    })

    it('evaluates boundary at 90', () => {
      const result = evaluateMetric(90, threshold)
      expect(result.tier).toBe(TIERS.SURPASSES)
    })
  })

  describe('known defects', () => {
    it('warns about overlapping bands in Row 30', () => {
      const threshold = thresholds['wip-ratio']
      const result = evaluateMetric(1.6, threshold)
      expect(result.warnings).toBeDefined()
      expect(result.warnings[0]).toContain('multiple')
    })

    it('warns about gap in Row 5', () => {
      const threshold = thresholds['code-review-time']
      const result = evaluateMetric(94.5, threshold)
      expect(result.warnings).toBeDefined()
      expect(result.warnings[0]).toContain('does not match any tier')
    })

    it('warns about overlapping Surpasses and Meets in Row 16-17', () => {
      const threshold = thresholds['deployment-frequency']
      const result = evaluateMetric(92, threshold)
      expect(result.warnings).toBeDefined()
      expect(result.warnings[0]).toContain('multiple')
    })
  })

  describe('boundary value coverage', () => {
    describe('CVE closure rate boundaries', () => {
      const threshold = thresholds['cve-closure-rate']

      const testCases = [
        { value: 79, expected: TIERS.DOES_NOT_MEET },
        { value: 80, expected: TIERS.MEETS_SOME },
        { value: 80.1, expected: TIERS.MEETS_SOME },
        { value: 93.9, expected: TIERS.MEETS_SOME },
        { value: 94, expected: TIERS.MEETS_SOME },
        { value: 94.99, expected: TIERS.MEETS_SOME },
        { value: 95, expected: TIERS.MEETS },
        { value: 95.1, expected: TIERS.MEETS },
        { value: 100, expected: TIERS.MEETS }
      ]

      testCases.forEach(({ value, expected }) => {
        it(`evaluates ${value} as ${expected}`, () => {
          const result = evaluateMetric(value, threshold)
          expect(result.tier).toBe(expected)
        })
      })
    })

    describe('Epic cycle time boundaries', () => {
      const threshold = thresholds['epic-cycle-time']

      const testCases = [
        { value: 13, expected: TIERS.DOES_NOT_MEET },
        { value: 14, expected: TIERS.MEETS_SOME },
        { value: 15, expected: TIERS.MEETS_SOME },
        { value: 89, expected: TIERS.MEETS_SOME },
        { value: 90, expected: TIERS.MEETS },
        { value: 91, expected: TIERS.MEETS },
        { value: 129, expected: TIERS.MEETS },
        { value: 130, expected: TIERS.DOES_NOT_MEET },
        { value: 131, expected: TIERS.DOES_NOT_MEET }
      ]

      testCases.forEach(({ value, expected }) => {
        it(`evaluates ${value} days as ${expected}`, () => {
          const result = evaluateMetric(value, threshold)
          expect(result.tier).toBe(expected)
        })
      })
    })
  })
})
