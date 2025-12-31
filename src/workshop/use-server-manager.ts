/**
 * @module use-server-manager
 *
 * Behavioral program factory for managing the workshop dev server.
 *
 * @remarks
 * Provides a `useBehavioral`-based interface for spawning and communicating
 * with the workshop dev server via IPC. Enables bidirectional BPEvent
 * communication between agent and browser clients.
 *
 * @public
 */

import { join } from 'node:path'
import type { Subprocess } from 'bun'
import type { BPEvent } from '../main.ts'
import { isBPEvent, useBehavioral } from '../main.ts'
import type { AgentToServerMessage, StoryMetadata } from './workshop.types.ts'

/**
 * Wait for server ready signal via polling.
 */
const waitForReady = (proc: Subprocess, readyRef: { value: boolean }): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Dev server start timeout'))
    }, 30000)

    const check = () => {
      if (readyRef.value) {
        clearTimeout(timeout)
        resolve()
      } else if (proc.exitCode !== null) {
        clearTimeout(timeout)
        reject(new Error('Dev server process exited'))
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

/**
 * Behavioral program factory for managing the workshop dev server.
 *
 * @remarks
 * Spawns the dev server with `bun --hot` for hot reloading and IPC
 * for bidirectional BPEvent communication between agent and browser clients.
 *
 * @example
 * ```typescript
 * const trigger = await useServerManager({
 *   cwd: process.cwd(),
 *   port: 3000,
 *   paths: ['src/'],
 *   onClientEvent: (event) => console.log('Client event:', event),
 *   onHotReload: (stories) => console.log('Hot reload:', stories.length, 'stories'),
 *   onReady: (port) => console.log('Server ready on port', port),
 * })
 *
 * // Send event to all browser clients
 * trigger({ type: 'broadcast', detail: { type: 'agent-ready' } })
 *
 * // Request stories (response via onStories callback or 'stories' event)
 * trigger({ type: 'get-stories' })
 *
 * // Stop the server
 * trigger({ type: 'stop' })
 * ```
 *
 * @public
 */
export const useServerManager = useBehavioral<
  {
    'server-ready': { port: number }
    'hot-reload': { stories: StoryMetadata[] }
    'client-event': BPEvent
    stories: StoryMetadata[]
  },
  {
    /** Current working directory (project root) */
    cwd: string
    /** Server port number (default: 3000) */
    port?: number
    /** Paths to search for stories */
    paths: string[]
    /** Color scheme for browser context */
    colorScheme?: 'light' | 'dark'
    /** Called when a browser client sends a BPEvent */
    onClientEvent?: (event: BPEvent) => void
    /** Called when hot reload occurs */
    onHotReload?: (stories: StoryMetadata[]) => void
    /** Called when server is ready */
    onReady?: (port: number) => void
    /** Called when stories response is received */
    onStories?: (stories: StoryMetadata[]) => void
  }
>({
  publicEvents: ['broadcast', 'get-stories', 'stop'],
  async bProgram({
    cwd,
    port = 3000,
    paths,
    colorScheme = 'light',
    onClientEvent,
    onHotReload,
    onReady,
    onStories,
    trigger,
  }) {
    // Track ready state for waitForReady polling
    const readyRef = { value: false }

    // Path to the CLI
    const cliPath = join(import.meta.dir, 'cli.ts')

    // Spawn dev server with IPC
    const proc = Bun.spawn(
      ['bun', '--hot', cliPath, 'dev', '-d', cwd, '-p', String(port), '--color-scheme', colorScheme, ...paths],
      {
        cwd,
        ipc: (message) => {
          if (isBPEvent(message)) {
            switch (message.type) {
              case 'server-ready':
                readyRef.value = true
                trigger({ type: 'server-ready', detail: message.detail })
                break
              case 'hot-reload':
                trigger({ type: 'hot-reload', detail: message.detail })
                break
              case 'client-event':
                trigger({ type: 'client-event', detail: message.detail })
                break
              case 'stories':
                trigger({ type: 'stories', detail: message.detail })
                break
            }
          }
        },
      },
    )

    // Wait for server ready
    await waitForReady(proc, readyRef)

    // Return event handlers
    return {
      'server-ready'({ port }) {
        onReady?.(port)
      },
      'hot-reload'({ stories }) {
        onHotReload?.(stories)
      },
      'client-event'(event) {
        onClientEvent?.(event)
      },
      stories(storyList) {
        onStories?.(storyList)
      },
      broadcast(event: BPEvent) {
        // Send BPEvent directly - get-server.ts validates and broadcasts to clients
        proc.send(event)
      },
      'get-stories'() {
        const message: AgentToServerMessage = { type: 'get-stories' }
        proc.send(message)
      },
      async stop() {
        proc.kill('SIGINT')
        await proc.exited
      },
    }
  },
})

/**
 * Get the server port after initialization.
 *
 * @remarks
 * Since useServerManager returns a trigger function, port access is provided
 * via the onReady callback in context. Store the port there if needed.
 */
export type { StoryMetadata }
