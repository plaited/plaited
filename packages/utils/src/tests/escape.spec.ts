import test from 'ava'
import { escape, unescape } from '../index.js'

test('escape(): correct escape', t => {
  t.is(escape('&<>\'"'), '&amp;&lt;&gt;&#39;&quot;')
})
test('escape(): correct inverted escape', t => {
  t.is(escape('<>\'"&'), '&lt;&gt;&#39;&quot;&amp;')
})
test('unescape(): correct unescape', t => {
  t.is(unescape('&amp;&lt;&gt;&#39;&quot;'), '&<>\'"')
})
test('unescape(): correct inverted unescape', t => {
  t.is(unescape('&lt;&gt;&#39;&quot;&amp;'), '<>\'"&')
})

