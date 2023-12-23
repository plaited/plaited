/** Utility function for enabling hypermedia patterns */
import { wait } from '@plaited/utils'
import { DelegatedListener, delegates } from './delegated-listener.js'
import { Trigger, BPEvent } from '@plaited/behavioral';

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

const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'
const isCloseEvent = (event: CloseEvent | Event): event is CloseEvent => event.type === 'close'

export const sse = (trigger: Trigger, url: string) =>  {
  let eventSource: EventSource | undefined = new EventSource(url, {withCredentials:true})
  const callback = (event: MessageEvent| Event) => {
    if (isMessageEvent(event)) {
      try {
        const message: BPEvent = JSON.parse(event.data);
        if( 'type' in message && 'detail' in message) {
          trigger({type: message.type, detail: message.detail})
        }
      } catch (error) {
        console.error('Error parsing incoming message:', error);
      } 
    } else {
      trigger({type: `ws:${event.type}`, detail: event})
    }
  }
  delegates.set(eventSource, new DelegatedListener(callback))
  // SSE connection opened
  eventSource.addEventListener('open', delegates.get(eventSource))
  // Handle incoming messages
  eventSource.addEventListener('message', delegates.get(eventSource))
  // Handle SSE errors
  eventSource.addEventListener('error', delegates.get(eventSource))
  return () => {
    if (eventSource) {
      eventSource.close();
      eventSource = undefined;
    }
  }
}

export const ws = (trigger: Trigger, url: string, ) => {
  const maxRetries = 3;
  let retryCount = 0;
  let socket: WebSocket | undefined
  const createWebSocket = () => {
    if (retryCount < maxRetries) {
      socket = new WebSocket(url, [])
    }
    const callback = (event: MessageEvent| Event) => {
      if (isMessageEvent(event)) {
        try {
          const message: BPEvent = JSON.parse(event.data);
          if( 'type' in message && 'detail' in message) {
            trigger({type: message.type, detail: message.detail})
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error);
        } 
      } else if(isCloseEvent(event)) {
        trigger({type: `ws:${event.type}`, detail: event})
        if ([1006, 1012, 1013].indexOf(event.code) >= 0) {  // Abnormal Closure/Service Restart/Try Again Later
          setTimeout(createWebSocket, Math.pow(2, retryCount) * 1000);  // Retry the connection after a delay (e.g., exponential backoff)
        }
      } else if(event.type === 'open') {
        retryCount= 0
        trigger({type: `ws:open`, detail: event})
      } else {
        trigger({type: `ws:${event.type}`, detail: event})
      }
    }
    if(socket) {
      delegates.set(socket, new DelegatedListener(callback))
      // WebSocket connection opened
      socket.addEventListener('open', delegates.get(socket))
      // Handle incoming messages
      socket.addEventListener('message',delegates.get(socket))
      // Handle WebSocket errors
      socket.addEventListener('error', delegates.get(socket))
      // WebSocket connection closed
      socket.addEventListener('close', delegates.get(socket))
    }
  }
  createWebSocket()
  const close = () => {
    if (socket) {
      socket.close();
      socket = undefined;
    }
  }
  const send = (message: BPEvent) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
  return { close, send }
}

export const intercept = () => {
  const html = document.querySelector('html')
  html && delegates.set(html, new DelegatedListener(async (event: Event) => {
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

