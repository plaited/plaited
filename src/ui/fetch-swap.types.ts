/**
 * Type definitions for the HTMX-like fetch-swap runtime.
 * Defines the request lifecycle, swap strategies, and configuration types
 * used by the client-side behavioral program.
 */

import type { SwapStrategy } from './create-template.types.ts'

/**
 * HTTP methods supported by the declarative request attributes.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/**
 * Configuration for a single fetch-swap request cycle.
 * Derived from the `p-*` attributes on the triggering element.
 *
 * @property id - Unique identifier for this request (for deduplication and abort)
 * @property url - The URL to fetch
 * @property method - The HTTP method to use
 * @property swap - The swap strategy for inserting the response
 * @property target - The element to swap content into
 * @property indicator - Optional element to show during loading
 * @property confirm - Optional confirmation message
 * @property vals - Optional additional values for the request body/query
 * @property source - The element that initiated the request
 */
export type FetchSwapConfig = {
  id: string
  url: string
  method: HttpMethod
  swap: SwapStrategy
  target: Element
  indicator?: Element
  confirm?: string
  vals?: Record<string, unknown>
  source: Element
}

/**
 * Events emitted during the fetch-swap lifecycle.
 * Each event corresponds to a phase in the request behavioral thread.
 */
export type FetchSwapEvents = {
  /** Emitted before the request starts, allowing interception */
  beforeRequest: FetchSwapConfig
  /** Emitted when the fetch is initiated */
  fetch: FetchSwapConfig
  /** Emitted when a response is received */
  response: { id: string; html: string; config: FetchSwapConfig }
  /** Emitted when the DOM swap occurs */
  swap: { id: string; html: string; config: FetchSwapConfig }
  /** Emitted after the swap is complete */
  afterSwap: { id: string; config: FetchSwapConfig }
  /** Emitted when a request is aborted */
  abort: { id: string }
  /** Emitted when a request fails */
  fetchError: { id: string; error: unknown; config: FetchSwapConfig }
}

/**
 * State of a single in-flight request, observable via useSnapshot.
 */
export type RequestState = {
  id: string
  url: string
  method: HttpMethod
  status: 'pending' | 'fetching' | 'swapping' | 'complete' | 'error' | 'aborted'
}
