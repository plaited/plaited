#!/usr/bin/env bun
import { chromium } from 'playwright'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolve } from 'node:path'
import { getMcpServer } from '../../../mcp.js'
import { getTestServer } from '../../../get-test-server/get-test-server.js'
import { getStorySetMetadata } from '../../../tool-get-story-set-metadata/tool-get-story-set-metadata.js'
import { toolTestStories } from '../../tool-test-stories.js'
import { useSignal } from '../../../../main.js'
import { TEST_RUNNER_EVENTS } from '../../tool-test-stories.constants.js'
import { type RunnerMessage } from '../../../../testing.js'

try {
  // Create the MCP server
  const mcpServer = getMcpServer()

  // Add error handlers BEFORE getTestServer to log errors to console
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

  // Get fixture path helper
  const getFixturePath = (filename: string) =>
    Bun.resolveSync(`../../../get-test-server/tests/fixtures/${filename}`, import.meta.dir)

  // Load all fixture story files for testing
  const storyFiles = ['simple-story.stories.tsx', 'interaction-story.stories.tsx', 'multi-story.stories.tsx']
  const entrypointsMetadata: [string, ReturnType<typeof getStorySetMetadata>][] = storyFiles.map((file) => {
    const filePath = getFixturePath(file)
    const metadata = getStorySetMetadata(filePath)
    return [filePath, metadata]
  })

  // Get project root
  const cwd = resolve(import.meta.dir, '../../../../..')

  // Use a fixed port for testing to ensure tests can connect
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

  // Don't add exit/cleanup handlers - getTestServer already has them
  // The MCP server will handle process lifecycle through the transport
} catch (error) {
  console.error('Failed to start test MCP server', error)
  process.exit(1)
}
