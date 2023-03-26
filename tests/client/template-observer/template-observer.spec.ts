import { html, isle } from '$plaited'
import { test } from '../test.ts'

test('template observer', async (t) => {
  const wrapper = document.getElementById('root') as HTMLDetailsElement
  const el = document.createElement('template-test')
  el.setAttribute('data-test-id', 'island')
  wrapper?.insertAdjacentElement('beforeend', el)
  const template = document.createElement('template')
  template.innerHTML = html`<h2>template content</h2>`
  template.setAttribute('shadowrootmode', 'open')
  let island = await t.findByAttribute('data-test-id', 'island', wrapper)
  isle(
    { tag: 'template-test' },
    (base) =>
      class extends base {
        plait() {
          island?.append(template)
          t({
            given: 'before being observed by template observer',
            should: 'still be in light dom',
            actual: island?.innerHTML,
            expected:
              html`<template shadowrootmode="open"><h2>template content</h2></template>`,
          })
        }
      },
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
    expected: html`<h2>template content</h2>`,
  })
})
