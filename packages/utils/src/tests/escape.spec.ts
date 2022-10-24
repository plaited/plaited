import { assert } from '@esm-bundle/chai'
import { escape, unescape } from '../'

describe('escape()', () => {
  it('correct escape', () => {
    assert.equal(escape('&<>\'"'), '&amp;&lt;&gt;&#39;&quot;')
  })
  it('correct inverted escape', () => {
    assert.equal(escape('<>\'"&'), '&lt;&gt;&#39;&quot;&amp;')
  })
  it('correct unescape', () => {
    assert.equal(unescape('&amp;&lt;&gt;&#39;&quot;'), '&<>\'"')
  })
  it('correct inverted unescape', () => {
    assert.equal(unescape('&lt;&gt;&#39;&quot;&amp;'), '<>\'"&')
  })
})
