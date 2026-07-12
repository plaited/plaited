import { describe, expect, test } from 'bun:test'
import { B_PROGRAM_MESSAGE_TYPES, SWAP_MODES } from '../../../b-program/message.constants.ts'
import type { BPEvent } from '../../../behavioral.ts'
import { P_TARGET } from '../../html.constants.ts'
import { Renderer } from '../renderer.ts'

const BASE = `<main>
  <div ${P_TARGET}="greeting">old</div>
  <span ${P_TARGET}="user-name">name</span>
  <span ${P_TARGET}="user-email">email</span>
  <span ${P_TARGET}="other">keep</span>
</main>`

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
  test("match='^=' fills user-name and user-email but not other", () => {
    const r = new Renderer({ html: BASE })
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

  test("default match ('=') requires exact value", () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="user">x</div><div ${P_TARGET}="user-name">y</div>` })
    r.render({ id: '1', target: 'user', html: 'z', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(`<div ${P_TARGET}="user">z</div><div ${P_TARGET}="user-name">y</div>`)
  })

  test('zero matches is a no-op — html unchanged, no throw', () => {
    const r = new Renderer({ html: BASE })
    const before = r.html
    const evt = r.render({ id: '1', target: 'nope', html: 'x', swap: SWAP_MODES.innerHTML })
    expect(r.html).toBe(before)
    expect(evt.type).toBe(B_PROGRAM_MESSAGE_TYPES.render)
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
    const r = new Renderer({ html: BASE })
    r.attrs({ id: '1', target: 'user', match: '^=', attr: { 'data-set': '1' } })
    expect(r.html).toContain(`<span ${P_TARGET}="user-name" data-set="1">name</span>`)
    expect(r.html).toContain(`<span ${P_TARGET}="user-email" data-set="1">email</span>`)
    expect(r.html).toContain(`<span ${P_TARGET}="other">keep</span>`)
  })

  test('zero matches is a no-op — html unchanged, no throw', () => {
    const r = new Renderer({ html: BASE })
    const before = r.html
    const evt = r.attrs({ id: '1', target: 'nope', attr: { 'data-x': '1' } })
    expect(r.html).toBe(before)
    expect(evt.type).toBe(B_PROGRAM_MESSAGE_TYPES.attrs)
  })
})

describe('Renderer — BPEvent return shape', () => {
  test('render returns a render BPEvent whose detail.html carries the new state', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t">old</div>` })
    const evt: BPEvent = r.render({ id: 'i1', target: 't', html: 'new', swap: SWAP_MODES.innerHTML })
    expect(evt.type).toBe(B_PROGRAM_MESSAGE_TYPES.render)
    expect(evt.detail).toEqual({ id: 'i1', target: 't', html: `<div ${P_TARGET}="t">new</div>` })
  })

  test('attrs returns an attrs BPEvent whose detail.html carries the new state', () => {
    const r = new Renderer({ html: `<div ${P_TARGET}="t"></div>` })
    const evt: BPEvent = r.attrs({ id: 'i2', target: 't', attr: { 'data-n': 9 } })
    expect(evt.type).toBe(B_PROGRAM_MESSAGE_TYPES.attrs)
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
