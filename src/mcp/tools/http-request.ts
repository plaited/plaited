import type { PlaitedTrigger, Trigger } from '../../main.js'
import { wait } from '../../utils/wait.js'

/**
 * @internal
 * Fetch with automatic retry and error handling.
 * Integrates with Plaited's trigger system.
 *
 * @param config - Fetch configuration
 * @param config.url - URL to fetch
 * @param config.type - Error event type
 * @param config.trigger - Error handler trigger
 * @param config.retry - Retry attempts (default: 0)
 * @param config.retryDelay - Base retry delay in ms (default: 1000)
 * @param config.options - Standard fetch options
 * @returns Response or undefined if all retries exhausted
 *
 * @example Basic usage
 * ```ts
 * const response = await useFetch({
 *   url: '/api/users',
 *   type: 'FETCH_ERROR',
 *   trigger: myTrigger
 * });
 * const data = await response?.json();
 * ```
 *
 * @example With retries
 * ```ts
 * const response = await useFetch({
 *   url: '/api/data',
 *   type: 'API_ERROR',
 *   trigger: myTrigger,
 *   retry: 3,
 *   retryDelay: 2000,
 *   options: {
 *     method: 'POST',
 *     body: JSON.stringify({ name: 'John' })
 *   }
 * });
 * ```
 *
 * @remarks
 * Uses exponential backoff with jitter.
 * Triggers error events on failures.
 * Returns undefined instead of throwing.
 */
export const httpRequest = async ({
  url,
  retry = 0,
  retryDelay = 1_000,
  trigger,
  type,
  options,
}: {
  url: RequestInfo | URL
  type: string
  trigger: Trigger | PlaitedTrigger
  retry?: number
  retryDelay?: number
  options?: RequestInit
}): Promise<Response | undefined> => {
  while (retry > -1) {
    try {
      const response = await fetch(url, options)
      // Check if the response is successful (status code 200-299)
      if (!response.ok) {
        // Handle specific status codes or throw a generic error
        switch (response.status) {
          case 404:
            throw new Error('Resource not found')
          case 500:
            throw new Error('Internal server error')
          default:
            throw new Error(`Request failed with status code ${response.status}`)
        }
      }

      retry = 0 // Exit loop on successful fetch
      return response
    } catch (detail) {
      trigger({ type, detail })
    }
    retry--
    if (retry > -1) {
      const max = Math.min(9999, retryDelay * Math.pow(2, retry))
      await wait(Math.floor(Math.random() * max))
    }
  }
}
