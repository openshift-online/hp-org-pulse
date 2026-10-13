import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MainView from '../../client/views/MainView.vue'
import { DASHBOARD_URL } from '../../client/dashboard.js'

describe('Agentic Presubmit Decision MainView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to the Grafana dashboard and renders a fallback link', () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })

    const wrapper = mount(MainView)

    expect(replace).toHaveBeenCalledWith(DASHBOARD_URL)
    expect(wrapper.get('a').attributes('href')).toBe(DASHBOARD_URL)
    expect(wrapper.text()).toContain('Agentic Presubmit Decision')
  })
})
