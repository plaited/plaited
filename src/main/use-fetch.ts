import type { PlaitedTrigger, Trigger } from '../behavioral.js'
import { wait, canUseDOM } from '../utils.js'

const createDocumentFragment = (html: string) => {
  if (!canUseDOM()) return
  const tpl = document.createElement('template')
  tpl.setHTMLUnsafe(html)
  const clone = tpl.content.cloneNode(true) as DocumentFragment
  const scripts = clone.querySelectorAll<HTMLScriptElement>('script')
  for (const script of scripts) {
    const newScript = document.createElement('script')
    for (const attr of script.attributes) {
      newScript.setAttribute(attr.name, attr.value)
    }
    if (script.textContent) {
      newScript.textContent = script.textContent
    }
    script.parentNode?.appendChild(newScript)
    script.parentNode?.removeChild(script)
  }
  return clone
}

/**
 * Fetches resources with automatic retry, error handling, and HTML parsing capabilities.
 *
 * This utility extends the standard fetch API with retry logic, error handling, and
 * a special `html()` method that safely parses HTML content with script execution.
 * Designed for use within Plaited's behavioral programming system.
 *
 * @param config Configuration object with the following properties:
 *   @param {RequestInfo | URL} config.url - The URL to fetch from (string, Request, or URL object)
 *   @param {string} config.type - Event type to trigger on errors
 *   @param {Trigger | PlaitedTrigger} config.trigger - Trigger function for error events
 *   @param {number} [config.retry=1] - Number of retry attempts (default: 1)
 *   @param {number} [config.retryDelay=1000] - Base delay in ms between retries (default: 1000)
 *   @param {RequestInit} [config.options] - Standard fetch options (headers, method, body, etc.)
 *
 * @returns Promise<Response & { html: () => Promise<DocumentFragment> } | undefined>
 *   Enhanced Response object with `html()` method, or undefined if all retries fail
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
 * // Fetching and parsing HTML with script execution
 * const response = await useFetch({
 *   url: '/components/widget.html',
 *   type: 'WIDGET_ERROR',
 *   trigger: myTrigger
 * });
 * const fragment = await response?.html(); // ⚠️ Scripts will execute!
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
 * - ⚠️ **Security Warning**: The `html()` method uses `setHTMLUnsafe` allowing script execution
 * - Only use `html()` with trusted sources or proper CSP configuration
 * - Errors trigger the provided trigger function with type and error detail
 * - HTTP errors (404, 500, etc.) are caught and retried
 * - Retry delays use exponential backoff with jitter
 * - Returns undefined when all retries are exhausted (does not throw)
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
}): Promise<
  | (Response & {
      /**
       * ⚠️ **Security Warning**: This method allows JavaScript execution from fetched HTML.
       * Only use with trusted sources or when you have proper Content Security Policy (CSP) configured.
       */
      html: () => Promise<DocumentFragment>
    })
  | undefined
> => {
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
      const addOn = {
        html: async () => createDocumentFragment(await response.text()),
      }
      Object.assign(response, addOn)
      return response as Response & { html: () => Promise<DocumentFragment> }
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
