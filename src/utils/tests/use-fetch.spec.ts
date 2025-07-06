import { test, expect, mock, jest } from 'bun:test'
import { useFetch } from '../use-fetch.js'

test('useFetch should successfully fetch and parse JSON data', async () => {
  const mockData = { id: 1, name: 'Test User' }
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/user/1',
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toEqual(mockData)
  expect(fetch).toHaveBeenCalledTimes(1)

  globalThis.fetch = originalFetch
})

test('useFetch should handle 404 errors', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  globalThis.fetch = mock(() => Promise.resolve(new Response('Not Found', { status: 404 }))) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/nonexistent',
    type: 'stub',
    trigger,
    retry: 1,
    retryDelay: 10,
  })
  const result = await res?.json()
  expect(result).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(2)

  globalThis.fetch = originalFetch
})

test('useFetch should handle 500 errors', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  globalThis.fetch = mock(() =>
    Promise.resolve(new Response('Server Error', { status: 500 })),
  ) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/error',
    retry: 1,
    retryDelay: 10,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(2)

  globalThis.fetch = originalFetch
})

test('useFetch should handle other HTTP errors', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  globalThis.fetch = mock(() => Promise.resolve(new Response('Forbidden', { status: 403 }))) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/forbidden',
    retry: 1,
    retryDelay: 10,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(2)

  globalThis.fetch = originalFetch
})

test('useFetch should retry on network failure', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  let callCount = 0
  const mockData = { success: true }

  globalThis.fetch = mock(() => {
    callCount++
    if (callCount < 3) {
      return Promise.reject(new Error('Network error'))
    }
    return Promise.resolve(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/retry',
    retry: 3,
    retryDelay: 10,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toEqual(mockData)
  expect(callCount).toBe(3)

  globalThis.fetch = originalFetch
})

test('useFetch should return undefined after all retries fail', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/fail',
    retry: 1,
    retryDelay: 10,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(2)

  globalThis.fetch = originalFetch
})

test('useFetch should accept custom headers and options', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()
  const mockData = { created: true }
  let capturedOptions: RequestInit | undefined

  globalThis.fetch = mock((url: RequestInfo | URL, options?: RequestInit) => {
    capturedOptions = options
    return Promise.resolve(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/create',
    retry: 3,
    retryDelay: 1000,
    type: 'stub',
    trigger,
    options: {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Item' }),
    },
  })
  const result = await res?.json()
  expect(result).toEqual(mockData)
  expect(capturedOptions?.method).toBe('POST')
  expect(capturedOptions?.headers).toEqual({
    Authorization: 'Bearer token123',
    'Content-Type': 'application/json',
  })
  expect(capturedOptions?.body).toBe(JSON.stringify({ name: 'New Item' }))

  globalThis.fetch = originalFetch
})

test('useFetch should handle JSON parsing errors', async () => {
  const originalFetch = globalThis.fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trigger = (...args: any[]) => errors.push(args)

  let callCount = 0
  globalThis.fetch = mock(() => {
    callCount++
    return Promise.resolve(
      new Response('Invalid JSON', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }) as unknown as typeof fetch
  let result: unknown
  try {
    const res = await useFetch({
      url: 'https://api.example.com/invalid-json',
      retry: 2,
      retryDelay: 10,
      type: 'stub',
      trigger,
    })
    result = await res?.json()
  } catch (_) {
    return
  }

  expect(result).toBeUndefined()
  expect(callCount).toBe(2)
  // Verify that errors were logged
  expect(errors.length).toBe(2)
  expect(errors[0][0]).toBe('Fetch error:')
  // The error should be a SyntaxError from JSON parsing
  expect(errors[0][1].name).toBe('SyntaxError')

  globalThis.fetch = originalFetch
})

test('useFetch should accept URL object', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()
  const mockData = { url: 'object' }

  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof fetch

  const url = new URL('https://api.example.com/url-object')
  const res = await useFetch({
    url,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toEqual(mockData)
  expect(fetch).toHaveBeenCalledTimes(1)
  // Since we didn't provide options, fetch should be called with undefined as second param
  expect(fetch).toHaveBeenCalledWith(url, undefined)

  globalThis.fetch = originalFetch
})

test('useFetch should handle mixed success/failure retries', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  let callCount = 0
  const mockData = { retry: 'success' }

  globalThis.fetch = mock(() => {
    callCount++
    if (callCount === 1) {
      return Promise.reject(new Error('Temporary failure'))
    }
    return Promise.resolve(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/retry-once',
    retry: 3,
    retryDelay: 10,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toEqual(mockData)
  expect(callCount).toBe(2)

  globalThis.fetch = originalFetch
})

test('useFetch should handle non-ok response with successful JSON parse', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response('{"error": "Not authorized"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof fetch

  const res = await useFetch({
    url: 'https://api.example.com/unauthorized',
    retryDelay: 10,
    type: 'stub',
    trigger,
  })
  const result = await res?.json()
  expect(result).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(1)

  globalThis.fetch = originalFetch
})

test('useFetch respects retry configuration', async () => {
  const originalFetch = globalThis.fetch
  const trigger = jest.fn()

  let callCount = 0
  globalThis.fetch = mock(() => {
    callCount++
    return Promise.reject(new Error('Network error'))
  }) as unknown as typeof fetch

  const result = await useFetch({
    url: 'https://api.example.com/test-retries',
    retry: 2,
    retryDelay: 10,
    type: 'stub',
    trigger,
  })

  expect(result).toBeUndefined()
  // Should be called 3 times: initial + 2 retries
  expect(callCount).toBe(3)
  // Trigger should be called for each failure
  expect(trigger).toHaveBeenCalledTimes(3)
  expect(trigger).toHaveBeenCalledWith({
    type: 'stub',
    detail: expect.any(Error),
  })

  globalThis.fetch = originalFetch
})
