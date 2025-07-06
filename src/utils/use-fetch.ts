import type { PlaitedTrigger, Trigger } from '../behavioral.js'
import { wait } from './wait.js'

/**
 * Fetches resources with automatic retry and error handling.
 *
 * This utility extends the standard fetch API with retry logic and error handling,
 * designed for use within Plaited's behavioral programming system. Failed requests
 * trigger the provided trigger function with error details.
 *
 * @param config Configuration object with the following properties:
 *   @param {RequestInfo | URL} config.url - The URL to fetch from (string, Request, or URL object)
 *   @param {string} config.type - Event type to trigger on errors
 *   @param {Trigger | PlaitedTrigger} config.trigger - Trigger function for error events
 *   @param {number} [config.retry=0] - Number of retry attempts (default: 0)
 *   @param {number} [config.retryDelay=1000] - Base delay in ms between retries (default: 1000)
 *   @param {RequestInit} [config.options] - Standard fetch options (headers, method, body, etc.)
 *
 * @returns Promise<Response | undefined> Standard Response object or undefined if all retries fail
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
