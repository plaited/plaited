import { describe, expect, test } from 'bun:test'
import { HtmlValidationError, validateAndEscapeHtml } from '../validate-and-escape-html.ts'

describe('validateAndEscapeHtml — happy path', () => {
  test('valid HTML with no on* handlers returns the HTML unchanged', () => {
    const html = `<div class="card"><p>hello &amp; world</p></div>`
    expect(validateAndEscapeHtml(html)).toBe(html)
  })
})

describe('validateAndEscapeHtml — on* security', () => {
  test('on* attribute throws HtmlValidationError with tag and attribute', () => {
    const html = `<div onclick="alert(1)">x</div>`
    let caught: InstanceType<typeof HtmlValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof HtmlValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(HtmlValidationError)
    expect(caught!.errors).toHaveLength(1)
    expect(caught!.errors[0]).toMatchObject({ tag: 'div', attribute: 'onclick' })
    expect(caught!.errors[0]!.message).toContain('onclick')
  })

  test('data-on is NOT an on* handler (does not start with on); on-foo IS blocked (starts with on)', () => {
    // data-on: starts with 'data', not 'on' -> allowed
    expect(() => validateAndEscapeHtml(`<div data-on="keep">x</div>`)).not.toThrow()
    // on-foo: starts with 'on' -> blocked (matches historical startsWith('on') policy)
    let caught: InstanceType<typeof HtmlValidationError> | undefined
    try {
      validateAndEscapeHtml(`<div on-foo="bar">x</div>`)
    } catch (err) {
      if (err instanceof HtmlValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(HtmlValidationError)
    expect(caught!.errors[0]!.attribute).toBe('on-foo')
  })
})

describe('validateAndEscapeHtml — schema validation', () => {
  test('schema-invalid attribute value throws HtmlValidationError', () => {
    const html = `<a href="#" target="_invalid">link</a>`
    let caught: InstanceType<typeof HtmlValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof HtmlValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(HtmlValidationError)
    expect(caught!.errors).toHaveLength(1)
    expect(caught!.errors[0]).toMatchObject({ tag: 'a', attribute: 'target' })
  })

  test('schema-valid enum value does not throw', () => {
    expect(() => validateAndEscapeHtml(`<a href="#" target="_blank">link</a>`)).not.toThrow()
    expect(() => validateAndEscapeHtml(`<input type="text" />`)).not.toThrow()
  })
})

describe('validateAndEscapeHtml — aggregate errors', () => {
  test('collects violations across multiple elements and both kinds', () => {
    const html = `<div onclick="a()"><a target="_bad">x</a></div>`
    let caught: InstanceType<typeof HtmlValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof HtmlValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(HtmlValidationError)
    expect(caught!.errors).toHaveLength(2)
    const attrs = caught!.errors.map((e) => e.attribute).sort()
    expect(attrs).toEqual(['onclick', 'target'])
    // on* violation from the div, schema violation from the a
    expect(caught!.errors.some((e) => e.tag === 'div' && e.attribute === 'onclick')).toBe(true)
    expect(caught!.errors.some((e) => e.tag === 'a' && e.attribute === 'target')).toBe(true)
  })
})

describe('validateAndEscapeHtml — text not escaped', () => {
  test('text entities are preserved (no double-escaping)', () => {
    const html = `<p>Tom &amp; Jerry &lt;raw&gt;</p>`
    expect(validateAndEscapeHtml(html)).toBe(html)
  })
})

describe('validateAndEscapeHtml — element coverage', () => {
  test('void and nested elements are validated; valid void HTML passes unchanged', () => {
    const html = `<div><img src="x.png" alt="pic" /><br /><span>ok</span></div>`
    expect(validateAndEscapeHtml(html)).toBe(html)
  })

  test('on* on a void element is caught', () => {
    const html = `<img src="x" onerror="alert(1)" />`
    let caught: InstanceType<typeof HtmlValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof HtmlValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(HtmlValidationError)
    expect(caught!.errors[0]).toMatchObject({ tag: 'img', attribute: 'onerror' })
  })
})
