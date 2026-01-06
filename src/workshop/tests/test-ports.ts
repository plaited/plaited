/**
 * Port management for workshop tests.
 *
 * @remarks
 * Provides unique ports for each test to avoid EADDRINUSE errors.
 * Uses atomic counter to ensure no port collisions between parallel tests.
 */

/** Base port for workshop tests. */
const BASE_PORT = 4000

/** Atomic counter for port assignment. */
let portCounter = 0

/**
 * Gets the next available test port.
 *
 * @returns Unique port number starting from BASE_PORT
 *
 * @remarks
 * Each call returns a new port, incrementing from 4000.
 * Safe for parallel test execution.
 */
export const getTestPort = (): number => {
  const port = BASE_PORT + portCounter
  portCounter++
  return port
}

/**
 * Resets the port counter.
 * Use in beforeAll/afterAll if needed.
 */
export const resetPortCounter = (): void => {
  portCounter = 0
}

/**
 * Checks if a port is available.
 *
 * @param port - Port number to check
 * @returns Promise resolving to true if port is available
 */
export const isPortAvailable = async (port: number): Promise<boolean> => {
  try {
    const server = Bun.serve({
      port,
      fetch: () => new Response('OK'),
    })
    server.stop()
    return true
  } catch {
    return false
  }
}

/**
 * Finds an available port starting from the given port.
 *
 * @param startPort - Port to start scanning from
 * @param maxAttempts - Maximum ports to try (default: 100)
 * @returns Promise resolving to available port
 * @throws Error if no port found within maxAttempts
 */
export const findAvailablePort = async (startPort: number = BASE_PORT, maxAttempts: number = 100): Promise<number> => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    if (await isPortAvailable(port)) {
      return port
    }
  }
  throw new Error(`No available port found after ${maxAttempts} attempts starting from ${startPort}`)
}
