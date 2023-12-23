import { wait } from '@plaited/utils'
import { DelegatedListener, delegates } from './delegated-listener.js'
type FetchHTMLOptions = RequestInit & { retry: number; retryDelay: number }

/**
 * @description  A utility function to fetch HTML content from the server with error handling and retries.
 */
export const fetchHTML = async (
  url: RequestInfo | URL,
  { retry, retryDelay, ...options }: FetchHTMLOptions = { retry: 3, retryDelay: 1_000 },
): Promise<DocumentFragment | undefined> => {
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
      const template = document.createElement('template')
      template.innerHTML = htmlContent
      return template.content
    } catch (error) {
      console.error('Fetch error:', error)
      await wait(retryDelay)
    }
    retry--
  }
}

export const intercept = () => {
  const body = document.querySelector('body')
  body && delegates.set(body, new DelegatedListener(async (event: Event) => {
    if (event.type === 'submit') {
      event.preventDefault()    
    }
    if (event.type === 'click') {
      const path = event.composedPath()
      for (const element of path) {
        if (element instanceof HTMLAnchorElement && element.href) {
          const href = element.href
          const linkDomain = new URL(href).hostname
          const currentDomain = window.location.hostname
          if (linkDomain === currentDomain) {
            event.preventDefault()
            const htmlContent = await fetchHTML(href);
            if (htmlContent) {
              history.pushState({}, '', href)
              // Handle the fetched HTML content as needed
              // For example, you can update a specific element with the content
              // For demonstration purposes, we're logging the content
              console.log(htmlContent);
            }
          }
          break
        }
      }
    }
  }))
}