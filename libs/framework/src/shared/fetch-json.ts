import { wait } from '../utils.js'
import type { FetchJSONOptions } from './types.js'

/**
 * @description  A simple utility function to fetch data that handles common edge cases around failure
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
      await wait(retryDelay)
    }
    retry--
  }
}
