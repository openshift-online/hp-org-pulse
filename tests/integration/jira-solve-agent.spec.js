const { test, expect } = require('@playwright/test')
const { setupErrorTracking, logCapturedErrors } = require('./helpers')

test.describe('Jira Solve Agent Module @jira-solve-agent', () => {
  test.beforeEach(async ({ page }) => setupErrorTracking(page))
  test.afterEach(async ({ page }, testInfo) => logCapturedErrors(page, testInfo))

  test('shows the module with metrics and issues from fixture data', async ({ page }) => {
    await page.goto('/#/jira-solve-agent/main')
    await page.waitForLoadState('networkidle')

    // Scoped to main: the core app shell also renders the page title in the header.
    await expect(page.getByRole('main').getByRole('heading', { name: 'OpenShift Jira Solve Agent' })).toBeVisible()

    // Verify stat cards are visible - scope to stat cards grid to avoid matching filter dropdowns and table cells
    const statCardsGrid = page.locator('.p-6.grid.gap-4')
    await expect(statCardsGrid.getByText('Total Issues')).toBeVisible()
    await expect(statCardsGrid.getByText('New')).toBeVisible()
    await expect(statCardsGrid.getByText('In Progress')).toBeVisible()
    await expect(statCardsGrid.getByText('Closed')).toBeVisible()

    // Verify fixture data issues are visible (fixture has TRT-1001, OCPBUGS-60001, TRT-1002)
    await expect(page.getByRole('link', { name: 'TRT-1001' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'OCPBUGS-60001' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'TRT-1002' })).toBeVisible()

    // Verify no console errors
    expect(page.errors).toHaveLength(0)
  })

  test('shows one row per bot PR for a ticket fixed across several repos', async ({ page }) => {
    await page.goto('/#/jira-solve-agent/main')
    await page.waitForLoadState('networkidle')

    // Fixture OCPBUGS-60002 has bot PRs in cluster-version-operator (OTA) and etcd.
    await expect(page.getByRole('link', { name: 'OCPBUGS-60002' })).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'cluster-version-operator#9001' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'etcd#9002' })).toBeVisible()

    await page.getByRole('button', { name: /^OTA/ }).click()
    await expect(page.getByRole('link', { name: 'OCPBUGS-60002' })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'cluster-version-operator#9001' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'etcd#9002' })).toHaveCount(0)
    expect(page.errors).toHaveLength(0)
  })

  test('offers ROSA as a team filter', async ({ page }) => {
    await page.goto('/#/jira-solve-agent/main')
    await page.waitForLoadState('networkidle')

    const rosa = page.getByRole('button', { name: /^ROSA/ })
    await expect(rosa).toBeVisible()
    await rosa.hover()
    const tooltip = rosa.getByRole('tooltip')
    await expect(tooltip).toContainText('34 repos')
    for (const repo of [
      'openshift-online/rosa-clusters-service', 'openshift-online/rosa-account-manager-service',
      'openshift-online/rosa-service-log', 'openshift-online/access-transparency-service',
      'openshift-online/ocm-api-model', 'openshift-online/ocm-sdk-go',
      'openshift-online/ocm-service-common', 'openshift-online/ocm-common',
      'openshift-online/rosa-clusters-cleaner', 'openshift-online/rosa-backend-tests',
      'openshift-online/rosa-hcm-deployment', 'openshift-online/ocm-api-metamodel',
      'openshift-online/ocm-cli', 'openshift/addon-operator', 'openshift/aws-account-operator',
      'openshift/aws-vpce-operator', 'openshift/certman-operator',
      'openshift/configure-alertmanager-operator', 'openshift/deadmanssnitch-operator',
      'openshift/dedicated-admin-operator',
      'openshift/gcp-project-operator', 'openshift/managed-cluster-validating-webhooks',
      'openshift/managed-node-metadata-operator', 'openshift/managed-upgrade-operator',
      'openshift/managed-velero-operator',
      'openshift/ocm-agent-operator',
      'package-operator/package-operator', 'openshift/pagerduty-operator',
      'openshift/rbac-permissions-operator', 'openshift/route-monitor-operator',
      'openshift/rosa', 'openshift-online/osd-fleet-manager',
      'terraform-redhat/terraform-rhcs-rosa-hcp', 'terraform-redhat/terraform-rhcs-rosa-classic'
    ]) {
      await expect(tooltip).toContainText(repo)
    }
    await rosa.click()

    // A ROSAENG Jira issue appears even without a bot PR.
    await expect(page.getByRole('link', { name: 'ROSAENG-42' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'TRT-1001' })).toHaveCount(0)
    expect(page.errors).toHaveLength(0)
  })

  test('filters OAPE projects, OCPBUGS components, and bot PRs', async ({ page }) => {
    await page.goto('/#/jira-solve-agent/main')
    await page.waitForLoadState('networkidle')

    const oape = page.getByRole('button', { name: /^OAPE/ })
    await expect(oape).toBeVisible()
    await oape.hover()
    const tooltip = oape.getByRole('tooltip')
    await expect(tooltip).toContainText('26 repos')
    for (const repo of [
      'must-gather', 'cert-manager-approver-policy', 'external-secrets-bitwarden-sdk-server',
      'intelliaide-lightspeed-skills', 'ocp-release-operator-sdk', 'ansible-operator-plugins',
      'secrets-store-csi-driver', 'must-gather-clean',
      'zero-trust-workload-identity-manager', 'spiffe-go-spiffe', 'ocp-secrets-management-console'
    ]) {
      await expect(tooltip).toContainText(repo)
    }
    await oape.click()

    const jiraKeys = [
      'OAPE-42', 'CM-42', 'SPIRE-42', 'SSCSI-42', 'ESO-42', 'MG-42', 'SMC-42',
      'OCPBUGS-60003', 'OCPBUGS-60004', 'TRT-1003'
    ]
    for (const key of jiraKeys) {
      await expect(page.getByRole('link', { name: key, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: 'must-gather#9010', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'must-gather-clean#9011', exact: true })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(11)
    await expect(page.getByRole('link', { name: 'TRT-1001', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /^Edge & Ecosystem/ }).click()
    for (const key of jiraKeys) {
      await expect(page.getByRole('link', { name: key, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('link', { name: 'must-gather-clean#9011', exact: true })).toHaveCount(0)

    // A bot PR in must-gather belongs to OAPE even with a TRT Jira key.
    await page.getByRole('button', { name: /^TRT/ }).click()
    await expect(page.getByRole('link', { name: 'TRT-1001', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'TRT-1003', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /^Support & Diagnostics/ }).click()
    await expect(page.getByRole('link', { name: 'must-gather#9010', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /^All Teams/ }).click()
    await expect(page.locator('tbody tr')).toHaveCount(17)
    await expect(page.getByRole('link', { name: 'CM-42', exact: true })).toHaveCount(1)
    expect(page.errors).toHaveLength(0)
  })

  test('offers Monitoring as a team filter with its repos', async ({ page }) => {
    await page.goto('/#/jira-solve-agent/main')
    await page.waitForLoadState('networkidle')

    const monitoring = page.getByRole('button', { name: /^Monitoring/ })
    await expect(monitoring).toBeVisible()
    await monitoring.hover()
    const tooltip = monitoring.getByRole('tooltip')
    await expect(tooltip).toContainText('8 repos')
    await expect(tooltip).toContainText('thanos')
    await expect(tooltip).toContainText('telemeter')
    expect(page.errors).toHaveLength(0)
  })
})
