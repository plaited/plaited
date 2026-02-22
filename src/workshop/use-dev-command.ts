// import { getServer } from './get-server.ts'

// export const useDevCommand = async ({
//   cwd,
//   colorScheme = 'light',
//   port = 3000,
//   paths,
// }: {
//   cwd: string
//   port?: number
//   colorScheme?: 'light' | 'dark'
//   paths: string[]
// }) => {
//   const { reload, server, stories } = await getServer({
//     port,
//     cwd,
//     paths,
//     colorScheme,
//   })

//   const serverUrl = `http://localhost:${server.port}`

//   for (const story of stories.values()) {
//     console.log(`${story.exportName}:`, `${serverUrl}${story.route}`)
//   }

//   // Hot reload setup
//   const isHotMode = process.execArgv.includes('--hot')
//   if (isHotMode) {
//     console.log('🔥 Hot reload mode active - changes will auto-refresh browser')
//     // When Bun's --hot restarts the process, broadcast reload to connected clients
//     reload()
//   } else {
//     console.log('💡 Run with "bun --hot plaited dev" to enable hot reload')
//   }

//   console.log('   Press Ctrl+C to exit\n')

//   // Keep-alive timer (prevents process exit)
//   const keepAlive = setInterval(() => {}, 1000)

//   // SIGINT handler for graceful shutdown
//   process.on('SIGINT', async () => {
//     console.log('\n⚠️  Shutting down development server...')
//     clearInterval(keepAlive)
//     await server.stop(true)
//     console.log('✅ Server stopped')
//     process.exit(0)
//   })

//   // Keep process alive (no exit - wait for SIGINT or hot reload)
//   // The setInterval keeps the event loop running
// }
