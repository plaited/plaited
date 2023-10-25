import { createComponent } from '../index.js'
import { test } from '@plaited/rite'

test('template observer', async t => {
  const wrapper = document.querySelector('body')
  const el = document.createElement('template-test')
  el.setAttribute('data-test-id', 'island')
  wrapper?.insertAdjacentElement('beforeend', el)
  const template = document.createElement('template')
  template.innerHTML = `<h2>template content</h2>`
  template.setAttribute('shadowrootmode', 'open')
  let island = await t.findByAttribute('data-test-id', 'island', wrapper)
  createComponent(
    { tag: 'template-test' },
    base =>
      class extends base {
        plait() {
          island?.append(template)
          t({
            given: 'before being observed by template observer',
            should: 'still be in light dom',
            actual: island?.innerHTML,
            expected:
              `<template shadowrootmode="open"><h2>template content</h2></template>`,
          })
        }
      }
  )()
  island = await t.findByAttribute('data-test-id', 'island', wrapper)
  t({
    given: 'after template append is observed by observer',
    should: 'no longer be in light dom',
    actual: island?.innerHTML,
    expected: '',
  })
  t({
    given: 'appending template in connected callback',
    should: 'should now be in shadow dom',
    actual: island?.shadowRoot?.innerHTML,
    expected: `<h2>template content</h2>`,
  })
})
