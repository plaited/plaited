import type { PlaitedTrigger, Trigger } from '../behavioral.js'
import { wait } from './wait.js'

/**
 * Fetches resources with automatic retry and error handling.
 *
 * This utility extends the standard fetch API with retry logic and error handling,
 * designed for use within Plaited's behavioral programming system. Failed requests
 * trigger the provided trigger function with error details.
 *
 * @param config - Configuration object for the fetch operation.
 * @param config.url - The URL to fetch from (can be a string, `Request` object, or `URL` object).
 * @param config.type - The event type string to use when an error occurs and is dispatched via the `trigger`.
 * @param config.trigger - The `Trigger` or `PlaitedTrigger` function to call when an error occurs.
 * @param [config.retry=0] - The number of retry attempts to make if the fetch fails. Defaults to 0 (no retries).
 * @param [config.retryDelay=1000] - The base delay in milliseconds between retry attempts. This delay uses exponential backoff with jitter. Defaults to 1000ms.
 * @param [config.options] - Standard `RequestInit` options for the `fetch` call (e.g., method, headers, body).
 *
 * @returns A Promise that resolves to a `Response` object if successful, or `undefined` if all retry attempts are exhausted.
 *
 * @example
 * // Basic usage for JSON
 * const response = await useFetch({
 *   url: '/api/users/1',
 *   type: 'FETCH_ERROR',
 *   trigger: myTrigger
 * });
 * const userData = await response?.json();
 *
 * // With retry configuration and custom options
 * const response = await useFetch({
 *   url: '/api/data',
 *   type: 'API_ERROR',
 *   trigger: myTrigger,
 *   retry: 3,
 *   retryDelay: 2000,
 *   options: {
 *     method: 'POST',
 *     headers: { 'Authorization': 'Bearer token' },
 *     body: JSON.stringify({ name: 'John' })
 *   }
 * });
 *
 * @remarks
 * - Errors trigger the provided trigger function with type and error detail
 * - HTTP errors (404, 500, etc.) are caught and retried
 * - Retry delays use exponential backoff with jitter: `Math.random() * min(9999, retryDelay * 2^retry)`
 * - Returns undefined when all retries are exhausted (does not throw)
 * - The trigger is called for each failed attempt, allowing for error tracking
 *
 * @internal
 */
export const useFetch = async ({
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
