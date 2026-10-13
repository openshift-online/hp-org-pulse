<template>
  <div class="max-w-3xl mx-auto px-4 py-12 text-center">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Agentic Presubmit Decision</h2>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
      This dashboard is hosted in Grafana. Redirecting&hellip;
    </p>
    <a
      :href="DASHBOARD_URL"
      class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
    >
      <ExternalLink :size="16" />
      Open in Grafana
    </a>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import { DASHBOARD_URL } from '../dashboard.js'

// Grafana sends X-Frame-Options: deny, so it cannot be embedded. Replace the
// current history entry so the browser back button returns to the prior page.
onMounted(() => {
  window.location.replace(DASHBOARD_URL)
})
</script>
