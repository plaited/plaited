import { assertEquals } from '../../dev-deps.ts'
import { escape, unescape } from '../mod.ts'

Deno.test('escape(): correct escape', () => {
  assertEquals(escape('&<>\'"'), '&amp;&lt;&gt;&#39;&quot;')
})
Deno.test('escape(): correct inverted escape', () => {
  assertEquals(escape('<>\'"&'), '&lt;&gt;&#39;&quot;&amp;')
})
Deno.test('unescape(): correct unescape', () => {
  assertEquals(unescape('&amp;&lt;&gt;&#39;&quot;'), '&<>\'"')
})
Deno.test('unescape(): correct inverted unescape', () => {
  assertEquals(unescape('&lt;&gt;&#39;&quot;&amp;'), '<>\'"&')
})
