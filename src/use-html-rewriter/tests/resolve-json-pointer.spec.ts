import { describe, expect, test } from 'bun:test'
import { resolveJsonPointer } from '../resolve-json-pointer.ts'
import { InvalidDescriptorError } from '../use-html-rewriter.errors.ts'

describe('resolveJsonPointer', () => {
  const data = {
    foo: { bar: [1, 2, 3], baz: 'hello' },
    '': 'root-value',
    items: [
      { name: 'a', price: 10 },
      { name: 'b', price: 20 },
    ],
    tilde: { '~test': 'tilde-ok', '/test': 'slash-ok' },
  }

  test('empty pointer returns whole document', () => {
    expect(resolveJsonPointer(data, '')).toBe(data)
  })

  test('root key access with "/"', () => {
    expect(resolveJsonPointer(data, '/')).toBe('root-value')
  })

  test('simple object key', () => {
    expect(resolveJsonPointer(data, '/foo')).toEqual({ bar: [1, 2, 3], baz: 'hello' })
  })

  test('nested object key', () => {
    expect(resolveJsonPointer(data, '/foo/baz')).toBe('hello')
  })

  test('array index access', () => {
    expect(resolveJsonPointer(data, '/foo/bar/0')).toBe(1)
    expect(resolveJsonPointer(data, '/foo/bar/2')).toBe(3)
  })

  test('nested array of objects', () => {
    expect(resolveJsonPointer(data, '/items/0/name')).toBe('a')
    expect(resolveJsonPointer(data, '/items/1/price')).toBe(20)
  })

  test('tilde escape: ~0 → ~', () => {
    expect(resolveJsonPointer(data, '/tilde/~0test')).toBe('tilde-ok')
  })

  test('slash escape: ~1 → /', () => {
    expect(resolveJsonPointer(data, '/tilde/~1test')).toBe('slash-ok')
  })

  test('primitive values', () => {
    expect(resolveJsonPointer(data, '/foo/bar/0')).toBe(1)
  })

  test('throws InvalidDescriptorError for missing key', () => {
    expect(() => resolveJsonPointer(data, '/foo/missing')).toThrow(InvalidDescriptorError)
  })

  test('throws InvalidDescriptorError for out-of-bounds array index', () => {
    expect(() => resolveJsonPointer(data, '/foo/bar/99')).toThrow(InvalidDescriptorError)
  })

  test('throws InvalidDescriptorError for negative array index', () => {
    expect(() => resolveJsonPointer(data, '/foo/bar/-1')).toThrow(InvalidDescriptorError)
  })

  test('throws InvalidDescriptorError for non-numeric index on array', () => {
    expect(() => resolveJsonPointer(data, '/foo/bar/abc')).toThrow(InvalidDescriptorError)
  })

  test('throws InvalidDescriptorError when data is null', () => {
    expect(() => resolveJsonPointer(null, '/foo')).toThrow(InvalidDescriptorError)
  })

  test('throws InvalidDescriptorError when data is a primitive', () => {
    expect(() => resolveJsonPointer(42, '/foo')).toThrow(InvalidDescriptorError)
  })

  test('throws InvalidDescriptorError when traversing into a primitive', () => {
    expect(() => resolveJsonPointer({ a: 42 }, '/a/b')).toThrow(InvalidDescriptorError)
  })
})
