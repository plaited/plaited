import { wait } from '@plaited/utils'
import { createTemplate, createDoc } from './parser-utils.js'
type FetchHTMLOptions = RequestInit & { retry?: number; retryDelay?: number; partial?: boolean }

/**
 * @description  A utility function to fetch HTML content from the server with error handling and retries.
 */
export const fetchHTML = async (
  url: RequestInfo | URL,
  { retry = 3, retryDelay = 1_000, partial = true, ...options }: FetchHTMLOptions,
): Promise<DocumentFragment | Document | undefined> => {
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
      // Parse and return the HTML content as text
      const htmlContent = await response.text()
      if (partial) {
        return createTemplate(htmlContent).content
      }
      return createDoc(htmlContent)
    } catch (error) {
      console.error('Fetch error:', error)
      await wait(retryDelay)
    }
    retry--
  }
}
