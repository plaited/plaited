import { chromium } from 'playwright'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolve } from 'node:path'
import { getMcpServer } from '../mcp.js'
import { getTestServer } from '../get-test-server/get-test-server.js'
import { getStorySetMetadata } from '../tool-get-story-set-metadata/tool-get-story-set-metadata.js'
import { toolTestStories } from './tool-test-stories.js'
import { useSignal } from '../../main.js'
import { TEST_RUNNER_EVENTS } from './tool-test-stories.constants.js'
import type { RunnerMessage } from '../../testing.js'
import { globFiles } from '../tool-get-file-paths/glob.js'
import { STORY_GLOB_PATTERN } from './tool-test-stories.constants.js'

try {
  // Create the MCP server
  const mcpServer = getMcpServer()

  // Add error handlers
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION in test-mcp-server:', error)
    console.error('Stack:', error.stack)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION in test-mcp-server:', reason)
    if (reason instanceof Error) {
      console.error('Stack:', reason.stack)
    }
    process.exit(1)
  })

  // Launch Playwright browser
  const browser = await chromium.launch({
    headless: true,
  })

  // Get project root - assume we're running from project root
  const cwd = resolve(process.cwd(), 'src')

  // Discover all story files
  const storyFiles = await globFiles(cwd, STORY_GLOB_PATTERN)

  const entrypointsMetadata: [string, ReturnType<typeof getStorySetMetadata>][] = storyFiles.map((filePath) => {
    const metadata = getStorySetMetadata(filePath)
    return [filePath, metadata]
  })

  console.error(`Found ${entrypointsMetadata.length} story files`)

  // Use a fixed port for testing
  const testPort = 3456

  // Create a signal for runner messages
  const runnerMessage = useSignal<RunnerMessage>()

  // Create test server with signal
  const { testServer } = await getTestServer({
    cwd,
    runnerMessage,
    server: mcpServer,
    port: testPort,
    entrypointsMetadata,
  })

  const serverURL = `http://localhost:${testServer.port}`

  // Log the server URL for debugging
  console.error(`Test server running on ${serverURL}`)

  // Initialize toolTestStories behavioral program and get its trigger
  try {
    console.error('Initializing toolTestStories...')
    const behavioralTrigger = await toolTestStories({
      serverURL,
      server: mcpServer,
      browser,
      recordVideo: undefined,
    })

    runnerMessage.listen(TEST_RUNNER_EVENTS.on_runner_message, behavioralTrigger)
    console.error('toolTestStories initialized successfully')
  } catch (error) {
    console.error('Failed to initialize toolTestStories:', error)
    throw error
  }

  // Create stdio transport for communication
  const transport = new StdioServerTransport()

  // Connect the server to the transport
  console.error('Connecting MCP server to transport...')
  await mcpServer.connect(transport)
  console.error('MCP server connected, ready for requests')
} catch (error) {
  console.error('Failed to start test MCP server', error)
  process.exit(1)
}
