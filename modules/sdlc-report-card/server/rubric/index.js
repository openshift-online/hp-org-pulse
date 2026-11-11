/**
 * SDLC Report Card Rubric Evaluator
 *
 * Main entry point for the rubric evaluation system.
 */

const { evaluateMetric, TIERS } = require('./evaluator')
const thresholds = require('./thresholds')
const { checkSustainedQuarters } = require('./sustained-checker')

module.exports = {
  evaluateMetric,
  TIERS,
  thresholds,
  checkSustainedQuarters
}
