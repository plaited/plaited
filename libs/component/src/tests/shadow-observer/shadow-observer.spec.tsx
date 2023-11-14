import { test } from '@plaited/rite'
import { ShadowIsland } from './shadow.island.js'

test('shadow observer test', async (t) => {
  customElements.define(ShadowIsland.tag, ShadowIsland)
  const body = document.querySelector('body')
  body.insertAdjacentElement('beforeend', document.createElement(ShadowIsland.tag))

  let button = await t.findByAttribute('data-trigger', 'click->start')
  button && (await t.fireEvent(button, 'click'))
  let row = await t.findByAttribute('data-target', 'button-row')
  t({
    given: 'clicking start',
    should: 'have add button in row',
    actual: row?.childElementCount,
    expected: 3,
  })

  button && (await t.fireEvent(button, 'click'))
  row = await t.findByAttribute('data-target', 'button-row')
  t({
    given: 'clicking start again',
    should: 'not add another button to row',
    actual: row?.children.length,
    expected: 3,
  })

  button = await t.findByAttribute('data-trigger', 'click->addButton')
  button && (await t.fireEvent(button, 'click'))
  button = await t.findByText<HTMLButtonElement>('add svg')

  t({
    given: 'request to append `add svg` button',
    should: 'new button should be in dom',
    actual: button?.innerText,
    expected: 'add svg',
  })

  button && (await t.fireEvent(button, 'click'))
  let zone = await t.findByAttribute('data-target', 'zone')
  t({
    given: 'clicking add svg',
    should: 'adds a svg to zone',
    actual: zone?.children.length,
    expected: 1,
  })
  const svg = await t.findByAttribute('data-target', 'svg')
  t({
    given: 'add-svg event',
    should: 'zone child is an svg',
    actual: svg?.tagName,
    expected: 'SVG',
  })

  button = await t.findByText('add svg')
  button && (await t.fireEvent(button, 'click'))
  zone = await t.findByAttribute('data-target', 'zone')
  t({
    given: 'clicking add svg again',
    should: 'not add another svg to zone',
    actual: zone?.children.length,
    expected: 1,
  })

  svg && (await t.fireEvent(svg, 'click'))
  button && (await t.fireEvent(button, 'click'))
  const h3 = await t.findByText('sub island')
  t({
    given: 'removeSvg event triggered',
    should: 'still have children in zone appended in subsequent sync step',
    actual: zone?.children.length,
    expected: 1,
  })
  t({
    given: 'append of sub-island with declarative shadowdom ',
    should: `sub-island upgraded and thus it's content are queryable`,
    actual: h3?.tagName,
    expected: 'H3',
  })
})
