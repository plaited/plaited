import { template } from '../template.ts'
import { html } from '../html.ts'
import { assertSnapshot } from '../../dev-deps.ts'
import { css } from '../css.ts'

Deno.test('template()', (t) => {
  const generateData = (num: number) =>
    [...Array(num).keys()].map((i) => `item-${i}`)
  const ListTemplate = template<{ data: string[] }>(({ data }) =>
    html`<ul>${data.map((str) => html`<li>${str}</li>`)}</ul>`
  )
  assertSnapshot(t, ListTemplate({ data: generateData(1) }), 'on item')
  assertSnapshot(t, ListTemplate({ data: generateData(10) }), '10 items')
  assertSnapshot(t, ListTemplate({ data: generateData(100) }), '100 items')
})

Deno.test('template.css', (t) => {
  const ListTemplate = template<{ data: string[] }>(({ data }) =>
    html`<ul>${data.map((str) => html`<li>${str}</li>`)}</ul>`
  )
  ListTemplate.styles.add(css`a { color: purple}`.styles)
  assertSnapshot(t, html`${[...ListTemplate.styles]}`, 'single stylesheet')
  ListTemplate.styles.add(css`button { color: blue}`.styles)
  assertSnapshot(t, html`${[...ListTemplate.styles]}`, 'add another stylesheet')
})
