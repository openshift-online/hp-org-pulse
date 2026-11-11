/**
 * Sustained Quarters Checker
 *
 * Determines whether a metric has sustained a performance level
 * for a required number of consecutive quarters.
 *
 * ## Quarter Boundary Semantics
 *
 * A quarter is defined as a calendar quarter:
 * - Q1: Jan 1 - Mar 31
 * - Q2: Apr 1 - Jun 30
 * - Q3: Jul 1 - Sep 30
 * - Q4: Oct 1 - Dec 31
 *
 * ## Missing Quarter Handling
 *
 * When a quarter has no observation:
 * - The gap DOES NOT break the streak
 * - The gap DOES NOT count toward the sustained requirement
 * - Consecutive quarters are those with observations, regardless of calendar gaps
 *
 * Example: Observations in Q1, Q3, Q4 with Q2 missing
 * - If all three observed quarters meet the threshold, that counts as 3 consecutive quarters
 * - The missing Q2 is skipped, not treated as a failure
 *
 * Rationale: Metrics may not be collected every quarter due to:
 * - New metric rollout mid-year
 * - Data pipeline issues
 * - Team reorganization
 *
 * Treating gaps as failures would punish teams for data collection issues
 * rather than actual performance.
 *
 * ## Sustained Check Algorithm
 *
 * To achieve "sustained" status:
 * 1. Count backwards from the most recent quarter with an observation
 * 2. Count consecutive quarters (skipping missing data) that meet the threshold
 * 3. If the count reaches the required number, the metric is sustained
 * 4. If a quarter fails the threshold, the streak breaks and the check fails
 *
 * @param {number} currentValue - Current metric value
 * @param {Object} band - Target band with min/max thresholds
 * @param {Array<Object>} history - Historical observations
 * @param {number} requiredQuarters - Number of consecutive quarters required (default: 3)
 * @returns {Object} { isSustained: boolean, consecutiveQuarters: number, details: string }
 */
function checkSustainedQuarters(currentValue, band, history, requiredQuarters = 3, currentQuarter = null) {
  // Use provided currentQuarter or get the current one
  const quarter = currentQuarter || getCurrentQuarter()

  // Filter out any existing observations for the current quarter to avoid duplicates
  const filteredHistory = history.filter(obs => obs.quarter !== quarter)

  // Include current value in the check
  const allObservations = [
    ...filteredHistory,
    { value: currentValue, quarter }
  ]

  // Sort by quarter (most recent first)
  const sorted = allObservations
    .filter(obs => obs.value !== null && obs.value !== undefined)
    .sort((a, b) => compareQuarters(b.quarter, a.quarter))

  if (sorted.length === 0) {
    return {
      isSustained: false,
      consecutiveQuarters: 0,
      details: 'No observations available'
    }
  }

  // Count consecutive quarters that meet the threshold
  let consecutiveCount = 0

  for (const observation of sorted) {
    const { value } = observation

    // Check if this observation meets the threshold
    if (isInBand(value, band)) {
      consecutiveCount++

      // Check if we've reached the required count
      if (consecutiveCount >= requiredQuarters) {
        return {
          isSustained: true,
          consecutiveQuarters: consecutiveCount,
          details: `Sustained for ${consecutiveCount} consecutive quarters`
        }
      }
    } else {
      // Threshold not met - streak breaks
      return {
        isSustained: false,
        consecutiveQuarters: consecutiveCount,
        details: `Streak broken at ${observation.quarter} (value: ${value})`
      }
    }
  }

  // Have some consecutive quarters but not enough
  return {
    isSustained: false,
    consecutiveQuarters: consecutiveCount,
    details: `Only ${consecutiveCount} consecutive quarters (need ${requiredQuarters})`
  }
}

/**
 * Check if a value is within a band's range.
 *
 * @param {number} value - Value to check
 * @param {Object} band - Band with optional min/max
 * @returns {boolean} True if value is in range
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

  return true
}

/**
 * Get the current quarter in YYYY-QN format.
 *
 * @returns {string} Quarter identifier (e.g., "2026-Q4")
 */
function getCurrentQuarter() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 0-indexed
  const quarter = Math.ceil(month / 3)
  return `${year}-Q${quarter}`
}

/**
 * Compare two quarter strings.
 *
 * @param {string} q1 - First quarter (e.g., "2026-Q3")
 * @param {string} q2 - Second quarter
 * @returns {number} -1 if q1 < q2, 0 if equal, 1 if q1 > q2
 */
function compareQuarters(q1, q2) {
  const [year1, quarter1] = parseQuarter(q1)
  const [year2, quarter2] = parseQuarter(q2)

  if (year1 !== year2) {
    return year1 - year2
  }
  return quarter1 - quarter2
}

/**
 * Parse a quarter string into year and quarter number.
 *
 * @param {string} quarterStr - Quarter string (e.g., "2026-Q3")
 * @returns {[number, number]} [year, quarter]
 */
function parseQuarter(quarterStr) {
  const match = quarterStr.match(/^(\d{4})-Q(\d)$/)
  if (!match) {
    throw new Error(`Invalid quarter format: ${quarterStr}. Expected YYYY-QN`)
  }
  const year = parseInt(match[1], 10)
  const quarter = parseInt(match[2], 10)

  // Validate quarter is between 1 and 4
  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter value: Q${quarter}. Expected Q1-Q4`)
  }

  return [year, quarter]
}

module.exports = {
  checkSustainedQuarters,
  getCurrentQuarter,
  compareQuarters,
  parseQuarter
}
