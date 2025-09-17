export const getTestServer = ({}: {}) => {
  const testServer = Bun.serve({
    port: 0, // Let system assign available port
    routes: await getRoutes(),
    async fetch(req: Request, server: Bun.Server) {
      const { pathname } = new URL(req.url)
      if (pathname === RUNNER_URL) {
        const success = server.upgrade(req)
        return success ? undefined : new Response('WebSocket upgrade error', { status: 400 })
      }
      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      open(ws) {
        ws.subscribe(RELOAD_TOPIC)
      },
      message(ws, message) {
        if (!isTypeOf<string>(message, 'string')) return
        try {
          const json = JSON.parse(message)
          const detail = RunnerMessageSchema.parse(json)
          trigger?.({ type: TEST_RUNNER_EVENTS.on_runner_message, detail })
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error('Validation failed:', error.issues)
          } else {
            console.error('JSON parsing or other error:', error)
          }
        }
      },
      close(ws) {
        ws.unsubscribe(RELOAD_TOPIC)
      },
    },
  })
}
