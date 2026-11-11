/**
 * Threshold definitions for SDLC Report Card metrics.
 *
 * Each threshold defines how a metric value maps to a performance tier.
 * Thresholds are expressed as data to allow leadership changes without code changes.
 *
 * Tier levels (in order):
 * - "Does Not Meet Expectations"
 * - "Meets Some Expectations"
 * - "Meets Expectations"
 * - "Surpasses"
 *
 * Threshold Types:
 *
 * 1. Simple ordered bands - higher is better
 * 2. Two-sided bands - too high or too low both fail
 * 3. Per-cohort thresholds - different bands for different team types
 * 4. Compound cross-metric gates - top tier requires multiple metrics aligned
 * 5. Sustained thresholds - requires holding for multiple quarters
 *
 * See README.md for detailed examples and usage.
 */

/**
 * Source row reference format:
 * Row N: [Metric Name] - [Source document reference]
 */
module.exports = {
  // Row 6: Percent of CVEs closed by due date
  'cve-closure-rate': {
    type: 'ordered-bands',
    sourceRow: 6,
    description: 'Percent of CVEs closed by due date',
    bands: [
      { tier: 'Does Not Meet Expectations', max: 79.99 },
      { tier: 'Meets Some Expectations', min: 80, max: 94.99 },
      { tier: 'Meets Expectations', min: 95, max: 100 }
    ]
  },

  // Row 18-21: Delivery cycle time (two-sided - too fast or too slow both fail)
  'epic-cycle-time': {
    type: 'two-sided',
    sourceRow: '18-21',
    description: 'Epic delivery cycle time in days',
    bands: [
      { tier: 'Does Not Meet Expectations', max: 13.99, reason: 'Misclassified - should be Story' },
      { tier: 'Meets Some Expectations', min: 14, max: 89.99 },
      { tier: 'Meets Expectations', min: 90, max: 129.99 },
      { tier: 'Does Not Meet Expectations', min: 130, reason: 'Overrun' }
    ]
  },

  // Row 29-32: WIP ratio (two-sided - overload or under-utilization)
  // NOTE: Row 29 has upstream fix - re-pull from source before implementing
  'wip-ratio': {
    type: 'two-sided',
    sourceRow: '29-32',
    description: 'WIP to throughput ratio',
    _note: 'Row 29 fixed upstream - re-pull from source sheet before implementing',
    bands: [
      { tier: 'Meets Expectations', min: 0.5, max: 1.5 },
      { tier: 'Meets Some Expectations', min: 1.5, max: 2.0 },
      // KNOWN DEFECT: Row 30 overlap - ceiling (2x) above floor (1.5x)
      { tier: 'Does Not Meet Expectations', min: 1.5, reason: 'Overload' },
      { tier: 'Does Not Meet Expectations', max: 0.5, reason: 'Under-utilization' }
    ],
    _defects: [
      'Row 30: Meets Some ceiling (2x) sits above Does Not Meet floor (1.5x) - bands overlap'
    ]
  },

  // Row 22: Reactive work percentage (per-cohort)
  'reactive-work-pct': {
    type: 'per-cohort',
    sourceRow: 22,
    description: 'Reactive work percentage',
    cohorts: {
      'Value-Stream': {
        type: 'ordered-bands',
        bands: [
          { tier: 'Meets Expectations', max: 20 },
          { tier: 'Meets Some Expectations', min: 20, max: 30 },
          { tier: 'Does Not Meet Expectations', min: 30 }
        ]
      },
      'Interrupt': {
        type: 'ordered-bands',
        bands: [
          { tier: 'Meets Expectations', max: 60 },
          { tier: 'Meets Some Expectations', min: 60, max: 80 },
          { tier: 'Does Not Meet Expectations', min: 80 }
        ]
      }
    }
  },

  // Row 33: Net delivery flow ratio (compound - depends on WIP ratio AND flow ratio)
  'net-delivery-flow': {
    type: 'compound',
    sourceRow: 33,
    description: 'Net delivery flow ratio',
    baseTier: {
      type: 'ordered-bands',
      bands: [
        { tier: 'Does Not Meet Expectations', max: 60 },
        { tier: 'Meets Some Expectations', min: 60, max: 80 },
        { tier: 'Meets Expectations', min: 80 }
      ]
    },
    surpassesRequires: [
      {
        metric: 'wip-ratio',
        condition: 'within-target-range'
      },
      {
        metric: 'flow-ratio',
        min: 80,
        max: 110,
        sustainedQuarters: 3
      }
    ]
  },

  // Row 23-24: Surpasses as stricter threshold (not sustained Meets)
  'test-coverage': {
    type: 'ordered-bands',
    sourceRow: '23-24',
    description: 'Test coverage percentage',
    bands: [
      { tier: 'Does Not Meet Expectations', max: 60 },
      { tier: 'Meets Some Expectations', min: 60, max: 80 },
      { tier: 'Meets Expectations', min: 80, max: 90 },
      { tier: 'Surpasses', min: 90 }  // Stricter threshold, not sustained
    ]
  },

  // Row 5: Gap between tiers (known defect)
  'code-review-time': {
    type: 'ordered-bands',
    sourceRow: 5,
    description: 'Code review turnaround time (hours)',
    bands: [
      { tier: 'Surpasses', max: 8 },
      { tier: 'Meets Expectations', min: 8, max: 24 },
      { tier: 'Meets Some Expectations', min: 24, max: 48 },
      { tier: 'Does Not Meet Expectations', min: 48, max: 94 }
    ],
    // KNOWN DEFECT: Gap between 94 and 95 that no tier claims
    _defects: [
      'Row 5: Gap between 94 and 95 percent that no tier claims'
    ]
  },

  // Row 16-17: Overlapping Surpasses and Meets (known defect)
  'deployment-frequency': {
    type: 'ordered-bands',
    sourceRow: '16-17',
    description: 'Deployments per week',
    bands: [
      { tier: 'Does Not Meet Expectations', max: 1 },
      { tier: 'Meets Some Expectations', min: 1, max: 3 },
      { tier: 'Meets Expectations', min: 3, max: 94 },  // max: 94 from source
      { tier: 'Surpasses', min: 90 }  // Overlaps with Meets
    ],
    _defects: [
      'Row 16-17: Surpasses floor (90) is below Meets ceiling (94) - bands overlap'
    ]
  }
}
