import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const { REPO_TEAMS, AGENT_REPOS, REPO_TEAM_BY_NAME, TEAM_REPOS } = require('../../server/github/prs')

const here = dirname(fileURLToPath(import.meta.url))
const vuePath = resolve(here, '../../client/components/AgentContent.vue')

function clientTeamKeys() {
  const vue = readFileSync(vuePath, 'utf8')
  const block = vue.match(/const TEAMS = \[([\s\S]*?)\n\];/)
  if (!block) throw new Error('TEAMS list not found in AgentContent.vue')
  return [...block[1].matchAll(/key: '([^']+)'/g)].map(m => m[1])
}

describe('REPO_TEAMS', () => {
  it('derives one entry per repo from TEAM_REPOS', () => {
    const declared = Object.values(TEAM_REPOS).reduce((n, r) => n + r.length, 0)
    expect(REPO_TEAMS).toHaveLength(declared)
  })

  it('lists every repo exactly once', () => {
    expect(new Set(AGENT_REPOS).size).toBe(AGENT_REPOS.length)
  })

  it('fully qualifies every repo as owner/name', () => {
    for (const { repo } of REPO_TEAMS) {
      expect(repo).toMatch(/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*$/)
    }
  })

  it('expands bare names under openshift/ and keeps explicit orgs verbatim', () => {
    expect(REPO_TEAM_BY_NAME['openshift/velero']).toBe('oadp')
    expect(REPO_TEAM_BY_NAME['migtools/kopia']).toBe('oadp')
  })

  it('maps every repo back to its team', () => {
    for (const { repo, team } of REPO_TEAMS) {
      expect(REPO_TEAM_BY_NAME[repo]).toBe(team)
    }
  })

  it('keeps the teams that already had repos wired up', () => {
    expect(REPO_TEAM_BY_NAME['openshift/machine-config-operator']).toBe('mco')
    expect(REPO_TEAM_BY_NAME['openshift/cluster-ingress-operator']).toBe('ingress')
    expect(REPO_TEAM_BY_NAME['openshift/installer']).toBe('installer')
    expect(REPO_TEAM_BY_NAME['openshift/hypershift']).toBe('hypershift')
    expect(REPO_TEAM_BY_NAME['openshift/origin']).toBe('trt')
  })

  it('puts the OTA repos in their own team', () => {
    expect(TEAM_REPOS.ota).toEqual(['cluster-version-operator', 'cincinnati-graph-data'])
    expect(REPO_TEAM_BY_NAME['openshift/cluster-version-operator']).toBe('ota')
    expect(REPO_TEAM_BY_NAME['openshift/cincinnati-graph-data']).toBe('ota')
  })

  it('tracks the ROSA Services repos in the openshift-online org', () => {
    const repos = [
      'openshift-online/rosa-clusters-service',
      'openshift-online/rosa-account-manager-service',
      'openshift-online/rosa-service-log',
      'openshift-online/access-transparency-service'
    ]
    expect(TEAM_REPOS['rosa-services']).toEqual(repos)
    for (const repo of repos) {
      expect(AGENT_REPOS).toContain(repo)
      expect(REPO_TEAM_BY_NAME[repo]).toBe('rosa-services')
    }
  })

  it('tracks every OADP repo from the rebase bot repos.yaml plus the rebasebot org', () => {
    // Mirrors oadp-rebasebot/oadp-rebase repos.yaml (branch oadp-dev) and the
    // oadp-rebasebot org's own repos (rebase tooling).
    for (const repo of [
      'openshift/oadp-operator', 'openshift/velero',
      'openshift/velero-plugin-for-aws', 'openshift/velero-plugin-for-gcp',
      'openshift/velero-plugin-for-microsoft-azure',
      'openshift/velero-plugin-for-legacy-aws',
      'openshift/velero-plugin-for-csi', 'openshift/openshift-velero-plugin',
      'openshift/oadp-must-gather', 'openshift/restic',
      'openshift/hypershift-oadp-plugin',
      'migtools/kopia', 'migtools/filebrowser', 'migtools/udistribution',
      'migtools/oadp-vmdp', 'migtools/kubevirt-velero-plugin',
      'migtools/oadp-non-admin', 'migtools/kubevirt-datamover-controller',
      'migtools/kubevirt-datamover-plugin', 'migtools/oadp-vm-file-restore',
      'migtools/oadp-cli',
      'oadp-rebasebot/oadp-rebase'
    ]) {
      expect(REPO_TEAM_BY_NAME[repo]).toBe('oadp')
    }
    expect(TEAM_REPOS.oadp).toHaveLength(22)
  })

  it('wires Edge & Ecosystem repos to edge-ecosystem', () => {
    // Edge
    expect(REPO_TEAM_BY_NAME['openshift/microshift']).toBe('edge-ecosystem')
    expect(REPO_TEAM_BY_NAME['openshift/lvm-operator']).toBe('edge-ecosystem')
    // OAP
    expect(REPO_TEAM_BY_NAME['openshift/cert-manager-operator']).toBe('edge-ecosystem')
    expect(REPO_TEAM_BY_NAME['openshift/external-secrets-operator']).toBe('edge-ecosystem')
    // Metal Platform
    expect(REPO_TEAM_BY_NAME['openshift/baremetal-operator']).toBe('edge-ecosystem')
    expect(REPO_TEAM_BY_NAME['openshift/ironic-image']).toBe('edge-ecosystem')
    // Multi Architecture
    expect(REPO_TEAM_BY_NAME['openshift/multiarch-tuning-operator']).toBe('edge-ecosystem')
    // CID
    expect(REPO_TEAM_BY_NAME['openshift/mirror-gui']).toBe('edge-ecosystem')
  })

  it('does not double-claim repos already assigned to other teams', () => {
    // These repos belong to the Edge & Ecosystem pillar in the org data but
    // are already wired to a different team in this module.
    expect(REPO_TEAM_BY_NAME['openshift/secrets-store-csi-driver']).toBe('storage')
    expect(REPO_TEAM_BY_NAME['openshift/oc-mirror']).toBe('cluster-lifecycle')
    expect(REPO_TEAM_BY_NAME['openshift/installer']).toBe('installer')
    expect(REPO_TEAM_BY_NAME['openshift/hypershift']).toBe('hypershift')
    expect(REPO_TEAM_BY_NAME['openshift/must-gather']).toBe('support')
  })

  it('excludes the SRE-platform and lightspeed repos', () => {
    const excluded = [
      'osd-network-verifier', 'managed-cluster-config', 'managed-cluster-validating-webhooks',
      'managed-notifications', 'rbac-permissions-operator', 'certman-operator',
      'cloud-ingress-operator', 'ocm-agent', 'rosa',
      'lightspeed-agentic-operator', 'lightspeed-agentic-sandbox'
    ]
    for (const name of excluded) {
      expect(AGENT_REPOS).not.toContain(`openshift/${name}`)
    }
  })

  it('gives every team a matching button in the client TEAMS list', () => {
    const clientKeys = clientTeamKeys()
    for (const team of Object.keys(TEAM_REPOS)) {
      expect(clientKeys).toContain(team)
    }
  })
})
