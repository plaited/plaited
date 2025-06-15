import eg from './eg.json' with { type: 'json' }

const server = Bun.serve({
  port: 3000,
  routes: {
    '/': Response.json(eg),
  },
})

process.on('SIGINT', async () => {
  console.log('\n...stopping server')
  process.exit()
})

process.on('uncaughtException', (error) => {
  console?.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

process.on('exit', async () => {
  await server?.stop(true)
  console.log('server stopped')
})

process.on('SIGTERM', async () => {
  console.log('\n...stopping server')
  process.exit()
})

process.on('SIGHUP', async () => {
  console.log('\n...stopping server')
  process.exit()
})
