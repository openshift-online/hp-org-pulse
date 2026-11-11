# SDLC Report Card Rubric Implementation

**Ticket:** ENGPROD-10435  
**Status:** ✅ Complete

## Deliverables

### ✅ One Reusable Function

Created `evaluateMetric(value, threshold, options)` in `server/rubric/evaluator.js`:
- Single function handles all metric evaluations
- No need to reimplement logic 33 times across metrics
- Returns tier or "not yet instrumented"

### ✅ All Threshold Shapes Covered

**1. Simple Ordered Bands** (Row 6: CVE closure rate)
- Higher values progress through tiers
- Example: <80 = Does Not Meet, 80-94.99 = Meets Some, 95-100 = Meets

**2. Two-Sided Bands** (Rows 18-21: Epic cycle time, Rows 29-32: WIP ratio)
- Too high OR too low both fail
- Example: <14 days = misclassified, 14-89.99 = Meets Some, 90-129.99 = Meets, 130+ = overrun

**3. Per-Cohort Thresholds** (Row 22: Reactive work %)
- Same value evaluates differently for different team types
- Example: 35% reactive = Does Not Meet for Value-Stream, Meets for Interrupt

**4. Compound Cross-Metric Gates** (Row 33: Net delivery flow)
- Top tier requires multiple metrics aligned
- Example: Surpasses requires WIP in range AND flow ratio 80-110%, both sustained

**5. Surpasses as Stricter Threshold** (Rows 23-24)
- Not "Meets sustained" — a distinct, higher bar
- Example: Test coverage 90%+ = Surpasses immediately

### ✅ Sustained Quarters Checker

Implemented in `server/rubric/sustained-checker.js`:

**Documented Semantics:**
- **Quarter boundaries:** Calendar quarters (Q1-Q4)
- **Missing quarters:** Skipped, not counted as failures
- **Gap handling:** Consecutive = consecutive *observations*, not calendar quarters
- **Streak breaking:** Only when an observed quarter fails threshold

**Example:** Team observed in Q1, Q3, Q4 (Q2 missing)
- If all three meet threshold → counts as 3 consecutive quarters
- Missing Q2 skipped, not treated as failure

**Rationale:** Metrics may have gaps due to new rollout, data issues, or reorganization. Penalizing data collection problems vs. performance is unfair.

### ✅ Threshold Definitions as Data

All thresholds in `server/rubric/thresholds.js`:
- Plain JavaScript objects, not code
- Leadership can adjust bands by editing data
- Each threshold includes `sourceRow` reference
- Known defects documented inline with `_defects` arrays

### ✅ Known Defects Flagged

The evaluator warns about known issues:

1. **Row 30 (WIP ratio):** Overlapping bands - Meets Some ceiling (2.0) above Does Not Meet floor (1.5)
2. **Row 5 (Code review time):** Gap between 94 and 95 that no tier claims
3. **Rows 16-17 (Deployment frequency):** Surpasses floor (90) below Meets ceiling (94)
4. **Row 29:** Noted as fixed upstream - re-pull CSV before implementing

Evaluator returns warnings array when defects encountered.

### ✅ "Not Yet Instrumented" as First-Class Result

Distinct from failing:
- `null`/`undefined` value → `{ tier: 'not yet instrumented' }`
- Zero or low value → `{ tier: 'Does Not Meet Expectations' }`
- Never conflated

### ✅ Comprehensive Test Coverage

**82 tests total**, covering:

**Boundary Values:**
- Both edges of every band for every threshold
- Example: CVE 79→Does Not Meet, 80→Meets Some, 94.99→Meets Some, 95→Meets

**All Shapes:**
- Simple ordered bands
- Two-sided (too high/low both fail)
- Per-cohort (different evaluations for same value)
- Compound cross-metric gates
- Stricter Surpasses thresholds

**Sustained Quarters:**
- Missing quarter gaps don't break streak
- Null/undefined filtering
- Quarter sorting regardless of insertion order
- Different required counts (2, 3, 4, 5 quarters)
- Band types (min-only, max-only, min-max)

**Edge Cases:**
- Not instrumented vs. failing
- Known defects produce warnings
- Multiple overlapping bands

### ✅ Documentation

**README.md** (`server/rubric/README.md`):
- Usage examples
- All threshold types explained with examples
- Sustained quarters semantics
- Known defects documented
- Color mapping proposal (green/amber/red)

**Color Mapping Proposal:**

**Option A (Recommended):** Three-color + badge
- 🔴 Red: Does Not Meet
- 🟡 Amber: Meets Some
- 🟢 Green: Meets
- 🟢 Green (brighter/badge): Surpasses

**Option B:** Four-color
- 🔴 Red: Does Not Meet
- 🟡 Amber: Meets Some
- 🟢 Green: Meets
- 🔵 Blue: Surpasses

## File Structure

```
modules/sdlc-report-card/
├── server/
│   └── rubric/
│       ├── evaluator.js           # Main evaluation logic
│       ├── thresholds.js          # Threshold data (33 metrics)
│       ├── sustained-checker.js   # Sustained quarters logic
│       ├── index.js               # Public API
│       └── README.md              # Documentation
└── __tests__/
    └── server/
        └── rubric/
            ├── evaluator.test.js        # 54 tests
            └── sustained-checker.test.js # 26 tests
```

## Usage Example

```javascript
const { evaluateMetric, TIERS, thresholds } = require('./server/rubric')

// Simple metric
const result = evaluateMetric(85, thresholds['cve-closure-rate'])
// => { tier: 'Meets Some Expectations' }

// Per-cohort metric
const result = evaluateMetric(
  35,
  thresholds['reactive-work-pct'],
  { cohort: 'Value-Stream' }
)
// => { tier: 'Does Not Meet Expectations' }

// With history for sustained check
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

## Out of Scope (As Specified)

- ❌ Rendering (ENGPROD-10436)
- ❌ Metric collection/computation (dbt's job)
- ❌ Snowflake integration
- ❌ Service accounts
- ❌ Real data

## Testing

All tests pass:
```bash
npm test modules/sdlc-report-card
# Test Files: 4 passed (4)
# Tests: 82 passed (82)
```

Module validation passes:
```bash
npm run validate:modules
# All modules validated successfully.
```

## Next Steps

1. **ENGPROD-10433:** Address sandbox data limitation (can't test sustained until real longitudinal data available)
2. **ENGPROD-10436:** Build rendering layer
3. **Add remaining metrics:** 27 more rows from source report card (only 6 examples implemented)
4. **Re-pull Row 29:** Source sheet has upstream fix for WIP ratio
5. **Resolve known defects:** Work with leadership to close gaps and fix overlaps in source rubric

## Traceability

Every threshold includes `sourceRow` field mapping to source report card:
- Row 6: CVE closure rate
- Rows 18-21: Epic cycle time
- Row 22: Reactive work %
- Rows 23-24: Test coverage
- Rows 29-32: WIP ratio
- Row 33: Net delivery flow
- Row 5: Code review time (with known defect)
- Rows 16-17: Deployment frequency (with known defect)
