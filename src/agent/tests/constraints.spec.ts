import { describe, expect, test } from 'bun:test'
import { hasInlineStyles, hasRawColors } from '../constraints.ts'

describe('hasRawColors', () => {
  test('detects hex colors', () => {
    expect(hasRawColors('#fff')).toBe(true)
    expect(hasRawColors('#ffffff')).toBe(true)
    expect(hasRawColors('#FF0000')).toBe(true)
    expect(hasRawColors('#00ff00ff')).toBe(true)
  })

  test('detects rgb colors', () => {
    expect(hasRawColors('rgb(255, 0, 0)')).toBe(true)
    expect(hasRawColors('RGB(0, 255, 0)')).toBe(true)
    expect(hasRawColors('background: rgb(100, 100, 100);')).toBe(true)
  })

  test('detects rgba colors', () => {
    expect(hasRawColors('rgba(255, 0, 0, 0.5)')).toBe(true)
    expect(hasRawColors('RGBA(0, 255, 0, 1)')).toBe(true)
  })

  test('detects hsl colors', () => {
    expect(hasRawColors('hsl(120, 100%, 50%)')).toBe(true)
    expect(hasRawColors('HSL(240, 50%, 75%)')).toBe(true)
  })

  test('returns false for token references', () => {
    expect(hasRawColors('var(--color-primary)')).toBe(false)
    expect(hasRawColors('tokens.color.primary')).toBe(false)
  })

  test('returns false for content without colors', () => {
    expect(hasRawColors('<button>Click me</button>')).toBe(false)
    expect(hasRawColors('const x = 123')).toBe(false)
  })

  test('detects colors in JSX content', () => {
    const jsx = `
			<div style={{ backgroundColor: '#ff0000' }}>
				Content
			</div>
		`
    expect(hasRawColors(jsx)).toBe(true)
  })
})

describe('hasInlineStyles', () => {
  test('detects style attribute with double quotes', () => {
    expect(hasInlineStyles('<div style="color: red">')).toBe(true)
  })

  test('detects style attribute with single quotes', () => {
    expect(hasInlineStyles("<div style='color: red'>")).toBe(true)
  })

  test('detects style attribute with curly braces (JSX)', () => {
    expect(hasInlineStyles('<div style={{ color: "red" }}>')).toBe(true)
  })

  test('returns false for className', () => {
    expect(hasInlineStyles('<div className="container">')).toBe(false)
  })

  test('returns false for styled content', () => {
    expect(hasInlineStyles('<StyledButton>Click</StyledButton>')).toBe(false)
  })

  test('handles multiline content', () => {
    const content = `
			<div
				className="wrapper"
				style={{ padding: '1rem' }}
			>
				Content
			</div>
		`
    expect(hasInlineStyles(content)).toBe(true)
  })
})
