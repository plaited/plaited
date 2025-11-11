import { test, expect } from 'bun:test'
import { escape, unescape } from 'plaited/utils'

test('escape(): correct escape', () => {
  expect(escape('&<>\'"')).toBe('&amp;&lt;&gt;&#39;&quot;')
})
test('escape(): correct inverted escape', () => {
  expect(escape('<>\'"&')).toBe('&lt;&gt;&#39;&quot;&amp;')
})
test('unescape(): correct unescape', () => {
  expect(unescape('&amp;&lt;&gt;&#39;&quot;')).toBe('&<>\'"')
})
test('unescape(): correct inverted unescape', () => {
  expect(unescape('&lt;&gt;&#39;&quot;&amp;')).toBe('<>\'"&')
})
