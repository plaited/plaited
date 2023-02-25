import type { ConnInfo } from '../../deps.ts'
import { assert, assertEquals, assertIsError } from '../../test-deps.ts'
import { router, Routes } from '../router.ts'

const TEST_CONN_INFO: ConnInfo = {
  localAddr: {
    transport: 'tcp',
    hostname: 'test',
    port: 80,
  },
  remoteAddr: {
    transport: 'tcp',
    hostname: 'test',
    port: 80,
  },
}

Deno.test('handlers', async ({ step }) => {
  await step('other', async ({ step }) => {
    await step('default', async () => {
      const handlers: Routes = new Map()
      handlers.set(
        '/test',
        () => new Response(),
      )
      const route = router(handlers)
      let response: Response

      response = await route(
        new Request('https://example.com/'),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 404)

      response = await route(
        new Request('https://example.com/test'),
        TEST_CONN_INFO,
      )
      assert(response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 200)
    })

    await step('custom', async () => {
      const handlers: Routes = new Map()
      handlers.set(
        '/test',
        () => new Response(),
      )
      const route = router(
        handlers,
        {
          otherHandler: () => {
            return new Response('test', {
              status: 418,
            })
          },
        },
      )
      let response: Response

      response = await route(
        new Request('https://example.com/'),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(await response.text(), 'test')
      assertEquals(response.status, 418)

      response = await route(
        new Request('https://example.com/test'),
        TEST_CONN_INFO,
      )
      assert(response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 200)
    })
  })

  await step('error', async ({ step }) => {
    await step('default', async () => {
      const handlers: Routes = new Map()
      handlers.set(
        '/error',
        () => {
          throw new Error('error')
        },
      )
      const route = router(handlers)

      const response = await route(
        new Request('https://example.com/error'),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 500)
    })

    await step('custom', async () => {
      const handlers: Routes = new Map()
      handlers.set('/error/:message', (_req, _ctx, match) => {
        throw new Error(match.message)
      })
      handlers.set('/error', () => {
        throw new Error('error')
      })
      const route = router(
        handlers,
        {
          errorHandler: (_req, _ctx, err) => {
            assertIsError(err)

            return new Response(err.message, {
              status: 500,
            })
          },
        },
      )
      let response: Response

      response = await route(
        new Request('https://example.com/error'),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(await response.text(), 'error')
      assertEquals(response.status, 500)

      response = await route(
        new Request('https://example.com/error/message\u2019'),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(await response.text(), 'message\u2019')
      assertEquals(response.status, 500)
    })
  })

  await step('unknown method', async ({ step }) => {
    await step('default', async () => {
      const handlers: Routes = new Map()
      handlers.set('GET@/test', () => new Response())
      handlers.set('PATCH@/test', () => new Response())
      const route = router(handlers)
      let response: Response

      response = await route(
        new Request('https://example.com/test'),
        TEST_CONN_INFO,
      )
      assert(response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 200)

      response = await route(
        new Request('https://example.com/test', {
          method: 'PATCH',
        }),
        TEST_CONN_INFO,
      )
      assert(response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 200)

      response = await route(
        new Request('https://example.com/test', {
          method: 'POST',
        }),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 405)
      assertEquals(response.headers.get('Accept'), 'GET, PATCH')
    })

    await step('custom', async () => {
      const handlers: Routes = new Map()
      handlers.set('GET@/test', () => new Response())
      handlers.set('PATCH@/test', () => new Response())
      const route = router(
        handlers,
        {
          unknownMethodHandler: (_req, _ctx, knownMethods) => {
            assert(Array.isArray(knownMethods))
            assert(
              knownMethods.every((method) => knownMethods.includes(method)),
            )
            assertEquals(knownMethods, ['GET', 'PATCH'])

            return new Response('unknown method', {
              status: 405,
              headers: {
                Accept: knownMethods.join(', '),
              },
            })
          },
        },
      )
      let response: Response

      response = await route(
        new Request('https://example.com/test'),
        TEST_CONN_INFO,
      )
      assert(response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 200)

      response = await route(
        new Request('https://example.com/test', {
          method: 'PATCH',
        }),
        TEST_CONN_INFO,
      )
      assert(response.ok)
      assertEquals(response.body, null)
      assertEquals(response.status, 200)

      response = await route(
        new Request('https://example.com/test', {
          method: 'POST',
        }),
        TEST_CONN_INFO,
      )
      assert(!response.ok)
      assertEquals(await response.text(), 'unknown method')
      assertEquals(response.status, 405)
      assertEquals(response.headers.get('Accept'), 'GET, PATCH')
    })
  })
})

Deno.test('nesting', async ({ step }) => {
  await step('slash', async () => {
    const handlers: Routes = new Map([
      ['/', () => new Response()],
      ['/test/abc', () => new Response()],
      ['/test/123', () => new Response()],
    ])
    const route = router(handlers)
    let response: Response

    response = await route(new Request('https://example.com/'), TEST_CONN_INFO)
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test'),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 404)

    response = await route(
      new Request('https://example.com/test/abc'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test/123'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)
  })

  await step('no slash', async () => {
    const handlers: Routes = new Map([
      ['', () => new Response()],
      ['test/abc', () => new Response()],
      ['test/123', () => new Response()],
    ])
    const route = router(handlers)
    let response: Response

    response = await route(new Request('https://example.com/'), TEST_CONN_INFO)
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test'),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 404)

    response = await route(
      new Request('https://example.com/test/abc'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test/123'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)
  })

  await step('parameters', async () => {
    const handlers: Routes = new Map([
      [':test/abc', () => new Response()],
      [':test/123', () => new Response()],
    ])
    const route = router(handlers)
    let response: Response

    response = await route(
      new Request('https://example.com/foo'),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 404)

    response = await route(
      new Request('https://example.com/bar/abc'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/baz/123'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)
  })

  await step('nested parent handler', async () => {
    const handlers: Routes = new Map([
      ['/test{/}?', () => new Response()],
      ['/test/abc', () => new Response()],
    ])
    const route = router(handlers)
    let response: Response

    response = await route(
      new Request('https://example.com/test/123'),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 404)

    response = await route(
      new Request('https://example.com/test/abc'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test/'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)
  })

  await step('methods shallow', async () => {
    const handlers: Routes = new Map([
      ['/', () => new Response()],
      ['GET@/test/abc', () => new Response('1')],
      ['POST@/test/abc', () => new Response('2')],
      ['DELETE@/test{/}?', () => new Response()],
    ])
    const route = router(handlers)
    let response: Response

    response = await route(new Request('https://example.com/'), TEST_CONN_INFO)
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test'),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 405)
    assertEquals(response.headers.get('Accept'), 'DELETE')

    response = await route(
      new Request('https://example.com/test/', { method: 'DELETE' }),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.status, 200)
    assertEquals(response.body, null)

    response = await route(
      new Request('https://example.com/test/abc', { method: 'DELETE' }),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 405)
    assertEquals(response.headers.get('Accept'), 'GET, POST')

    response = await route(
      new Request('https://example.com/test/abc'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.status, 200)
    assertEquals(await response.text(), '1')

    response = await route(
      new Request('https://example.com/test/abc', { method: 'POST' }),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.status, 200)
    assertEquals(await response.text(), '2')
  })

  await step('methods deep', async () => {
    const handlers: Routes = new Map([
      ['/', () => new Response()],
      ['GET@/test/abc/def', () => new Response('1')],
      ['POST@/test/abc/def', () => new Response('2')],
      ['DELETE@/test/abc{/}?', () => new Response()],
    ])
    const route = router(handlers)
    let response: Response

    response = await route(new Request('https://example.com/'), TEST_CONN_INFO)
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)

    response = await route(
      new Request('https://example.com/test/abc/'),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 405)
    assertEquals(response.headers.get('Accept'), 'DELETE')

    response = await route(
      new Request('https://example.com/test/abc/', { method: 'DELETE' }),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.status, 200)
    assertEquals(response.body, null)

    response = await route(
      new Request('https://example.com/test/abc/def', { method: 'DELETE' }),
      TEST_CONN_INFO,
    )
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 405)
    assertEquals(response.headers.get('Accept'), 'GET, POST')

    response = await route(
      new Request('https://example.com/test/abc/def'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.status, 200)
    assertEquals(await response.text(), '1')

    response = await route(
      new Request('https://example.com/test/abc/def', { method: 'POST' }),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.status, 200)
    assertEquals(await response.text(), '2')
  })
})

Deno.test('internal routes', async ({ step }) => {
  await step('RegExp', async () => {
    const route = router([
      {
        pattern: /^https:\/\/example\.com\/test$/,
        methods: { any: () => new Response() },
      },
    ])
    let response: Response

    response = await route(new Request('https://example.com/'), TEST_CONN_INFO)
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 404)

    response = await route(
      new Request('https://example.com/test'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)
  })

  await step('URLPattern', async () => {
    const route = router([
      {
        pattern: new URLPattern({ pathname: '/test' }),
        methods: { any: () => new Response() },
      },
    ])
    let response: Response

    response = await route(new Request('https://example.com/'), TEST_CONN_INFO)
    assert(!response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 404)

    response = await route(
      new Request('https://example.com/test'),
      TEST_CONN_INFO,
    )
    assert(response.ok)
    assertEquals(response.body, null)
    assertEquals(response.status, 200)
  })
})
