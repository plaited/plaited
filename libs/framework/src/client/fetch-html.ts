import { wait } from '@plaited/utils'
import { PLAITED_PAGES_CACHE } from './constants.js'

export const fetchHTML = async (
  url: string,
  { retry, retryDelay, ...rest }: { retry: number; retryDelay: number; } & RequestInit,
): Promise<Response| undefined> => {
  const cache = await caches.open(PLAITED_PAGES_CACHE);
  const response = await cache.match(url);
  if(response) { 
    cache.put(url, response.clone());
    return response
  };
  while (retry > 0) {
    try {
      const response = await fetch(url, rest)
      if (!response.ok) {
        // Handle specific status codes or throw a generic error
        switch (response.status) {
          case 401:
            throw new Error('Unauthorized request for HTML resource')
          case 404:
            throw new Error('HTML resource not found')
          case 500:
            throw new Error('Internal server error')
          default:
            throw new Error(`HTML request failed with status code ${response.status}`)
        }
      }
      if (response.headers.get('content-type')?.includes('text/html')) {
        cache.put(url, response.clone());
        return response
      } else {
        throw new Error('The response is not HTML');
      }
    } catch (error) {
      console.error('Fetch error:', error)
      await wait(retryDelay)
    }
    retry--
  }
}