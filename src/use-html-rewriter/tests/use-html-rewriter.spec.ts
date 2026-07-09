import { describe, expect, test } from 'bun:test'

import { SCALE, TEMPLATE_OBJECT_IDENTIFIER } from '../html.constants.ts'
import type { RewriteOptions } from '../html-rewriter.ts'
import { rewriteFile, validateTemplateObject } from '../html-rewriter.ts'
import {
  DuplicateContextError,
  EventHandlerAttributeError,
  IncludeCycleError,
  IncludeNotFoundError,
  InvalidAttributeError,
  InvalidContextJsonError,
  InvalidResolverResultError,
} from '../use-html-rewriter.errors.ts'
import { useHtmlRewriter } from '../use-html-rewriter.ts'

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

describe('ssr-include', () => {
  const fixturesDir = `${import.meta.dir}/fixtures`
  const options: RewriteOptions = {
    cwd: fixturesDir,
    includeStack: new Set(),
  }

  test('static include spliced in', async () => {
    const html = `<html><body><ssr-include src="include-static.html"></ssr-include></body></html>`
    const resolver = (_ctx: unknown) => ({})
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Footer content')
    expect(result).not.toContain('ssr-include')
  })

  test('recursive include with own p-context', async () => {
    const html = `<html><body><ssr-include src="include-recursive.html"></ssr-include></body></html>`
    const resolver = (_ctx: unknown) => ({ title: 'Resolved Title' })
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Resolved Title')
    expect(result).not.toContain('ssr-include')
  })

  test('include cycle throws IncludeCycleError', async () => {
    const html = `<html><body><ssr-include src="include-cycle-a.html"></ssr-include></body></html>`
    const resolver = (_ctx: unknown) => ({})
    await expect(rewriteFile(html, resolver, options)).rejects.toThrow(IncludeCycleError)
  })

  test('missing include file throws IncludeNotFoundError', async () => {
    const html = `<html><body><ssr-include src="include-missing.html"></ssr-include></body></html>`
    const resolver = (_ctx: unknown) => ({})
    await expect(rewriteFile(html, resolver, options)).rejects.toThrow(IncludeNotFoundError)
  })

  test('paths resolved against cwd, not including file', async () => {
    // The including file is passed as a string, not a file path. The cwd
    // is the fixture directory, so the include resolves relative to that.
    const html = `<html><body><ssr-include src="include-static.html"></ssr-include></body></html>`
    const resolver = (_ctx: unknown) => ({})
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Footer content')
  })
})

describe('child-insertion — list', () => {
  const fixturesDir = `${import.meta.dir}/fixtures`
  const options: RewriteOptions = {
    cwd: fixturesDir,
    includeStack: new Set(),
  }

  test('list loops template per item', async () => {
    const html = `<html><body><div p-target="items">Old</div><script type="application/json" p-context>{"items":{"kind":"list","data":"/products","template":"./list-item.html"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({
      items: [
        { name: 'Widget', price: 10 },
        { name: 'Gadget', price: 20 },
      ],
    })
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Widget')
    expect(result).toContain('Gadget')
  })

  test('list with empty array leaves target empty', async () => {
    const html = `<html><body><div p-target="items">Old</div><script type="application/json" p-context>{"items":{"kind":"list","data":"/products","template":"./list-item.html"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ items: [] })
    const result = await rewriteFile(html, resolver, options)
    expect(result).not.toContain('Old')
  })

  test('list with non-array throws InvalidResolverResultError', async () => {
    const html = `<html><body><div p-target="items">Old</div><script type="application/json" p-context>{"items":{"kind":"list","data":"/products","template":"./list-item.html"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ items: 'not-an-array' })
    await expect(rewriteFile(html, resolver, options)).rejects.toThrow(InvalidResolverResultError)
  })
})

describe('child-insertion — data', () => {
  const fixturesDir = `${import.meta.dir}/fixtures`
  const options: RewriteOptions = {
    cwd: fixturesDir,
    includeStack: new Set(),
  }

  test('data+template renders template with data as context', async () => {
    const html = `<html><body><div p-target="main">Old</div><script type="application/json" p-context>{"main":{"kind":"data","data":"/page","template":"./simple-template.html"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ main: { title: 'Hello World' } })
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Hello World')
  })

  test('data without template applies simple binding', async () => {
    const html = `<html><body><div p-target="x">Old</div><script type="application/json" p-context>{"x":{"kind":"data","data":"/value"}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ x: 'Direct Value' })
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Direct Value')
  })
})

describe('child-insertion — switch', () => {
  const fixturesDir = `${import.meta.dir}/fixtures`
  const options: RewriteOptions = {
    cwd: fixturesDir,
    includeStack: new Set(),
  }

  test('switch picks the right case by discriminator', async () => {
    const html = `<html><body><div p-target="main">Old</div><script type="application/json" p-context>{"main":{"kind":"switch","data":"/view","discriminator":"type","cases":{"dashboard":{"kind":"data","data":"/dash","template":"./simple-template.html"},"items":{"kind":"list","data":"/items","template":"./list-item.html"}},"default":{"kind":"data","data":"/404","template":"./simple-template.html"}}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ main: { type: 'dashboard', title: 'Dash Page' } })
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Dash Page')
  })

  test('switch uses default when no case matches', async () => {
    const html = `<html><body><div p-target="main">Old</div><script type="application/json" p-context>{"main":{"kind":"switch","data":"/view","discriminator":"type","cases":{"dashboard":{"kind":"data","data":"/dash","template":"./simple-template.html"}},"default":{"kind":"data","data":"/404","template":"./simple-template.html"}}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ main: { type: 'unknown', title: 'Default Page' } })
    const result = await rewriteFile(html, resolver, options)
    expect(result).toContain('Default Page')
  })

  test('switch without default and no match leaves target empty', async () => {
    const html = `<html><body><div p-target="main">Old</div><script type="application/json" p-context>{"main":{"kind":"switch","data":"/view","discriminator":"type","cases":{"dashboard":{"kind":"data","data":"/dash","template":"./simple-template.html"}}}}</script></body></html>`
    const resolver = (_ctx: unknown) => ({ main: { type: 'unknown' } })
    const result = await rewriteFile(html, resolver, options)
    expect(result).not.toContain('Old')
  })
})

describe('mode — useHtmlRewriter page', () => {
  const fixturesDir = `${import.meta.dir}/fixtures`

  test('page returns full HTML as string', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({}),
      cwd: fixturesDir,
    })
    const result = await rewriter.page('page-simple.html')
    expect(result).toContain('Simple page with no binding')
  })

  test('page with binding applies data', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({ title: 'Resolved via page' }),
      cwd: fixturesDir,
    })
    const result = await rewriter.page('include-target.html')
    expect(result).toContain('Resolved via page')
    expect(result).not.toContain('p-context')
  })

  test('page keeps <style> and <link> unchanged', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({ title: 'Styled' }),
      cwd: fixturesDir,
    })
    const result = await rewriter.page('dynamic-target.html')
    expect(result).toContain('<style>')
    expect(result).toContain('color: red')
  })
})

describe('mode — useHtmlRewriter dynamic', () => {
  const fixturesDir = `${import.meta.dir}/fixtures`

  test('dynamic returns TemplateObject', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({}),
      cwd: fixturesDir,
    })
    const result = await rewriter.dynamic('page-simple.html')
    expect(result).toHaveProperty('html')
    expect(result).toHaveProperty('stylesheets')
    expect(result).toHaveProperty('scale', SCALE.rel)
    expect(result).toHaveProperty('$', TEMPLATE_OBJECT_IDENTIFIER)
  })

  test('dynamic extracts <style> text into stylesheets and removes from html', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({ title: 'Styled' }),
      cwd: fixturesDir,
    })
    const result = await rewriter.dynamic('dynamic-target.html')
    expect(result.stylesheets).toContain('body { color: red; }')
    expect(result.html[0]).not.toContain('<style>')
  })

  test('dynamic rejects <link rel=stylesheet>', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({}),
      cwd: fixturesDir,
    })
    await expect(rewriter.dynamic('dynamic-with-link.html')).rejects.toThrow(/stylesheet/i)
  })

  test('dynamic merges multiple files: html concat, stylesheets deduped', async () => {
    const rewriter = useHtmlRewriter({
      dataResolver: (_ctx: unknown) => ({ title: 'Styled' }),
      cwd: fixturesDir,
    })
    const result = await rewriter.dynamic(['dynamic-target.html', 'page-simple.html'])
    expect(result.html).toHaveLength(2)
    expect(result.stylesheets).toContain('body { color: red; }')
  })
})
