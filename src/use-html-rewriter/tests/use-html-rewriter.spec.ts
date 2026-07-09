import { describe, expect, test } from 'bun:test'
import { SCALE, TEMPLATE_OBJECT_IDENTIFIER } from '../html.constants.ts'
import { rewriteFile, validateTemplateObject } from '../html-rewriter.ts'
import {
  DuplicateContextError,
  EventHandlerAttributeError,
  InvalidAttributeError,
  InvalidContextJsonError,
  InvalidResolverResultError,
} from '../use-html-rewriter.errors.ts'

describe('simple binding — pass 1 (context capture)', () => {
  test('zero p-context → passthrough, resolver not called', async () => {
    const html = '<html><body><div>No context</div></body></html>'
    const resolver = () => {
      throw new Error('should not be called')
    }
    const result = await rewriteFile(html, resolver)
    expect(result).toBe(html)
  })

  test('single valid p-context captured and stripped', async () => {
    const html = `<html><body><div p-target="x">X</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: 'hello' })
    const result = await rewriteFile(html, resolver)
    expect(result).not.toContain('p-context')
    expect(result).not.toContain('application/json')
    expect(result).toContain('p-target="x"')
  })

  test('duplicate p-context throws DuplicateContextError', async () => {
    const html = `<html><body><div p-target="x">X</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script><script type="application/json" p-context>{"y":{"path":"/y"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: 'hello' })
    await expect(rewriteFile(html, resolver)).rejects.toThrow(DuplicateContextError)
  })

  test('invalid JSON in p-context throws InvalidContextJsonError', async () => {
    const html = `<html><body><script type="application/json" p-context>not valid json</script></body></html>`
    const resolver = (_ctx: unknown) => ({})
    await expect(rewriteFile(html, resolver)).rejects.toThrow(InvalidContextJsonError)
  })
})

describe('simple binding — pass 2 (data application)', () => {
  test('primitive → escaped text content', async () => {
    const html = `<html><body><div p-target="title">Old</div><script type="application/json" p-context>{"title":{"path":"/title"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ title: 'Hello & World <3' })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('Hello &amp; World &lt;3')
    expect(result).not.toContain('Hello & World <3')
  })

  test('number → string text content', async () => {
    const html = `<html><body><span p-target="count">0</span><script type="application/json" p-context>{"count":{"path":"/count"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ count: 42 })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('>42<')
  })

  test('object → attributes (updateAttributes rules)', async () => {
    const html = `<html><body><a p-target="link" href="#old">link</a><script type="application/json" p-context>{"link":{"path":"/link"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ link: { href: '/new-url', title: 'New Title' } })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('href="/new-url"')
    expect(result).toContain('title="New Title"')
  })

  test('boolean attribute — bare set when true', async () => {
    const html = `<html><body><input p-target="cb" type="checkbox"><script type="application/json" p-context>{"cb":{"path":"/cb"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ cb: { checked: true } })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('checked')
  })

  test('null value → remove attribute', async () => {
    const html = `<html><body><input p-target="cb" type="checkbox" checked><script type="application/json" p-context>{"cb":{"path":"/cb"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ cb: { checked: null } })
    const result = await rewriteFile(html, resolver)
    expect(result).not.toContain('checked')
  })

  test('null value when attr absent → no-op', async () => {
    const html = `<html><body><input p-target="cb" type="checkbox"><script type="application/json" p-context>{"cb":{"path":"/cb"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ cb: { checked: null } })
    const result = await rewriteFile(html, resolver)
    // No checked, no error — just no-op
    expect(result).not.toContain('checked')
  })

  test('missing key → no-op (keep existing content)', async () => {
    const html = `<html><body><div p-target="existing">Keep me</div><script type="application/json" p-context>{"other":{"path":"/other"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ other: 'value' })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('Keep me')
  })

  test('undefined value → no-op', async () => {
    const html = `<html><body><div p-target="x">Keep me</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: undefined })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('Keep me')
  })

  test('resolver returns non-object → InvalidResolverResultError', async () => {
    const html = `<html><body><div p-target="x">X</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => 'string' as unknown
    await expect(rewriteFile(html, resolver)).rejects.toThrow(InvalidResolverResultError)
  })

  test('resolver returns array → InvalidResolverResultError', async () => {
    const html = `<html><body><div p-target="x">X</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => [] as unknown
    await expect(rewriteFile(html, resolver)).rejects.toThrow(InvalidResolverResultError)
  })
})

describe('simple binding — p-trusted bypass', () => {
  test('p-trusted allows raw HTML injection', async () => {
    const html = `<html><body><div p-target="trusted" p-trusted>Safe</div><script type="application/json" p-context>{"trusted":{"path":"/trusted"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ trusted: '<strong>Bold</strong>' })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('<strong>Bold</strong>')
  })

  test('without p-trusted, HTML is escaped', async () => {
    const html = `<html><body><div p-target="x">Safe</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: '<script>evil()</script>' })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('&lt;script&gt;evil')
    expect(result).not.toContain('<script>')
  })
})

describe('simple binding — on* rejection', () => {
  test('object with on* key throws EventHandlerAttributeError', async () => {
    const html = `<html><body><button p-target="btn">Click</button><script type="application/json" p-context>{"btn":{"path":"/btn"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ btn: { onclick: 'alert(1)' } })
    await expect(rewriteFile(html, resolver)).rejects.toThrow(EventHandlerAttributeError)
  })
})

describe('simple binding — top-level boolean rejection', () => {
  test('top-level boolean throws InvalidResolverResultError', async () => {
    const html = `<html><body><div p-target="x">X</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: true })
    await expect(rewriteFile(html, resolver)).rejects.toThrow(InvalidResolverResultError)
  })
})

describe('simple binding — schema validation', () => {
  test('valid attribute map on known tag passes', async () => {
    const html = `<html><body><a p-target="link">link</a><script type="application/json" p-context>{"link":{"path":"/link"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ link: { href: 'https://example.com', title: 'Example' } })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('href="https://example.com"')
  })

  test('invalid attribute value throws InvalidAttributeError', async () => {
    const html = `<html><body><a p-target="link">link</a><script type="application/json" p-context>{"link":{"path":"/link"}}</script></body></html>`
    // target expects '_self' | '_blank' | '_parent' | '_top'
    const resolver = (_ctx: unknown) => ({ link: { target: 'invalid-target-value' } })
    await expect(rewriteFile(html, resolver)).rejects.toThrow(InvalidAttributeError)
  })
})

describe('simple binding — HTML escaping', () => {
  test('attribute values are escaped', async () => {
    const html = `<html><body><div p-target="x">X</div><script type="application/json" p-context>{"x":{"path":"/x"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: { title: 'a & b < c > d " e \' f' } })
    const result = await rewriteFile(html, resolver)
    expect(result).toContain('&amp;')
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    expect(result).toContain('&quot;')
    expect(result).toContain('&#39;')
  })
})

describe('validateTemplateObject', () => {
  test('valid TemplateObject passes', () => {
    const obj = {
      html: ['<div>hello</div>'],
      stylesheets: ['body { color: red; }'],
      scale: SCALE.rel,
      $: TEMPLATE_OBJECT_IDENTIFIER,
    }
    expect(validateTemplateObject(obj)).toBe(true)
  })

  test('missing field throws TypeError', () => {
    const obj = { html: ['<div>hello</div>'] }
    expect(() => validateTemplateObject(obj)).toThrow(TypeError)
  })

  test('invalid scale throws TypeError', () => {
    const obj = {
      html: ['<div>hello</div>'],
      stylesheets: [],
      scale: 'invalid-scale',
      $: TEMPLATE_OBJECT_IDENTIFIER,
    }
    expect(() => validateTemplateObject(obj)).toThrow(TypeError)
  })
})
