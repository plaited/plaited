#!/usr/bin/env bun
/**
 * Start the dev server and return story URLs.
 *
 * Usage: bun preview-start.ts [paths...] [--port <port>]
 *
 * @example
 * bun preview-start.ts
 * bun preview-start.ts src/components --port 3500
 */

import { parseArgs } from 'node:util'
import { useServerManager } from 'plaited/workshop'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: '3000',
    },
  },
  allowPositionals: true,
})

const paths = positionals.length > 0 ? positionals : [process.cwd()]
const port = parseInt(values.port ?? '3000', 10)
const cwd = process.cwd()

console.error('Starting dev server...')

try {
  const trigger = await useServerManager({
    cwd,
    port,
    paths,
    onReady(serverPort) {
      console.error(`Server ready on port ${serverPort}`)
    },
    onStories(stories) {
      console.log(
        JSON.stringify(
          {
            serverUrl: `http://localhost:${port}`,
            stories: stories.map((s) => ({
              exportName: s.exportName,
              route: s.route,
              filePath: s.filePath,
            })),
          },
          null,
          2,
        ),
      )
    },
  })

  // Request stories
  trigger({ type: 'get-stories' })

  // Keep process running
  process.on('SIGINT', () => {
    trigger({ type: 'stop' })
    process.exit(0)
  })
} catch (error) {
  console.error(`Error: ${error}`)
  process.exit(1)
}
