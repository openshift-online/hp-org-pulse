/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage: _storage, requireScope } = context

  /**
   * @openapi
   * /api/modules/sdlc-report-card/hello:
   *   get:
   *     tags: [SDLC Report Card]
   *     summary: Hello endpoint
   *     responses:
   *       200:
   *         description: Success
   */
  router.get('/hello', requireScope('sdlc-report-card:read'), function(req, res) {
    res.json({ message: 'Hello from SDLC Report Card!' })
  })

  // Optional: register diagnostics (shown in admin health check)
  context.registerDiagnostics(async function() {
    return { status: 'ok' }
  })
}
