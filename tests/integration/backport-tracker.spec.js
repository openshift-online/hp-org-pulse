const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

test.describe('Agentic Backports Module @backport-tracker', () => {
  test.beforeEach(async ({ page }) => setupErrorTracking(page))
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('shows Jira-backed backport metrics', async ({ page }) => {
    await page.goto('/#/backport-tracker/main')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('main').getByRole('heading', { name: 'Agentic Backports' })).toBeVisible()
    await expect(page.getByText('Total', { exact: true })).toBeVisible()
    await expect(page.getByText('Merged', { exact: true })).toBeVisible()
    await expect(page.getByText('Merge rate', { exact: true })).toBeVisible()
    expect(page.errors).toHaveLength(0)
  })
})
