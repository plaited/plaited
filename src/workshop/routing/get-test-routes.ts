import type { TestParams, TestRoutes } from '../workshop.types'

export const getTestRoutes = ({ params, assetServer }: { params: TestParams[]; assetServer: Bun.Server }) => {
  const toRet: TestRoutes = {}
  for (const { route, headers: storyHeadersFn } of params) {
    toRet[route] = async () => {
      // 1. Get the story-specific headers intended for the client
      const clientHeaders = new Headers((await storyHeadersFn?.(process.env)) || {})

      // 2. Fetch the content from the assetServer.
      const assetServerResponse = await fetch(new URL(route, assetServer.url))

      // If the assetServer failed to provide the content, propagate its response.
      if (!assetServerResponse.ok) {
        return assetServerResponse
      }

      // 3. Construct a new Response to send to the client.
      // Use the body from the assetServer's response.
      // The headers for this new response will be our clientHeaders.

      // It's important to preserve certain headers from the assetServer's response
      // if they are not already set by the story's headers, especially Content-Type.
      if (!clientHeaders.has('Content-Type') && assetServerResponse.headers.has('Content-Type')) {
        clientHeaders.set('Content-Type', assetServerResponse.headers.get('Content-Type')!)
      }
      // You might want to do this for other headers like 'Cache-Control' if needed,
      // letting story-defined headers take precedence.

      return new Response(assetServerResponse.body, {
        status: assetServerResponse.status,
        statusText: assetServerResponse.statusText,
        headers: clientHeaders,
      })
    }
  }
  return toRet
}
