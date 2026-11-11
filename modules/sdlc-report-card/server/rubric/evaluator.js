/**
 * SDLC Report Card Rubric Evaluator
 *
 * Given a metric value, threshold definition, and subject's cohort,
 * returns the performance tier or "not yet instrumented".
 */

const { checkSustainedQuarters } = require('./sustained-checker')

/**
 * Tier constants
 */
const TIERS = {
  DOES_NOT_MEET: 'Does Not Meet Expectations',
  MEETS_SOME: 'Meets Some Expectations',
  MEETS: 'Meets Expectations',
  SURPASSES: 'Surpasses',
  NOT_INSTRUMENTED: 'not yet instrumented'
}

/**
 * Evaluate a metric value against its threshold definition.
 *
 * @param {number|null|undefined} value - The metric value to evaluate
 * @param {Object} threshold - Threshold definition from thresholds.js
 * @param {Object} options - Evaluation options
 * @param {string} [options.cohort] - Subject's cohort (for per-cohort thresholds)
 * @param {Object} [options.crossMetrics] - Other metric values (for compound thresholds)
 * @param {Array} [options.history] - Historical values for sustained checks
 * @returns {Object} { tier: string, reason?: string, warnings?: string[] }
 */
function evaluateMetric(value, threshold, options = {}) {
  const { cohort, crossMetrics = {}, history = [] } = options

  // Handle not-yet-instrumented case
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { tier: TIERS.NOT_INSTRUMENTED }
  }

  // Route to appropriate handler based on threshold type
  switch (threshold.type) {
    case 'ordered-bands':
      return evaluateOrderedBands(value, threshold, history)

    case 'two-sided':
      return evaluateTwoSided(value, threshold, history)

    case 'per-cohort':
      return evaluatePerCohort(value, threshold, cohort, history)

    case 'compound':
      return evaluateCompound(value, threshold, crossMetrics, history)

    default:
      throw new Error(`Unknown threshold type: ${threshold.type}`)
  }
}

/**
 * Evaluate ordered bands (simple higher-is-better or lower-is-better).
 *
 * @param {number} value - Metric value
 * @param {Object} threshold - Threshold definition
 * @param {Array} history - Historical values
 * @returns {Object} Evaluation result
 */
function evaluateOrderedBands(value, threshold, history) {
  const { bands, sustainedQuarters } = threshold
  const warnings = []

  // Find matching band
  let matchedTier = null
  let matchedBand = null
  const matchedBands = []

  for (const band of bands) {
    if (isInBand(value, band)) {
      matchedBands.push(band)
      matchedTier = band.tier
      matchedBand = band
    }
  }

  // Warn about overlaps, but not for shared boundaries
  if (matchedBands.length > 1) {
    // Check if the matched bands share only a boundary value
    const isSharedBoundary = matchedBands.every((b1, i) =>
      matchedBands.slice(i + 1).every(b2 =>
        (b1.max === value && b2.min === value) ||
        (b1.min === value && b2.max === value)
      )
    )

    if (!isSharedBoundary) {
      warnings.push(`Value ${value} matches multiple bands: ${matchedBands.map(b => b.tier).join(', ')}`)
    }
  }

  // Check for gaps - value doesn't match any band
  if (!matchedTier) {
    warnings.push(`Value ${value} does not match any tier band - gap in threshold definition`)
    // Default to lowest tier when in a gap
    matchedTier = TIERS.DOES_NOT_MEET
  }

  // Handle sustained quarters check for Surpasses tier
  if (matchedTier === TIERS.SURPASSES && sustainedQuarters) {
    const sustained = checkSustainedQuarters(
      value,
      matchedBand,
      history,
      sustainedQuarters
    )
    if (!sustained.isSustained) {
      // Meets criteria but not sustained - downgrade to Meets
      return {
        tier: TIERS.MEETS,
        reason: `Not sustained for ${sustainedQuarters} quarters (${sustained.consecutiveQuarters} consecutive)`,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    }
  }

  return {
    tier: matchedTier,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * Evaluate two-sided bands where too high or too low both fail.
 *
 * @param {number} value - Metric value
 * @param {Object} threshold - Threshold definition
 * @param {Array} _history - Historical values (reserved for future use)
 * @returns {Object} Evaluation result
 */
function evaluateTwoSided(value, threshold, _history) {
  const { bands } = threshold
  const warnings = []

  let matchedTier = null
  let matchedReason = null
  const matchedBands = []

  for (const band of bands) {
    if (isInBand(value, band)) {
      matchedBands.push(band)
      matchedTier = band.tier
      matchedReason = band.reason
    }
  }

  // Warn about overlaps, but not for shared boundaries
  if (matchedBands.length > 1) {
    const conflictingTiers = matchedBands.some((b1, i) =>
      matchedBands.slice(i + 1).some(b2 => b1.tier !== b2.tier)
    )

    // Check if the matched bands share only a boundary value
    const isSharedBoundary = matchedBands.every((b1, i) =>
      matchedBands.slice(i + 1).every(b2 =>
        (b1.max === value && b2.min === value) ||
        (b1.min === value && b2.max === value)
      )
    )

    if (conflictingTiers && !isSharedBoundary) {
      warnings.push(`Value ${value} matches multiple conflicting tiers`)
    }
  }

  if (!matchedTier) {
    warnings.push(`Value ${value} does not match any tier band`)
    matchedTier = TIERS.DOES_NOT_MEET
  }

  return {
    tier: matchedTier,
    reason: matchedReason,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * Evaluate per-cohort thresholds.
 *
 * @param {number} value - Metric value
 * @param {Object} threshold - Threshold definition
 * @param {string} cohort - Subject's cohort
 * @param {Array} history - Historical values
 * @returns {Object} Evaluation result
 */
function evaluatePerCohort(value, threshold, cohort, history) {
  if (!cohort) {
    return {
      tier: TIERS.NOT_INSTRUMENTED,
      reason: 'Cohort required but not provided'
    }
  }

  // Use hasOwnProperty to avoid prototype pollution
  const cohortThreshold = Object.prototype.hasOwnProperty.call(threshold.cohorts, cohort)
    ? threshold.cohorts[cohort]
    : undefined

  if (!cohortThreshold) {
    return {
      tier: TIERS.NOT_INSTRUMENTED,
      reason: `No threshold defined for cohort: ${cohort}`
    }
  }

  // Recursively evaluate using the cohort-specific threshold
  return evaluateMetric(value, cohortThreshold, { history })
}

/**
 * Evaluate compound thresholds that depend on multiple metrics.
 *
 * @param {number} value - Primary metric value
 * @param {Object} threshold - Threshold definition
 * @param {Object} crossMetrics - Other metric values
 * @param {Array} history - Historical values
 * @returns {Object} Evaluation result
 */
function evaluateCompound(value, threshold, crossMetrics, history) {
  const { baseTier, surpassesRequires } = threshold

  // First evaluate the base metric normally
  const baseResult = evaluateMetric(value, baseTier, { history })

  // If not already at Meets tier, can't achieve Surpasses
  if (baseResult.tier !== TIERS.MEETS) {
    return baseResult
  }

  // Check all Surpasses requirements
  const unmetRequirements = []

  for (const requirement of surpassesRequires) {
    const { metric, condition, min, max, sustainedQuarters } = requirement

    if (condition === 'within-target-range') {
      // Check if the cross-metric is in its target range
      const metricValue = crossMetrics[metric]
      if (!metricValue || !metricValue.isInTargetRange) {
        unmetRequirements.push(`${metric} not in target range`)
      }
    } else if (min !== undefined || max !== undefined) {
      // Check if cross-metric is within specified bounds
      const metricValue = crossMetrics[metric]?.value
      if (metricValue === null || metricValue === undefined) {
        unmetRequirements.push(`${metric} not instrumented`)
      } else if ((min !== undefined && metricValue < min) ||
                 (max !== undefined && metricValue > max)) {
        unmetRequirements.push(`${metric} out of range (${metricValue})`)
      } else if (sustainedQuarters) {
        // Check sustained requirement for cross-metric
        const sustained = checkSustainedQuarters(
          metricValue,
          { min, max },
          crossMetrics[metric]?.history || [],
          sustainedQuarters
        )
        if (!sustained.isSustained) {
          unmetRequirements.push(
            `${metric} not sustained for ${sustainedQuarters} quarters`
          )
        }
      }
    } else if (condition !== undefined) {
      // Unknown condition type - fail fast
      throw new Error(`Unknown requirement condition: ${condition}`)
    } else {
      // No min, max, or recognized condition
      throw new Error(`Invalid requirement: must have min/max or recognized condition`)
    }
  }

  if (unmetRequirements.length > 0) {
    return {
      tier: TIERS.MEETS,
      reason: `Surpasses requirements not met: ${unmetRequirements.join(', ')}`
    }
  }

  return { tier: TIERS.SURPASSES }
}

/**
 * Check if a value falls within a band's range.
 *
 * @param {number} value - Value to check
 * @param {Object} band - Band definition with optional min/max
 * @returns {boolean} True if value is in band
 */
function isInBand(value, band) {
  const { min, max } = band

  if (min !== undefined && max !== undefined) {
    return value >= min && value <= max
  } else if (min !== undefined) {
    return value >= min
  } else if (max !== undefined) {
    return value <= max
  }

  // Band with no min or max matches everything (shouldn't happen)
  return true
}

module.exports = {
  evaluateMetric,
  TIERS
}
