import { describe, expect, test } from 'bun:test'
import { CssValidationError, validateCss } from '../validate-css.ts'

describe('validateCss — happy path', () => {
  test('HTML with no <style> block does not throw', () => {
    expect(() => validateCss('<html><body><p>hi</p></body></html>')).not.toThrow()
  })

  test('valid known declarations do not throw', () => {
    const html = `<style>.a { color: red; box-sizing: content-box; flex-direction: row; }</style>`
    expect(() => validateCss(html)).not.toThrow()
  })

  test('var() reference on an enum property does not throw', () => {
    const html = `<style>.a { box-sizing: var(--bs); flex-direction: var( --fd ); }</style>`
    expect(() => validateCss(html)).not.toThrow()
  })

  test('custom property --* declarations do not throw', () => {
    const html = `<style>.a { --my-var: 10px; --color: red; }</style>`
    expect(() => validateCss(html)).not.toThrow()
  })

  test('unknown property names are browser-handled (no throw)', () => {
    const html = `<style>.a { colr: red; -x-unknown: 1px; }</style>`
    expect(() => validateCss(html)).not.toThrow()
  })
})

describe('validateCss — error path', () => {
  test('invalid enum value throws CssValidationError with line, property, value', () => {
    const html = `<style>.a { box-sizing: mah-box; }</style>`
    let caught: InstanceType<typeof CssValidationError> | undefined
    try {
      validateCss(html)
    } catch (err) {
      if (err instanceof CssValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(CssValidationError)
    expect(caught!.errors).toHaveLength(1)
    expect(caught!.errors[0]).toMatchObject({ property: 'box-sizing', value: 'mah-box' })
    expect(caught!.errors[0]!.line).toBe(1)
    expect(caught!.errors[0]!.message).toContain('box-sizing')
  })

  test('@media prelude (max-width) is not mistaken for a declaration; inner decl is validated', () => {
    const html = `<style>
@media (max-width: 600px) {
  .a { flex-direction: sideways; }
}
</style>`
    let caught: InstanceType<typeof CssValidationError> | undefined
    try {
      validateCss(html)
    } catch (err) {
      if (err instanceof CssValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(CssValidationError)
    expect(caught!.errors).toHaveLength(1)
    expect(caught!.errors[0]).toMatchObject({ property: 'flex-direction', value: 'sideways' })
    // max-width: 600px must NOT appear as an error
    expect(caught!.errors.some((e) => e.property === 'max-width')).toBe(false)
  })

  test('collects all invalid declarations across the block, not just the first', () => {
    const html = `<style>.a { box-sizing: mah-box; flex-direction: sideways; }</style>`
    let caught: InstanceType<typeof CssValidationError> | undefined
    try {
      validateCss(html)
    } catch (err) {
      if (err instanceof CssValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(CssValidationError)
    expect(caught!.errors).toHaveLength(2)
    expect(caught!.errors.map((e) => e.property).sort()).toEqual(['box-sizing', 'flex-direction'])
  })
})

describe('validateCss — line numbers and multiple blocks', () => {
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
    let caught: InstanceType<typeof CssValidationError> | undefined
    try {
      validateCss(html)
    } catch (err) {
      if (err instanceof CssValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(CssValidationError)
    expect(caught!.errors).toHaveLength(2)
    const boxErr = caught!.errors.find((e) => e.property === 'box-sizing')!
    const flexErr = caught!.errors.find((e) => e.property === 'flex-direction')!
    // box-sizing is on html line 2; flex-direction is on html line 5
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
    let caught: InstanceType<typeof CssValidationError> | undefined
    try {
      validateCss(html)
    } catch (err) {
      if (err instanceof CssValidationError) caught = err
    }
    expect(caught).toBeInstanceOf(CssValidationError)
    expect(caught!.errors).toHaveLength(1)
    expect(caught!.errors[0]).toMatchObject({ property: 'box-sizing', value: 'mah-box' })
    // display: flex on line 3 is permissive -> not an error
    expect(caught!.errors.some((e) => e.property === 'display')).toBe(false)
  })

  test('empty <style> and @media with no declarations do not throw', () => {
    const html = `<style></style><style>@media (max-width: 600px) {}</style>`
    expect(() => validateCss(html)).not.toThrow()
  })
})
