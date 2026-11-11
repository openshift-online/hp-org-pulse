## SDLC Report Card Rubric Evaluator

Reusable evaluation system for SDLC performance metrics against delivery excellence thresholds.

### Overview

This rubric system provides **one function** that evaluates any metric value against its threshold definition and returns a performance tier. No need to reimplement evaluation logic 33 times across different metrics.

### Usage

```javascript
const { evaluateMetric, TIERS } = require('./evaluator')
const thresholds = require('./thresholds')

// Simple metric evaluation
const result = evaluateMetric(
  85,  // metric value
  thresholds['cve-closure-rate']
)
// => { tier: 'Meets Some Expectations' }

// Per-cohort evaluation
const result = evaluateMetric(
  35,  // reactive work percentage
  thresholds['reactive-work-pct'],
  { cohort: 'Value-Stream' }
)
// => { tier: 'Does Not Meet Expectations' }

// With historical data for sustained checks
const result = evaluateMetric(
  92,
  thresholds['test-coverage'],
  {
    history: [
      { quarter: '2026-Q1', value: 90 },
      { quarter: '2026-Q2', value: 91 }
    ]
  }
)
```

### Tiers

The evaluator returns one of five possible tiers:

1. **Does Not Meet Expectations** - Performance is below acceptable levels
2. **Meets Some Expectations** - Partial compliance, needs improvement
3. **Meets Expectations** - Satisfactory performance, meets target
4. **Surpasses** - Exceptional performance, sustained excellence
5. **not yet instrumented** - Metric not yet collecting data (distinct from failing)

### Threshold Types

All threshold definitions live in `thresholds.js` as **data**, not code. This allows leadership to adjust bands without code changes.

#### 1. Simple Ordered Bands

Higher (or lower) values progress through tiers:

```javascript
{
  type: 'ordered-bands',
  bands: [
    { tier: 'Does Not Meet Expectations', max: 80 },
    { tier: 'Meets Some Expectations', min: 80, max: 94 },
    { tier: 'Meets Expectations', min: 95, max: 100 }
  ]
}
```

**Examples:** CVE closure rate (Row 6), test coverage (Rows 23-24)

#### 2. Two-Sided Bands

Too high OR too low both fail:

```javascript
{
  type: 'two-sided',
  bands: [
    { tier: 'Does Not Meet Expectations', max: 14, reason: 'misclassified' },
    { tier: 'Meets Some Expectations', min: 14, max: 90 },
    { tier: 'Meets Expectations', min: 90, max: 130 },
    { tier: 'Does Not Meet Expectations', min: 130, reason: 'overrun' }
  ]
}
```

**Examples:** Epic cycle time (Rows 18-21), WIP ratio (Rows 29-32)

**Rationale:** An Epic completed in 10 days was likely misclassified as an Epic when it should have been a Story. An Epic taking 150 days indicates overrun.

#### 3. Per-Cohort Thresholds

The same raw value evaluates differently for different team types:

```javascript
{
  type: 'per-cohort',
  cohorts: {
    'Value-Stream': { /* threshold */ },
    'Interrupt': { /* threshold */ }
  }
}
```

**Example:** Reactive work percentage (Row 22)
- 35% reactive work: **Does Not Meet** for Value-Stream teams, **Meets** for Interrupt teams

#### 4. Compound Cross-Metric Gates

Top tier requires multiple metrics to align:

```javascript
{
  type: 'compound',
  baseTier: { /* threshold for primary metric */ },
  surpassesRequires: [
    { metric: 'wip-ratio', condition: 'within-target-range' },
    { metric: 'flow-ratio', min: 80, max: 110, sustainedQuarters: 3 }
  ]
}
```

**Example:** Net delivery flow (Row 33) - Surpasses requires WIP-to-throughput in range AND flow ratio 80-110%, both sustained

#### 5. Sustained Thresholds

Top tier requires holding a level for multiple consecutive quarters:

```javascript
{
  type: 'ordered-bands',
  sustainedQuarters: 3,
  bands: [ /* ... */ ]
}
```

### Sustained Quarters Semantics

About 10 rows gate **Surpasses** on holding a performance level for 3+ consecutive quarters.

#### Quarter Boundaries

Quarters align with calendar quarters:
- **Q1:** Jan 1 - Mar 31
- **Q2:** Apr 1 - Jun 30
- **Q3:** Jul 1 - Sep 30
- **Q4:** Oct 1 - Dec 31

#### Missing Quarter Handling

**Key Decision:** Missing quarters **do not break the streak** and **do not count toward the requirement**.

**Example:** Team has observations in Q1, Q3, Q4 (Q2 missing due to data pipeline issue)
- If all three observed quarters meet the threshold → counts as **3 consecutive quarters**
- Missing Q2 is **skipped**, not treated as a failure

**Rationale:**
- Metrics may not be collected every quarter due to new metric rollout, data issues, or reorganization
- Treating gaps as failures punishes teams for data collection problems, not performance
- Consecutive = "consecutive observations", not "consecutive calendar quarters"

#### Streak Breaking

A streak breaks when:
- An observed quarter **fails** the threshold
- NOT when a quarter is missing

#### Sandbox Data Limitation

Sandbox data is a frozen snapshot whose tail quarters repeat. The sustained checker will return `false` for nearly everything until real longitudinal data is available. This is **expected** and documented in [ENGPROD-10433](https://redhat.atlassian.net/browse/ENGPROD-10433).

### Known Defects in Source Rubric

The evaluator flags these issues with warnings:

#### Row 30: Overlapping Bands
- **Meets Some** ceiling (2.0x) sits above **Does Not Meet** floor (1.5x)
- Values 1.5-2.0 match both bands
- Evaluator warns and defaults to first match

#### Row 5: Gap in Bands
- Gap between 94% and 95% claimed by no tier
- Evaluator warns and defaults to Does Not Meet

#### Row 16-17: Overlapping Surpasses and Meets
- **Surpasses** floor (90) below **Meets** ceiling (94)
- Values 90-94 match both
- Evaluator warns and returns first match

#### Row 29: Fixed Upstream
- Re-pull from source sheet before implementing - our CSV copy is stale

### Color Mapping Proposal

Mapping the four tiers to green/amber/red indicators:

#### Option A: Three-Color Scale (Recommended)

| Tier | Color | Rationale |
|------|-------|-----------|
| **Does Not Meet Expectations** | 🔴 Red | Clear failure signal |
| **Meets Some Expectations** | 🟡 Amber | Warning - needs improvement |
| **Meets Expectations** | 🟢 Green | Success - target achieved |
| **Surpasses** | 🟢 Green (brighter/badge) | Exceptional - visually distinct from Meets |

- **Surpasses** uses same green as Meets but with a badge/icon/brighter shade
- Most dashboards need three states: bad/warning/good
- Four colors may add confusion without clear semantic difference

#### Option B: Four-Color Scale

| Tier | Color | Rationale |
|------|-------|-----------|
| **Does Not Meet Expectations** | 🔴 Red | Failure |
| **Meets Some Expectations** | 🟡 Amber | Partial |
| **Meets Expectations** | 🟢 Green | Success |
| **Surpasses** | 🔵 Blue | Excellence |

- Clear visual separation for all four tiers
- Blue signals "exceeds expectations" without danger/warning connotations
- May be harder to scan quickly (four states vs three)

#### Recommendation

Use **Option A** (three-color + badge) for better at-a-glance scanning. Reserve a fourth color only if "Surpasses" needs to trigger different workflows (notifications, recognition, etc.).

### Files

```
server/rubric/
  evaluator.js          # Main evaluation logic
  thresholds.js         # Threshold definitions (data, not code)
  sustained-checker.js  # Sustained quarters logic
  README.md            # This file

__tests__/server/rubric/
  evaluator.test.js          # Comprehensive threshold tests
  sustained-checker.test.js  # Sustained quarters tests
```

### Testing

All threshold shapes have test coverage at band boundaries:

```bash
npm test modules/sdlc-report-card
```

Tests cover:
- All five threshold types
- Boundary values on both edges of every band
- Missing/null value handling ("not yet instrumented")
- Sustained quarters with gaps and missing data
- Known defects (overlap warnings, gap warnings)
- Per-cohort different evaluations for same value

### Adding a New Metric

1. Add threshold definition to `thresholds.js` with `sourceRow` reference
2. Add test cases to `evaluator.test.js` covering boundaries
3. No changes needed to evaluator code - it handles all shapes

### References

- Source report card: [Link to source document]
- ENGPROD-10435: This implementation
- ENGPROD-10433: Sandbox data longitudinal limitation
- ENGPROD-10436: Rendering (out of scope)
