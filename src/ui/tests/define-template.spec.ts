import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { JsonObjectSchema } from '../../shared.ts'
import { defineTemplate } from '../define-template.ts'
import { PLAITED_TEMPLATE_IDENTIFIER, TEMPLATE_OBJECT_IDENTIFIER } from '../template.constants.ts'
import { fragment, h, ScaleViolantionError } from '../template.ts'

describe('defineTemplate', () => {
  test('returns a function template', () => {
    const tpl = defineTemplate({
      scale: 'rel',
      template: ({ h: _h }) => _h('div'),
    })
    expect(typeof tpl).toBe('function')
    expect(tpl.$).toBe(PLAITED_TEMPLATE_IDENTIFIER)
    expect(tpl.scale).toBe('rel')
  })

  test('returned function delegates to template with attrs, h, fragment', () => {
    const tpl = defineTemplate({
      scale: 'rel',
      template: ({ attrs, h: _h }) => _h('span', { ...attrs }),
    })
    const result = tpl({
      attrs: { class: 'greeting' },
      h,
      fragment,
    })
    expect(result.html.join('')).toContain('<span')
    expect(result.html.join('')).toContain('class="greeting"')
  })

  test('validates attrs against inputSchema', () => {
    const tpl = defineTemplate({
      inputSchema: JsonObjectSchema,
      scale: 'rel',
      template: ({ attrs, h: _h }) => _h('div', { ...attrs }),
    })
    // JsonObjectSchema is a record — passing non-object should fail
    expect(() =>
      tpl({
        attrs: 'not-an-object' as never,
        h,
        fragment,
      }),
    ).toThrow()
  })

  test('accepts valid attrs through inputSchema', () => {
    const tpl = defineTemplate({
      inputSchema: JsonObjectSchema,
      scale: 'rel',
      template: ({ attrs, h: _h }) => _h('div', { ...attrs }),
    })
    const result = tpl({
      attrs: { name: 'Alice' },
      h,
      fragment,
    })
    expect(result.html.join('')).toContain('Alice')
  })

  test('passes through h and fragment to template', () => {
    const tpl = defineTemplate({
      scale: 'rel',
      template: ({ h: _h, fragment: _fragment }) => {
        const content = _fragment(['hello'])
        return _h('p', { children: content })
      },
    })
    const result = tpl({
      h,
      fragment,
    })
    expect(result.html.join('')).toBe('<p >hello</p>')
  })

  test('throws ScaleViolantionError when child scale exceeds container', () => {
    const tpl = defineTemplate({
      scale: 'rel',
      template: () => ({
        html: ['<section></section>'],
        stylesheets: [],
        registry: [],
        scale: 's4' as const,
        $: TEMPLATE_OBJECT_IDENTIFIER,
      }),
    })
    expect(() =>
      tpl({
        attrs: {},
        h,
        fragment,
      }),
    ).toThrow(ScaleViolantionError)
  })

  test('throws ZodError when constrained schema fields are invalid', () => {
    const NameSchema = z.object({ name: z.string().min(1) }).catchall(z.json())
    const tpl = defineTemplate({
      inputSchema: NameSchema,
      scale: 'rel',
      template: ({ attrs, h: _h }) => _h('span', { ...attrs }),
    })
    // Missing required field
    expect(() =>
      tpl({
        h,
        fragment,
      }),
    ).toThrow(z.ZodError)
    // Wrong type
    expect(() =>
      tpl({
        attrs: { name: 42 } as never,
        h,
        fragment,
      }),
    ).toThrow(z.ZodError)
  })

  test('empty schema accepts any attrs', () => {
    const tpl = defineTemplate({
      scale: 'rel',
      template: ({ attrs, h: _h }) => _h('div', { ...attrs }),
    })
    // No schema provided — EmptySchema default, any valid JsonObject passes
    const result = tpl({
      attrs: { foo: 'bar', count: 1 },
      h,
      fragment,
    })
    expect(result.html.join('')).toContain('foo="bar"')
    expect(result.html.join('')).toContain('count="1"')
  })

  test('accepts child scale within container boundary', () => {
    const tpl = defineTemplate({
      scale: 's4',
      template: () => ({
        html: ['<section></section>'],
        stylesheets: [],
        registry: [],
        scale: 's2' as const,
        $: TEMPLATE_OBJECT_IDENTIFIER,
      }),
    })
    const result = tpl({
      h,
      fragment,
    })
    expect(result.html.join('')).toBe('<section></section>')
  })
})
