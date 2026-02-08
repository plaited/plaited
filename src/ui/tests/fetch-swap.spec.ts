import { describe, expect, test } from 'bun:test'
import beautify from 'beautify'
import { h } from 'plaited/jsx-runtime'
import type { TemplateObject } from 'plaited/ui'

const render = (tpl: TemplateObject) => beautify(tpl.html.join(''), { format: 'html' })

describe('fetch-swap JSX attributes', () => {
  test('p-get renders as attribute', () => {
    const result = render(h('button', { 'p-get': '/api/items', children: 'Load' }))
    expect(result).toContain('p-get="/api/items"')
    expect(result).toContain('Load')
  })

  test('p-post renders as attribute', () => {
    const result = render(h('button', { 'p-post': '/api/submit', children: 'Submit' }))
    expect(result).toContain('p-post="/api/submit"')
  })

  test('p-put renders as attribute', () => {
    const result = render(h('button', { 'p-put': '/api/update', children: 'Update' }))
    expect(result).toContain('p-put="/api/update"')
  })

  test('p-delete renders as attribute', () => {
    const result = render(h('button', { 'p-delete': '/api/remove', children: 'Delete' }))
    expect(result).toContain('p-delete="/api/remove"')
  })

  test('p-patch renders as attribute', () => {
    const result = render(h('button', { 'p-patch': '/api/patch', children: 'Patch' }))
    expect(result).toContain('p-patch="/api/patch"')
  })

  test('p-swap renders as attribute', () => {
    const result = render(h('button', { 'p-get': '/api/data', 'p-swap': 'innerHTML', children: 'Load' }))
    expect(result).toContain('p-swap="innerHTML"')
    expect(result).toContain('p-get="/api/data"')
  })

  test('p-swap-target renders as attribute', () => {
    const result = render(h('button', { 'p-get': '/api/data', 'p-swap-target': 'results', children: 'Load' }))
    expect(result).toContain('p-swap-target="results"')
  })

  test('p-indicator renders as attribute', () => {
    const result = render(h('button', { 'p-get': '/api/data', 'p-indicator': 'spinner', children: 'Load' }))
    expect(result).toContain('p-indicator="spinner"')
  })

  test('p-confirm renders as attribute', () => {
    const result = render(h('button', { 'p-delete': '/api/item/1', 'p-confirm': 'Are you sure?', children: 'Delete' }))
    expect(result).toContain('p-confirm="Are you sure?"')
  })

  test('p-vals renders as attribute', () => {
    const result = render(h('button', { 'p-post': '/api/submit', 'p-vals': '{"page":1}', children: 'Submit' }))
    expect(result).toContain('p-vals=')
  })

  test('all p-* HTTP attributes together', () => {
    const result = render(
      h('button', {
        'p-get': '/api/search',
        'p-swap': 'beforeend',
        'p-swap-target': 'results',
        'p-indicator': 'spinner',
        'p-confirm': 'Load more?',
        'p-vals': '{"page":2}',
        'p-trigger': { click: 'search' },
        children: 'Load More',
      }),
    )
    expect(result).toContain('p-get="/api/search"')
    expect(result).toContain('p-swap="beforeend"')
    expect(result).toContain('p-swap-target="results"')
    expect(result).toContain('p-indicator="spinner"')
    expect(result).toContain('p-confirm="Load more?"')
    expect(result).toContain('Load More')
  })
})

describe('fetch-swap SwapStrategy type', () => {
  test('all swap strategies are valid attribute values', () => {
    const strategies = [
      'beforebegin',
      'afterbegin',
      'beforeend',
      'afterend',
      'innerHTML',
      'outerHTML',
      'delete',
      'none',
    ] as const

    for (const strategy of strategies) {
      const result = render(h('button', { 'p-get': '/api/data', 'p-swap': strategy }))
      expect(result).toContain(`p-swap="${strategy}"`)
    }
  })
})

describe('fetch-swap runtime utilities', () => {
  test('hasHttpAttr export exists', async () => {
    const { hasHttpAttr } = await import('plaited/ui/fetch-swap.ts')
    expect(typeof hasHttpAttr).toBe('function')
  })

  test('createFetchSwapRuntime export exists', async () => {
    const { createFetchSwapRuntime } = await import('plaited/ui/fetch-swap.ts')
    expect(typeof createFetchSwapRuntime).toBe('function')
  })
})
