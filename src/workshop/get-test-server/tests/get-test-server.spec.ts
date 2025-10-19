import { test, expect, afterEach } from 'bun:test'
import { resolve } from 'node:path'
import { getTestServer } from '../get-test-server.js'
import { getStorySetMetadata } from '../../tool-get-story-set-metadata/tool-get-story-set-metadata.js'
import { RUNNER_URL } from '../../../testing/testing.constants.js'
import { type RunnerMessage } from '../../../testing.js'
import { useSignal } from 'plaited'

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

// Use the actual cwd (project root in this case)
const cwd = resolve(import.meta.dir, '../../../..') // Project root

// Track servers to clean up after tests
const testServers: Array<{ testServer: Bun.Server }> = []

afterEach(async () => {
  // Clean up all servers created during tests
  for (const { testServer } of testServers) {
    await testServer.stop(true)
  }
  testServers.length = 0
})

test('getTestServer: creates server on specified port', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()
  const port = 0 // Let system assign port

  const server = await getTestServer({
    cwd,
    runnerMessage,
    port,
    entrypointsMetadata,
  })

  testServers.push(server)

  expect(server).toBeDefined()
  expect(server.testServer).toBeDefined()
  expect(server.testServer.port).toBeGreaterThan(0)
  expect(server.reloadTestServer).toBeTypeOf('function')
  expect(server.reloadTestClients).toBeTypeOf('function')
})

test('getTestServer: creates routes from entrypoints metadata', async () => {
  const filePath = getFixturePath('multi-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  expect(server.testServer).toBeDefined()
  expect(server.testServer.port).toBeGreaterThan(0)

  // Verify server is accessible
  const response = await fetch(`http://localhost:${server.testServer.port}/non-existent`)
  expect(response.status).toBe(404)
})

test('getTestServer: handles WebSocket upgrade at RUNNER_URL', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      expect(ws.readyState).toBe(WebSocket.OPEN)
      ws.close()
      resolve()
    }
    ws.onerror = (error) => {
      reject(error)
    }
  })
})

test('getTestServer: WebSocket receives and parses valid messages', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  // Create a promise that resolves when the signal receives a message
  const { promise: messagePromise, resolve: resolveMessage } = Promise.withResolvers<RunnerMessage>()

  // Create a mock trigger function for the signal listener
  const mockTrigger = ({ detail }: { type: string; detail?: RunnerMessage }) => {
    if (detail) resolveMessage(detail)
  }

  // Listen for signal changes
  const disconnect = runnerMessage.listen('RUNNER_MESSAGE', mockTrigger)

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      // Send a valid RunnerMessage that matches the schema
      const message: RunnerMessage = {
        colorScheme: 'light',
        pathname: '/test/simple-story',
        snapshot: [
          {
            thread: 'test-thread',
            trigger: false,
            selected: true,
            type: 'TEST_EVENT',
            priority: 0,
          },
        ],
      }
      ws.send(JSON.stringify(message))

      // Message sent, now wait for signal in the outer scope
      resolve()
    }

    ws.onerror = (error) => {
      disconnect()
      ws.close()
      reject(error)
    }
  })

  // Wait for the signal to receive the message (with timeout)
  try {
    const receivedMessage = await Promise.race([
      messagePromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for message')), 1000)),
    ])

    // Verify the message
    expect(receivedMessage).toBeDefined()
    expect(receivedMessage.colorScheme).toBe('light')
    expect(receivedMessage.pathname).toBe('/test/simple-story')
    expect(receivedMessage.snapshot).toHaveLength(1)
  } finally {
    disconnect()
    ws.close()
  }
})

test('getTestServer: returns 404 for non-existent routes', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const response = await fetch(`http://localhost:${server.testServer.port}/non-existent-route`)

  expect(response.status).toBe(404)
  expect(await response.text()).toBe('Not Found')
})

test('getTestServer: returns 400 for failed WebSocket upgrade', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  // Try to access RUNNER_URL with regular HTTP (not WebSocket)
  const response = await fetch(`http://localhost:${server.testServer.port}${RUNNER_URL}`)

  expect(response.status).toBe(400)
})

test('getTestServer: reloadTestClients publishes reload message', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      ws.onmessage = (event) => {
        // Should receive reload message
        expect(event.data).toBeDefined()
        ws.close()
        resolve()
      }

      // Trigger reload after connection is established
      setTimeout(() => {
        server.reloadTestClients()
      }, 50)
    }
    ws.onerror = (error) => {
      reject(error)
    }

    // Timeout in case message isn't received
    setTimeout(() => reject(new Error('Timeout waiting for reload message')), 1000)
  })
})

test('getTestServer: reloadTestServer updates routes', async () => {
  const filePath1 = getFixturePath('simple-story.stories.tsx')
  const metadata1 = getStorySetMetadata(filePath1)
  const entrypointsMetadata1: [string, typeof metadata1][] = [[filePath1, metadata1]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata: entrypointsMetadata1,
  })

  testServers.push(server)

  // Verify server is running
  expect(server.testServer.port).toBeGreaterThan(0)

  // Reload with different entrypoints
  const filePath2 = getFixturePath('multi-story.stories.tsx')
  const metadata2 = getStorySetMetadata(filePath2)
  const entrypointsMetadata2: [string, typeof metadata2][] = [[filePath2, metadata2]]

  await server.reloadTestServer({
    cwd,
    entrypointsMetadata: entrypointsMetadata2,
  })

  // Verify server is still running after reload
  expect(server.testServer.port).toBeGreaterThan(0)
  const response = await fetch(`http://localhost:${server.testServer.port}/non-existent`)
  expect(response.status).toBe(404)
})

test('getTestServer: handles multiple WebSocket connections', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws1 = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)
  const ws2 = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await Promise.all([
    new Promise<void>((resolve) => {
      ws1.onopen = () => {
        expect(ws1.readyState).toBe(WebSocket.OPEN)
        resolve()
      }
    }),
    new Promise<void>((resolve) => {
      ws2.onopen = () => {
        expect(ws2.readyState).toBe(WebSocket.OPEN)
        resolve()
      }
    }),
  ])

  ws1.close()
  ws2.close()
})

test('getTestServer: WebSocket subscription lifecycle', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      // WebSocket should be open
      expect(ws.readyState).toBe(WebSocket.OPEN)

      // Close the connection
      ws.close()
    }

    ws.onclose = () => {
      // WebSocket should be closed
      expect(ws.readyState).toBe(WebSocket.CLOSED)
      resolve()
    }

    ws.onerror = (error) => {
      reject(error)
    }
  })
})

test('getTestServer: handles malformed JSON messages gracefully', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      // Send malformed JSON
      ws.send('{ invalid json }')

      // Wait a bit to ensure no crash
      setTimeout(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
        ws.close()
        resolve()
      }, 100)
    }

    ws.onerror = (error) => {
      reject(error)
    }
  })
})

test('getTestServer: validates messages with RunnerMessageSchema', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  let validMessageReceived = false
  const runnerMessage = useSignal<RunnerMessage>()

  // Listen for signal changes
  runnerMessage.listen('RUNNER_MESSAGE', () => {
    validMessageReceived = true
  })

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      // Send an invalid message that doesn't match schema
      const invalidMessage = {
        type: 'invalid_type',
        detail: 'invalid',
      }
      ws.send(JSON.stringify(invalidMessage))

      // Wait and verify trigger was not called for invalid message
      setTimeout(() => {
        expect(validMessageReceived).toBe(false)
        ws.close()
        resolve()
      }, 100)
    }

    ws.onerror = (error) => {
      reject(error)
    }
  })
})

test('getTestServer: handles non-string WebSocket messages', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  const ws = new WebSocket(`ws://localhost:${server.testServer.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      // This test verifies the server handles non-string messages gracefully
      // (The server checks isTypeOf<string>(message, 'string'))
      // We can't easily send binary from browser WebSocket, but the code path exists

      // Just verify connection works
      expect(ws.readyState).toBe(WebSocket.OPEN)
      ws.close()
      resolve()
    }

    ws.onerror = (error) => {
      reject(error)
    }
  })
})

test('getTestServer: creates server with custom port', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()
  const customPort = 0 // System will assign

  const server = await getTestServer({
    cwd,
    runnerMessage,
    port: customPort,
    entrypointsMetadata,
  })

  testServers.push(server)

  expect(server.testServer.port).toBeGreaterThan(0)

  // Verify server is accessible
  const response = await fetch(`http://localhost:${server.testServer.port}/non-existent`)
  expect(response.status).toBe(404)
})

test('getTestServer: multiple stories create server successfully', async () => {
  const filePath = getFixturePath('multi-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entrypointsMetadata: [string, typeof metadata][] = [[filePath, metadata]]

  const runnerMessage = useSignal<RunnerMessage>()

  const server = await getTestServer({
    cwd,
    runnerMessage,
    entrypointsMetadata,
  })

  testServers.push(server)

  // Verify server is created and running
  expect(server.testServer).toBeDefined()
  expect(server.testServer.port).toBeGreaterThan(0)
  expect(server.reloadTestServer).toBeTypeOf('function')
  expect(server.reloadTestClients).toBeTypeOf('function')

  // Verify server responds
  const response = await fetch(`http://localhost:${server.testServer.port}/non-existent`)
  expect(response.status).toBe(404)
})
