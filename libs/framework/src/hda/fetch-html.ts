import { wait } from '@plaited/utils'

export type FetchHTMLOptions = RequestInit & { retry: number; retryDelay: number; partial: boolean }
/**
 * @description  A utility function to fetch HTML content from the server with error handling and retries.
 */
export const fetchHTML = async (
  url: RequestInfo | URL,
  { retry, retryDelay, ...options }: FetchHTMLOptions,
): Promise<string | undefined> => {
  while (retry > 0) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        // Handle specific status codes or throw a generic error
        switch (response.status) {
          case 404:
            throw new Error('HTML resource not found')
          case 500:
            throw new Error('Internal server error')
          default:
            throw new Error(`HTML request failed with status code ${response.status}`)
        }
      }
      return await response.text()
    } catch (error) {
      console.error('Fetch error:', error)
      await wait(retryDelay)
    }
    retry--
  }
}
