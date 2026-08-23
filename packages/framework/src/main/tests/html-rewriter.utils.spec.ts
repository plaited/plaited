import { describe, expect, test } from 'bun:test'
import { validateAndEscapeHtml, validateAttributeValue } from '../html-rewriter.utils.ts'
import { ValidationError } from '../render.errors.ts'

describe('validateAndEscapeHtml — happy path', () => {
  test('valid HTML with no on* handlers returns the HTML unchanged', () => {
    const html = `<div class="card"><p>hello &amp; world</p></div>`
    expect(validateAndEscapeHtml(html)).toBe(html)
  })
})

describe('validateAndEscapeHtml — on* security', () => {
  test('on* attribute throws ValidationError with tag and attribute', () => {
    const html = `<div onclick="alert(1)">x</div>`
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors).toHaveLength(1)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'div', attribute: 'onclick' })
    expect(caught!.htmlErrors[0]!.message).toContain('onclick')
  })

  test('data-on is NOT an on* handler (does not start with on); on-foo IS blocked (starts with on)', () => {
    // data-on: starts with 'data', not 'on' -> allowed
    expect(() => validateAndEscapeHtml(`<div data-on="keep">x</div>`)).not.toThrow()
    // on-foo: starts with 'on' -> blocked (matches historical startsWith('on') policy)
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(`<div on-foo="bar">x</div>`)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors[0]!.attribute).toBe('on-foo')
  })
})

describe('validateAndEscapeHtml — schema validation', () => {
  test('schema-invalid attribute value throws ValidationError', () => {
    const html = `<a href="#" target="_invalid">link</a>`
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors).toHaveLength(1)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'a', attribute: 'target' })
  })

  test('schema-valid enum value does not throw', () => {
    expect(() => validateAndEscapeHtml(`<a href="#" target="_blank">link</a>`)).not.toThrow()
    expect(() => validateAndEscapeHtml(`<input type="text" />`)).not.toThrow()
  })
})

describe('validateAndEscapeHtml — aggregate errors', () => {
  test('collects violations across multiple elements and both kinds', () => {
    const html = `<div onclick="a()"><a target="_bad">x</a></div>`
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors).toHaveLength(2)
    const attrs = caught!.htmlErrors.map((e) => e.attribute).sort()
    expect(attrs).toEqual(['onclick', 'target'])
    // on* violation from the div, schema violation from the a
    expect(caught!.htmlErrors.some((e) => e.tag === 'div' && e.attribute === 'onclick')).toBe(true)
    expect(caught!.htmlErrors.some((e) => e.tag === 'a' && e.attribute === 'target')).toBe(true)
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
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'img', attribute: 'onerror' })
  })
})

describe('validateAndEscapeHtml — attribute escape', () => {
  test('quote-breakout in a single-quoted attribute is neutralized (" escaped)', () => {
    const html = `<div class='" onmouseover="alert(1)'>x</div>`
    // must not throw (onmouseover is INSIDE the value, not an attribute here)
    const out = validateAndEscapeHtml(html)
    // The breakout attempt must be defused: the inner " must be escaped to &quot;
    expect(out).toContain('class="')
    expect(out).not.toMatch(/onmouseover=alert/i) // no live handler leaks out
    expect(out).toContain('&quot; onmouseover=&quot;alert(1)')
  })

  test('already-escaped attribute entities are preserved (no double-escape)', () => {
    const html = `<div class="a &amp; b" data-x="&lt;raw&gt;">hi</div>`
    expect(validateAndEscapeHtml(html)).toBe(html)
  })
})

describe('validateAndEscapeHtml — combined HTML + CSS errors', () => {
  test('document with both HTML attribute and CSS errors throws one error carrying both', () => {
    const html = [
      `<html><head>`,
      `<style>.a { box-sizing: mah-box; }</style>`,
      `</head><body>`,
      `<div onclick="alert(1)">x</div>`,
      `</body></html>`,
    ].join('\n')
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    // HTML error: on* handler on the div
    expect(caught!.htmlErrors).toHaveLength(1)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'div', attribute: 'onclick' })
    // CSS error: invalid box-sizing value in the <style> block
    expect(caught!.cssErrors).toHaveLength(1)
    expect(caught!.cssErrors[0]).toMatchObject({ property: 'box-sizing', value: 'mah-box' })
  })
})

describe('validateAndEscapeHtml — CSS validation', () => {
  test('HTML with no <style> block does not throw', () => {
    expect(() => validateAndEscapeHtml('<html><body><p>hi</p></body></html>')).not.toThrow()
  })

  test('valid known declarations do not throw', () => {
    const html = `<style>.a { color: red; box-sizing: content-box; flex-direction: row; }</style>`
    expect(() => validateAndEscapeHtml(html)).not.toThrow()
  })

  test('var() reference on an enum property does not throw', () => {
    const html = `<style>.a { box-sizing: var(--bs); flex-direction: var( --fd ); }</style>`
    expect(() => validateAndEscapeHtml(html)).not.toThrow()
  })

  test('custom property --* declarations do not throw', () => {
    const html = `<style>.a { --my-var: 10px; --color: red; }</style>`
    expect(() => validateAndEscapeHtml(html)).not.toThrow()
  })

  test('unknown property names are browser-handled (no throw)', () => {
    const html = `<style>.a { colr: red; -x-unknown: 1px; }</style>`
    expect(() => validateAndEscapeHtml(html)).not.toThrow()
  })

  test('invalid enum value throws with line, property, value in cssErrors', () => {
    const html = `<style>.a { box-sizing: mah-box; }</style>`
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.cssErrors).toHaveLength(1)
    expect(caught!.cssErrors[0]).toMatchObject({ property: 'box-sizing', value: 'mah-box' })
    expect(caught!.cssErrors[0]!.line).toBe(1)
    expect(caught!.cssErrors[0]!.message).toContain('box-sizing')
  })

  test('@media prelude (max-width) is not mistaken for a declaration; inner decl is validated', () => {
    const html = `<style>
@media (max-width: 600px) {
  .a { flex-direction: sideways; }
}
</style>`
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.cssErrors).toHaveLength(1)
    expect(caught!.cssErrors[0]).toMatchObject({ property: 'flex-direction', value: 'sideways' })
    expect(caught!.cssErrors.some((e) => e.property === 'max-width')).toBe(false)
  })

  test('collects all invalid CSS declarations, not just the first', () => {
    const html = `<style>.a { box-sizing: mah-box; flex-direction: sideways; }</style>`
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.cssErrors).toHaveLength(2)
    expect(caught!.cssErrors.map((e) => e.property).sort()).toEqual(['box-sizing', 'flex-direction'])
  })

  test('line numbers are absolute across multiple lines and style blocks', () => {
    const html = [
      `<html><head>`,
      `<style>.a { box-sizing: bad; }</style>`,
      `<style>`,
      `@media (min-width: 1px) {`,
      `  .b { flex-direction: sideways; }`,
      `}`,
      `</style>`,
      `</head></html>`,
    ].join('\n')
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.cssErrors).toHaveLength(2)
    const boxErr = caught!.cssErrors.find((e) => e.property === 'box-sizing')!
    const flexErr = caught!.cssErrors.find((e) => e.property === 'flex-direction')!
    expect(boxErr.line).toBe(2)
    expect(flexErr.line).toBe(5)
  })

  test('& nesting: declarations inside & selectors are validated', () => {
    const html = [
      `<style>`,
      `.container {`,
      `  display: flex;`,
      `  & .card { box-sizing: mah-box; }`,
      `}`,
      `</style>`,
    ].join('\n')
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAndEscapeHtml(html)
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.cssErrors).toHaveLength(1)
    expect(caught!.cssErrors[0]).toMatchObject({ property: 'box-sizing', value: 'mah-box' })
    expect(caught!.cssErrors.some((e) => e.property === 'display')).toBe(false)
  })

  test('empty <style> and @media with no declarations do not throw', () => {
    const html = `<style></style><style>@media (max-width: 600px) {}</style>`
    expect(() => validateAndEscapeHtml(html)).not.toThrow()
  })
})

describe('validateAttributeValue — on* security', () => {
  test('on* attribute throws ValidationError', () => {
    expect(() => validateAttributeValue({ tag: 'div', attr: 'onclick', val: 'alert(1)' })).toThrow(ValidationError)
  })
})

describe('validateAttributeValue — schema validation', () => {
  test('valid p-scale value passes (no throw)', () => {
    expect(() => validateAttributeValue({ tag: 'div', attr: 'p-scale', val: 's3' })).not.toThrow()
  })

  test('invalid p-scale value throws ValidationError', () => {
    let caught: InstanceType<typeof ValidationError> | undefined
    try {
      validateAttributeValue({ tag: 'div', attr: 'p-scale', val: 's99' })
    } catch (err) {
      if (err instanceof ValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(ValidationError)
    expect(caught!.htmlErrors[0]).toMatchObject({ tag: 'div', attribute: 'p-scale' })
  })
})
