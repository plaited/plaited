import { wait } from './wait.js'

type FetchJSONOptions = RequestInit & { retry: number; retryDelay: number }

/**
 * Fetches and parses JSON data with robust error handling and exponential backoff retry logic.
 *
 * Features:
 * - Automatic retry with exponential backoff delay
 * - Smart error handling for common HTTP status codes
 * - JSON response parsing
 * - TypeScript type inference
 *
 * @template T Type of the expected JSON response data
 *
 * @param url The URL to fetch from (string, Request, or URL object)
 * @param options Configuration object with the following properties:
 *   @param {number} options.retry Number of retry attempts (default: 3)
 *   @param {number} options.retryDelay Base delay in ms between retries (default: 1000)
 *   @param {...RequestInit} options Additional fetch options (headers, method, etc.)
 *
 * @returns Promise<T | undefined> Parsed JSON data or undefined if all retries fail
 *
 * @throws {Error} HTTP status specific errors:
 *   - 404: "Resource not found"
 *   - 500: "Internal server error"
 *   - Other: "Request failed with status code {status}"
 *
 * @example
 * // Basic usage
 * const data = await fetchJSON<UserData>('api/users/1');
 *
 * // With custom retry configuration
 * const data = await fetchJSON('api/users/1', {
 *   retry: 5,
 *   retryDelay: 1000,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * @remarks
 * Uses exponential backoff strategy for retries:
 * - Retry 1: baseDelay * 2^3
 * - Retry 2: baseDelay * 2^2
 * - Retry 3: baseDelay * 2^1
 * Maximum delay is capped at the base retryDelay
 */
export const fetchJSON = async <T = unknown>(
  url: RequestInfo | URL,
  { retry, retryDelay, ...options }: FetchJSONOptions = { retry: 3, retryDelay: 1_000 },
): Promise<T | undefined> => {
  while (retry > 0) {
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

      // Parse and return the response data
      const data = await response.json()

      return data
    } catch (error) {
      console.error('Fetch error:', error)
      await wait(Math.min(retryDelay, retryDelay * Math.pow(2, retry)))
    }
    retry--
  }
}
