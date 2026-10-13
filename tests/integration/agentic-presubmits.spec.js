const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

const DASHBOARD_URL = 'https://grafana-loki.ci.openshift.org/d/5jn__Hrvk/chai-presubmits-agent-performance?orgId=1'

test.describe('Agentic Presubmit Decision Module @agentic-presubmits', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page)
    // Stub the external Grafana dashboard so tests never leave the sandbox.
    await page.route('https://grafana-loki.ci.openshift.org/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Grafana stub</h1>' })
    )
  })
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('sidebar link redirects to the Grafana dashboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Agentic Presubmit Decision', exact: true }).first().click()
    await page.locator('aside nav').getByRole('button', { name: 'Agentic Presubmit Decision', exact: true }).last().click()

    await expect(page).toHaveURL(DASHBOARD_URL)
  })
})
