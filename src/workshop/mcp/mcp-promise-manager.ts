// Centralized promise management for MCP requests to avoid circular dependencies

// Promise management for MCP requests
const pendingMCPPromises = new Map<string, { resolve: Function; reject: Function }>()

// Store a promise for an MCP request
export function storeMCPPromise(requestId: string, resolve: Function, reject: Function) {
  pendingMCPPromises.set(requestId, { resolve, reject })
  
  // Set up timeout for requests (30 seconds)
  setTimeout(() => {
    if (pendingMCPPromises.has(requestId)) {
      pendingMCPPromises.delete(requestId)
      reject(new Error(`MCP request timeout for request: ${requestId}`))
    }
  }, 30000)
}

// Resolve an MCP promise (called by workshop behavioral program)
export function resolveMCPRequest(requestId: string, data?: unknown, error?: string) {
  const promise = pendingMCPPromises.get(requestId)
  if (promise) {
    if (error) {
      promise.reject(new Error(error))
    } else {
      promise.resolve({
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      })
    }
    pendingMCPPromises.delete(requestId)
  }
}

// Generate unique request IDs
export function generateMCPRequestId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}