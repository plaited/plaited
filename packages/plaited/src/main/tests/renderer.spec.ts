import { describe, expect, test } from 'bun:test'
import type { BPEvent } from '../behavioral.schemas.ts'
import { P_TARGET, SCALE } from '../html.constants.ts'
import { RENDERER_RESULTS_MESSAGE_TYPES, SWAP_MODES } from '../message.constants.ts'
import { ValidationError } from '../render.errors.ts'
import { Renderer } from '../renderer.ts'

describe('Renderer — construction', () => {
  test('constructor owns the html string and html() returns it unchanged', () => {
    const r = new Renderer({ html: '<div>x</div>' })
    expect(r.html).toBe('<div>x</div>')
  })
})

describe('Renderer.render — swap modes', () => {
  test('innerHTML replaces inner content', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    r.render({ id: '1', target: 't', html: '<b>new</b>', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<div ${P_TARGET}="t"><b>new</b></div>`)
  })

  test('outerHTML replaces the element', () => {
    const r = new Renderer({ html: `<p>x</p><div ${P_TARGET}="t">old</div><p>y</p>` })
    r.render({ id: '1', target: 't', html: `<b>new</b>`, swap: SWAP_MODES.outerHTML })
    expect(r.html).toBe(`<p>x</p><b>new</b><p>y</p>`)
  })

  test('afterbegin inserts at start of inner content', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    r.render({ id: '1', target: 't', html: `<b>first</b>`, swap: SWAP_MODES.afterbegin })
    expect(r.html).toBe(`<div ${P_TARGET}="t"><b>first</b>old</div>`)
  })

  test('beforeend inserts at end of inner content', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    r.render({ id: '1', target: 't', html: `<b>last</b>`, swap: SWAP_MODES.beforeend })
    expect(r.html).toBe(`<div ${P_TARGET}="t">old<b>last</b></div>`)
  })

  test('beforebegin inserts before the element', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    r.render({ id: '1', target: 't', html: `<b>before</b>`, swap: SWAP_MODES.beforebegin })
    expect(r.html).toBe(`<b>before</b><div ${P_TARGET}="t">old</div>`)
  })

  test('afterend inserts after the element', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    r.render({ id: '1', target: 't', html: `<b>after</b>`, swap: SWAP_MODES.afterend })
    expect(r.html).toBe(`<div ${P_TARGET}="t">old</div><b>after</b>`)
  })
})

describe('Renderer.render — all-matches targeting', () => {
  test('two elements with the same p-target both get swapped', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">a</div><div ${P_TARGET}="t">b</div>` })
    r.render({ id: '1', target: 't', html: 'x', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<div ${P_TARGET}="t">x</div><div ${P_TARGET}="t">x</div>`)
  })
})

describe('Renderer.render — match param', () => {
  test("default match ('=') requires exact value", () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="user">x</div><div ${P_TARGET}="user-name">y</div>` })
    r.render({ id: '1', target: 'user', html: 'z', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<div ${P_TARGET}="user">z</div><div ${P_TARGET}="user-name">y</div>`)
  })

  test("match='^=' fills user-name and user-email but not other", () => {
    const r = new Renderer({
      html: `<div ${P_TARGET}="greeting">old</div><span ${P_TARGET}="user-name">name</span><span ${P_TARGET}="user-email">email</span><span ${P_TARGET}="other">keep</span>`,
    })
    r.render({ id: '1', target: 'user', html: 'filled', match: '^=', swap: SWAP_MODES.innerHTML })
    expect(r.html).toContain(`<span ${P_TARGET}="user-name">filled</span>`)
    expect(r.html).toContain(`<span ${P_TARGET}="user-email">filled</span>`)
    expect(r.html).toContain(`<span ${P_TARGET}="other">keep</span>`)
  })

  test("match='*=' substring matches", () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="alpha">a</div><div ${P_TARGET}="zeta">z</div>` })
    r.render({ id: '1', target: 'lph', html: 'x', match: '*=', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<div ${P_TARGET}="alpha">x</div><div ${P_TARGET}="zeta">z</div>`)
  })

  test("match='~=' space-list matches one of space-separated tokens", () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="a b c">x</div><div ${P_TARGET}="bc">y</div>` })
    r.render({ id: '1', target: 'b', html: 'z', match: '~=', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<div ${P_TARGET}="a b c">z</div><div ${P_TARGET}="bc">y</div>`)
  })

  test('zero matches is a no-op — html unchanged, no throw, returns render BPEvent', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">keep</div>` })
    const before = r.html
    const evt = r.render({ id: '1', target: 'nope', html: 'x', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(before)
    expect(evt.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.render_result)
  })
})

describe('Renderer.attrs — updateAttributes rules', () => {
  test('string set', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t" data-x="old"></div>` })
    r.attrs({ id: '1', target: 't', attr: { 'data-x': 'new' } })
    expect(r.html).toBe(`<div ${P_TARGET}="t" data-x="new"></div>`)
  })

  test('null + present → removeAttribute', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t" data-x="old"></div>` })
    r.attrs({ id: '1', target: 't', attr: { 'data-x': null } })
    expect(r.html).toBe(`<div ${P_TARGET}="t"></div>`)
  })

  test('null + absent → no-op', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div>` })
    const before = r.html
    r.attrs({ id: '1', target: 't', attr: { 'data-x': null } })
    expect(r.html).toBe(before)
  })

  test('BOOLEAN_ATTRS → set bare (present when absent)', () => {
    const r = new Renderer({ html: `<input ${P_TARGET}="t"/>` })
    r.attrs({ id: '1', target: 't', attr: { disabled: true } })
    // Bun serializes a valueless attribute as `disabled=""`
    expect(r.html).toBe(`<input ${P_TARGET}="t" disabled="" />`)
  })

  test('number coerced to string', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div>` })
    r.attrs({ id: '1', target: 't', attr: { 'data-n': 5 } })
    expect(r.html).toBe(`<div ${P_TARGET}="t" data-n="5"></div>`)
  })

  test('all-matches: same p-target on multiple elements → all updated', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div><div ${P_TARGET}="t"></div>` })
    r.attrs({ id: '1', target: 't', attr: { 'data-n': '1' } })
    expect(r.html).toBe(`<div ${P_TARGET}="t" data-n="1"></div><div ${P_TARGET}="t" data-n="1"></div>`)
  })

  test('match param on attrs (^=)', () => {
    const r = new Renderer({
      html: `<span ${P_TARGET}="user-name">name</span><span ${P_TARGET}="user-email">email</span><span ${P_TARGET}="other">keep</span>`,
    })
    r.attrs({ id: '1', target: 'user', match: '^=', attr: { 'data-set': '1' } })
    expect(r.html).toContain(`<span ${P_TARGET}="user-name" data-set="1">name</span>`)
    expect(r.html).toContain(`<span ${P_TARGET}="user-email" data-set="1">email</span>`)
    expect(r.html).toContain(`<span ${P_TARGET}="other">keep</span>`)
  })

  test('zero matches is a no-op — html unchanged, no throw, returns attrs BPEvent', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">keep</div>` })
    const before = r.html
    const evt = r.attrs({ id: '1', target: 'nope', attr: { 'data-x': '1' } })
    expect(r.html).toBe(before)
    expect(evt.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.attrs_result)
  })
})

describe('Renderer — BPEvent return shape', () => {
  test('render returns a render BPEvent whose detail.html carries the new state', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    const evt: BPEvent = r.render({ id: 'i1', target: 't', html: 'new', swap: SWAP_MODES.innerHTML })
    expect(evt.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.render_result)
    expect(evt.detail).toEqual({ id: 'i1', target: 't', html: `<div ${P_TARGET}="t">new</div>` })
  })

  test('attrs returns an attrs BPEvent whose detail.html carries the new state', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div>` })
    const evt: BPEvent = r.attrs({ id: 'i2', target: 't', attr: { 'data-n': 9 } })
    expect(evt.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.attrs_result)
    expect(evt.detail).toEqual({ id: 'i2', target: 't', html: `<div ${P_TARGET}="t" data-n="9"></div>` })
  })
})

describe('Renderer — buffer persistence', () => {
  test('a render → attrs → render sequence sees earlier mutations', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div>` })
    r.render({ id: '1', target: 't', html: '<span>first</span>', swap: SWAP_MODES.innerHTML })
    r.attrs({ id: '2', target: 't', attr: { 'data-n': '1' } })
    r.render({ id: '3', target: 't', html: '<b>second</b>', swap: SWAP_MODES.beforeend })
    expect(r.html).toBe(`<div ${P_TARGET}="t" data-n="1"><span>first</span><b>second</b></div>`)
  })
})

describe('Renderer — no stylesheet handling', () => {
  test('render does not touch a <style> in the HTML string', () => {
    const html = `<style>.x{color:red}</style><div ${P_TARGET}="t">old</div>`
    const r = new Renderer({ html })
    r.render({ id: '1', target: 't', html: 'new', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<style>.x{color:red}</style><div ${P_TARGET}="t">new</div>`)
  })
})

describe('Renderer — constructor validation', () => {
  test('constructor throws ValidationError on on* attribute in initial HTML', () => {
    expect(() => new Renderer({ html: `<div onclick="alert(1)">x</div>` })).toThrow(ValidationError)
  })

  test('constructor escapes attributes in initial HTML', () => {
    const r = new Renderer({ html: `<div class='"breakout'>x</div>` })
    expect(r.html).toContain('&quot;')
    expect(r.html).not.toMatch(/onclick|onerror/i)
  })
})

describe('Renderer.attrs — on* and schema validation', () => {
  test('attrs throws ValidationError when an on* attribute is requested', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div>` })
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      r.attrs({ id: '1', target: 't', attr: { onclick: 'alert(1)' } })
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'div', attribute: 'onclick' })
    // buffer unchanged after throw
    expect(r.html).toBe(`<div ${P_TARGET}="t"></div>`)
  })

  test('attrs throws ValidationError when a schema-invalid value is set', () => {
    const r = new Renderer({ html: `<a ${P_TARGET}="t" href="#"></a>` })
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      r.attrs({ id: '1', target: 't', attr: { target: '_bad' } })
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'a', attribute: 'target' })
  })

  test('attrs accepts a schema-valid enum value', () => {
    const r = new Renderer({ html: `<a ${P_TARGET}="t" href="#"></a>` })
    r.attrs({ id: '1', target: 't', attr: { target: '_blank' } })
    expect(r.html).toBe(`<a ${P_TARGET}="t" href="#" target="_blank"></a>`)
  })
})

describe('Renderer.render — payload validation', () => {
  test('render throws ValidationError when payload html contains an on* attribute', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    expect(() =>
      r.render({ id: '1', target: 't', html: `<div onclick="alert(1)">x</div>`, swap: SWAP_MODES.innerHTML }),
    ).toThrow(ValidationError)
    // buffer unchanged after throw
    expect(r.html).toBe(`<div ${P_TARGET}="t">old</div>`)
  })

  test('render validates payload even when no p-target matches (security: no silent XSS acceptance)', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    expect(() =>
      r.render({ id: '1', target: 'nope', html: `<div onclick="alert(1)">x</div>`, swap: SWAP_MODES.innerHTML }),
    ).toThrow(ValidationError)
  })

  test('render neutralizes quote-breakout in payload attributes', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    r.render({ id: '1', target: 't', html: `<b class='"breakout'>new</b>`, swap: SWAP_MODES.innerHTML })
    expect(r.html).toContain('&quot;')
    expect(r.html).not.toMatch(/onclick|onerror/i)
  })

  test('render validates CSS in payload <style> blocks', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    expect(() =>
      r.render({
        id: '1',
        target: 't',
        html: `<style>.a { box-sizing: mah-box; }</style>new`,
        swap: SWAP_MODES.innerHTML,
      }),
    ).toThrow(ValidationError)
  })
})

describe('Renderer.scaleCheck — into modes (self boundary)', () => {
  test('target with own p-scale returns that scale', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t" p-scale="s3">old</div>` })
    const result = r.scaleCheck({ id: '1', target: 't', swap: SWAP_MODES.innerHTML })
    expect(result).toEqual({
      type: RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result,
      detail: { id: '1', target: 't', effectiveScale: SCALE.s3 },
    })
  })

  test('target without own p-scale inherits nearest ancestor scale', () => {
    const r = new Renderer({
      html: `<section p-scale="s5"><article p-scale="s3"><span ${P_TARGET}="t">x</span></article></section>`,
    })
    const result = r.scaleCheck({ id: '1', target: 't', swap: SWAP_MODES.innerHTML })
    expect(result.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result)
    expect(result.detail).toEqual({ id: '1', target: 't', effectiveScale: SCALE.s3 })
  })
})

describe('Renderer.scaleCheck — replace/beside modes (parent boundary)', () => {
  test('outerHTML uses parent scale, ignores target own p-scale', () => {
    const r = new Renderer({
      html: `<section p-scale="s5"><span ${P_TARGET}="t" p-scale="s1">x</span></section>`,
    })
    const result = r.scaleCheck({ id: '1', target: 't', swap: SWAP_MODES.outerHTML })
    expect(result.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result)
    expect(result.detail).toEqual({ id: '1', target: 't', effectiveScale: SCALE.s5 })
  })
})

describe('Renderer.scaleCheck — no scale found', () => {
  test('no p-scale anywhere returns rel', () => {
    const r = new Renderer({ html: `<div><span ${P_TARGET}="t">x</span></div>` })
    const result = r.scaleCheck({ id: '1', target: 't', swap: SWAP_MODES.innerHTML })
    expect(result.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result)
    expect(result.detail).toEqual({ id: '1', target: 't', effectiveScale: SCALE.rel })
  })

  test('zero matches returns rel', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">x</div>` })
    const result = r.scaleCheck({ id: '1', target: 'nope', swap: SWAP_MODES.innerHTML })
    expect(result.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result)
    expect(result.detail).toEqual({ id: '1', target: 'nope', effectiveScale: SCALE.rel })
  })
})

describe('Renderer.scaleCheck — multiple matches', () => {
  test('most restrictive (lowest rank) across matches wins', () => {
    const r = new Renderer({
      html: `<section p-scale="s5"><div ${P_TARGET}="t">a</div></section><article p-scale="s2"><div ${P_TARGET}="t">b</div></article>`,
    })
    const result = r.scaleCheck({ id: '1', target: 't', swap: SWAP_MODES.innerHTML })
    expect(result.type).toBe(RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result)
    expect(result.detail).toEqual({ id: '1', target: 't', effectiveScale: SCALE.s2 })
  })
})
