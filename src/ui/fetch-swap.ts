/**
 * Client-side fetch-swap runtime for HTMX-like server-first interactions.
 * Implemented as a standalone behavioral program, not coupled to custom elements.
 * Each HTTP request-response cycle becomes a behavioral thread with observable states.
 *
 * @remarks
 * The runtime intercepts elements with `p-get`, `p-post`, `p-put`, `p-delete`, `p-patch`
 * attributes and handles the full request lifecycle: confirmation → fetch → swap → settle.
 *
 * **Behavioral programming advantages over raw HTMX:**
 * - Observable request states via `useSnapshot`
 * - Declarative duplicate-request prevention using blocking semantics
 * - Priority-based request handling (user interactions preempt background fetches)
 * - User-defined behavioral threads can intercept runtime operations
 *
 * @see {@link behavioral} for the behavioral programming engine
 * @see {@link FetchSwapConfig} for request configuration
 * @see {@link FetchSwapEvents} for lifecycle events
 */

import { behavioral } from '../main/behavioral.ts'
import type { BPEvent } from '../main/behavioral.types.ts'
import { bSync, bThread } from '../main/behavioral.utils.ts'
import {
  P_CONFIRM,
  P_DELETE,
  P_GET,
  P_INDICATOR,
  P_PATCH,
  P_POST,
  P_PUT,
  P_SWAP,
  P_SWAP_TARGET,
  P_TARGET,
  P_VALS,
} from './create-template.constants.ts'
import type { SwapStrategy } from './create-template.types.ts'
import type { FetchSwapConfig, HttpMethod } from './fetch-swap.types.ts'

/** Set of p-* HTTP method attribute names for detection */
const HTTP_ATTRS = new Set([P_GET, P_POST, P_PUT, P_DELETE, P_PATCH])

/** Map from attribute name to HTTP method */
const ATTR_TO_METHOD: Record<string, HttpMethod> = {
  [P_GET]: 'GET',
  [P_POST]: 'POST',
  [P_PUT]: 'PUT',
  [P_DELETE]: 'DELETE',
  [P_PATCH]: 'PATCH',
}

/** Counter for generating unique request IDs */
let requestCounter = 0

/**
 * Extracts a FetchSwapConfig from an element's p-* attributes.
 * Returns undefined if the element has no HTTP method attribute.
 *
 * @param el - The element to extract configuration from
 * @param root - The shadow root or document to query targets within
 * @returns FetchSwapConfig or undefined
 */
const getRequestConfig = (el: Element, root: ParentNode): FetchSwapConfig | undefined => {
  let method: HttpMethod | undefined
  let url: string | undefined

  for (const attr of HTTP_ATTRS) {
    const val = el.getAttribute(attr)
    if (val) {
      method = ATTR_TO_METHOD[attr]
      url = val
      break
    }
  }

  if (!method || !url) return undefined

  const swapAttr = el.getAttribute(P_SWAP) as SwapStrategy | null
  const swap: SwapStrategy = swapAttr ?? 'innerHTML'

  const swapTargetSelector = el.getAttribute(P_SWAP_TARGET)
  const target = swapTargetSelector ? (root.querySelector(`[${P_TARGET}="${swapTargetSelector}"]`) ?? el) : el

  const indicatorSelector = el.getAttribute(P_INDICATOR)
  const indicator = indicatorSelector
    ? (root.querySelector(`[${P_TARGET}="${indicatorSelector}"]`) ?? undefined)
    : undefined

  const confirm = el.getAttribute(P_CONFIRM) ?? undefined

  const valsStr = el.getAttribute(P_VALS)
  let vals: Record<string, unknown> | undefined
  if (valsStr) {
    try {
      vals = JSON.parse(valsStr) as Record<string, unknown>
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {
    id: `req-${++requestCounter}`,
    url,
    method,
    swap,
    target,
    indicator: indicator ?? undefined,
    confirm,
    vals,
    source: el,
  }
}

/**
 * Performs the DOM swap operation for a given config and HTML response.
 * Uses the existing Position semantics from Plaited's DOM manipulation layer.
 *
 * @param config - The fetch-swap configuration
 * @param html - The HTML string from the server response
 */
const performSwap = (config: FetchSwapConfig, html: string) => {
  const { target, swap } = config
  const template = document.createElement('template')
  template.setHTMLUnsafe(html)
  const content = template.content

  switch (swap) {
    case 'innerHTML':
      target.replaceChildren(content)
      break
    case 'outerHTML':
      target.replaceWith(content)
      break
    case 'beforebegin':
      target.before(content)
      break
    case 'afterbegin':
      target.prepend(content)
      break
    case 'beforeend':
      target.append(content)
      break
    case 'afterend':
      target.after(content)
      break
    case 'delete':
      target.remove()
      break
    case 'none':
      // No swap, useful for side-effect-only requests
      break
  }
}

/**
 * Creates the fetch-swap behavioral program runtime.
 * Returns a trigger function and cleanup disconnect for managing the runtime lifecycle.
 *
 * @returns Object with trigger for external event injection and disconnect for cleanup
 *
 * @remarks
 * The runtime creates behavioral threads for each request, each following the lifecycle:
 * 1. **beforeRequest** — Confirmation check, indicator show
 * 2. **fetch** — HTTP request execution
 * 3. **response** — Response received, ready for swap
 * 4. **swap** — DOM mutation
 * 5. **afterSwap** — Indicator hide, cleanup
 *
 * @see {@link bThread} for behavioral thread composition
 * @see {@link bSync} for synchronization points
 */
export const createFetchSwapRuntime = () => {
  const { trigger, useFeedback, useSnapshot, bThreads } = behavioral()

  /** Track active requests for deduplication */
  const activeRequests = new Map<string, AbortController>()

  /**
   * Initiates a fetch-swap cycle for the given config.
   * Creates a behavioral thread that progresses through the request lifecycle.
   */
  const initRequest = (config: FetchSwapConfig) => {
    // Confirmation check
    if (config.confirm && !globalThis.confirm(config.confirm)) {
      return
    }

    const abortController = new AbortController()
    activeRequests.set(config.id, abortController)

    // Show indicator
    if (config.indicator) {
      config.indicator.toggleAttribute('p-loading', true)
    }

    // Add the request behavioral thread
    bThreads.set({
      [`fetchSwap:${config.id}`]: bThread([
        bSync({ request: { type: 'beforeRequest', detail: config } }),
        bSync({ request: { type: 'fetch', detail: config } }),
        bSync({
          waitFor: [
            (e: BPEvent) => e.type === 'response' && e.detail?.id === config.id,
            (e: BPEvent) => e.type === 'fetchError' && e.detail?.id === config.id,
          ],
          interrupt: [(e: BPEvent) => e.type === 'abort' && e.detail?.id === config.id],
        }),
        bSync({
          request: () => ({ type: 'swap', detail: { id: config.id, html: '', config } }),
          waitFor: (e: BPEvent) => e.type === 'swap' && e.detail?.id === config.id,
        }),
        bSync({ request: { type: 'afterSwap', detail: { id: config.id, config } } }),
      ]),
    })
  }

  /** Feedback handlers for each lifecycle phase */
  const disconnect = useFeedback({
    async fetch(detail: FetchSwapConfig) {
      const controller = activeRequests.get(detail.id)
      try {
        const requestInit: RequestInit = {
          method: detail.method,
          signal: controller?.signal,
        }

        // Add body for non-GET methods
        if (detail.method !== 'GET' && detail.vals) {
          requestInit.headers = { 'Content-Type': 'application/json' }
          requestInit.body = JSON.stringify(detail.vals)
        }

        // Append query params for GET with vals
        let url = detail.url
        if (detail.method === 'GET' && detail.vals) {
          const params = new URLSearchParams()
          for (const [key, val] of Object.entries(detail.vals)) {
            params.set(key, String(val))
          }
          url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`
        }

        const res = await fetch(url, requestInit)
        const html = await res.text()

        if (!res.ok) {
          trigger({
            type: 'fetchError',
            detail: { id: detail.id, error: new Error(`HTTP ${res.status}`), config: detail },
          })
          return
        }

        trigger({ type: 'response', detail: { id: detail.id, html, config: detail } })
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          trigger({ type: 'fetchError', detail: { id: detail.id, error, config: detail } })
        }
      }
    },
    swap(detail: { id: string; html: string; config: FetchSwapConfig }) {
      performSwap(detail.config, detail.html)
    },
    afterSwap(detail: { id: string; config: FetchSwapConfig }) {
      // Hide indicator
      if (detail.config.indicator) {
        detail.config.indicator.removeAttribute('p-loading')
      }
      activeRequests.delete(detail.id)
    },
    fetchError(detail: { id: string; error: unknown; config: FetchSwapConfig }) {
      // Hide indicator on error
      if (detail.config.indicator) {
        detail.config.indicator.removeAttribute('p-loading')
      }
      activeRequests.delete(detail.id)
      console.error(`[plaited] Fetch error for ${detail.config.method} ${detail.config.url}:`, detail.error)
    },
  })

  return {
    /** Inject external events into the fetch-swap runtime */
    trigger,
    /** Add custom behavioral threads for request interception */
    bThreads,
    /** Subscribe to runtime state snapshots for debugging */
    useSnapshot,
    /** Initiate a fetch-swap request cycle from a config */
    initRequest,
    /** Extract request configuration from a DOM element */
    getRequestConfig,
    /** Cancel an active request by ID */
    abort: (id: string) => {
      const controller = activeRequests.get(id)
      if (controller) {
        controller.abort()
        trigger({ type: 'abort', detail: { id } })
        activeRequests.delete(id)
      }
    },
    /** Clean up the runtime, disconnecting all feedback handlers */
    disconnect,
  }
}

/**
 * Checks if an element has any p-* HTTP method attribute.
 * Used by the MutationObserver to detect elements that need fetch-swap binding.
 *
 * @param el - Element to check
 * @returns true if the element has a p-get, p-post, p-put, p-delete, or p-patch attribute
 */
export const hasHttpAttr = (el: Element): boolean => {
  for (const attr of HTTP_ATTRS) {
    if (el.hasAttribute(attr)) return true
  }
  return false
}
