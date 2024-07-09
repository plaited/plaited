import { wait } from '@plaited/utils'
import { FetchHTMLOptions } from './types.js'

export const fetchHTML = async (
  url: RequestInfo | URL,
  { retry = 3, retryDelay = 1_000, ...options }: FetchHTMLOptions,
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
