import { describe, expect, test } from 'bun:test'
import { ContextDescriptorSchema } from '../use-html-rewriter.schemas.ts'

describe('ContextDescriptorSchema', () => {
  test('accepts simple binding (kind omitted)', () => {
    const result = ContextDescriptorSchema.safeParse({
      title: { path: '/page/title' },
      subtitle: { path: '/page/subtitle' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts data kind without template', () => {
    const result = ContextDescriptorSchema.safeParse({
      'main-content': { kind: 'data', data: '/page/content' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts data kind with template', () => {
    const result = ContextDescriptorSchema.safeParse({
      sidebar: { kind: 'data', data: '/page/sidebar', template: './sidebar.html' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts list kind', () => {
    const result = ContextDescriptorSchema.safeParse({
      'product-list': { kind: 'list', data: '/products', template: './product-card.html' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts switch kind with cases', () => {
    const result = ContextDescriptorSchema.safeParse({
      main: {
        kind: 'switch',
        data: '/view',
        discriminator: 'type',
        cases: {
          dashboard: { kind: 'data', data: '/dash', template: './dash.html' },
          items: { kind: 'list', data: '/items', template: './item.html' },
        },
        default: { kind: 'data', data: '/404', template: './404.html' },
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts switch kind without default', () => {
    const result = ContextDescriptorSchema.safeParse({
      main: {
        kind: 'switch',
        data: '/view',
        discriminator: 'type',
        cases: {
          dashboard: { kind: 'data', data: '/dash', template: './dash.html' },
        },
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts mixed descriptor record', () => {
    const result = ContextDescriptorSchema.safeParse({
      title: { path: '/page/title' },
      list: { kind: 'list', data: '/items', template: './item.html' },
      main: {
        kind: 'switch',
        data: '/view',
        discriminator: 'type',
        cases: {
          home: { path: '/home' },
        },
      },
    })
    expect(result.success).toBe(true)
  })

  test('rejects list without template', () => {
    const result = ContextDescriptorSchema.safeParse({
      'product-list': { kind: 'list', data: '/products' },
    })
    expect(result.success).toBe(false)
  })

  test('rejects list without data', () => {
    const result = ContextDescriptorSchema.safeParse({
      'product-list': { kind: 'list', template: './item.html' },
    })
    expect(result.success).toBe(false)
  })

  test('rejects switch without discriminator', () => {
    const result = ContextDescriptorSchema.safeParse({
      main: {
        kind: 'switch',
        data: '/view',
        cases: {},
      },
    })
    expect(result.success).toBe(false)
  })

  test('rejects switch without cases', () => {
    const result = ContextDescriptorSchema.safeParse({
      main: {
        kind: 'switch',
        data: '/view',
        discriminator: 'type',
      },
    })
    expect(result.success).toBe(false)
  })

  test('rejects unknown kind', () => {
    const result = ContextDescriptorSchema.safeParse({
      foo: { kind: 'unknown', data: '/x' },
    })
    expect(result.success).toBe(false)
  })

  test('accepts simple binding with extra unknown fields (permissive Zod behavior)', () => {
    // Zod's z.object allows unknown keys by default, so extra fields
    // are silently ignored. If strictness is needed later, add .strict().
    const result = ContextDescriptorSchema.safeParse({
      title: { path: '/page/title', extra: 'field' },
    })
    expect(result.success).toBe(true)
  })
})
