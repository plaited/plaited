import { getServer } from './get-server.ts'
import type { AgentToServerMessage, StoryMetadata } from './workshop.types.ts'

/** @internal Check if IPC is available (spawned with ipc option) */
const hasIpc = typeof process.send === 'function'

/** @internal Type guard for AgentToServerMessage */
const isAgentMessage = (msg: unknown): msg is AgentToServerMessage => {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as { type?: unknown }
  return m.type === 'get-stories'
}

/** @internal Send message to agent via IPC */
const sendToAgent = (message: { type: string; detail?: unknown }) => {
  if (hasIpc) {
    process.send!(message)
  }
}

export const useDevCommand = async ({
  cwd,
  colorScheme = 'light',
  port = 3000,
  paths,
}: {
  cwd: string
  port?: number
  colorScheme?: 'light' | 'dark'
  paths: string[]
}) => {
  const { reload, server, stories } = await getServer({
    port,
    cwd,
    paths,
    colorScheme,
  })

  const serverUrl = `http://localhost:${server.port}`

  for (const story of stories.values()) {
    console.log(`${story.exportName}:`, `${serverUrl}${story.route}`)
  }

  // IPC setup for agent communication
  if (hasIpc) {
    // Notify agent that server is ready
    sendToAgent({ type: 'server-ready', detail: { port: server.port } })

    // Handle messages from agent
    process.on('message', (message: unknown) => {
      if (!isAgentMessage(message)) return

      if (message.type === 'get-stories') {
        const storyList: StoryMetadata[] = Array.from(stories.values())
        sendToAgent({ type: 'stories', detail: storyList })
      }
    })
  }

  // Hot reload setup
  const isHotMode = process.execArgv.includes('--hot')
  if (isHotMode) {
    console.log('🔥 Hot reload mode active - changes will auto-refresh browser')
    // When Bun's --hot restarts the process, broadcast reload to connected clients
    reload()
    // Notify agent of hot reload
    if (hasIpc) {
      const storyList: StoryMetadata[] = Array.from(stories.values())
      sendToAgent({ type: 'hot-reload', detail: { stories: storyList } })
    }
  } else {
    console.log('💡 Run with "bun --hot plaited dev" to enable hot reload')
  }

  console.log('   Press Ctrl+C to exit\n')

  // Keep-alive timer (prevents process exit)
  const keepAlive = setInterval(() => {}, 1000)

  // SIGINT handler for graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⚠️  Shutting down development server...')
    clearInterval(keepAlive)
    await server.stop(true)
    console.log('✅ Server stopped')
    process.exit(0)
  })

  // Keep process alive (no exit - wait for SIGINT or hot reload)
  // The setInterval keeps the event loop running
}
