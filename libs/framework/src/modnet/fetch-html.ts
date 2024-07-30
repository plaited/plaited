import { wait } from '@plaited/utils'

export const fetchHTML = async (url: RequestInfo | URL): Promise<string | undefined> => {
  let retry = 3
  while (retry > 0) {
    try {
      const response = await fetch(url)
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
      await wait(1_000)
    }
    retry--
  }
}
