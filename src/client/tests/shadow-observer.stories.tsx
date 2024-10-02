import { StoryObj } from '../../workshop/workshop.types.js'
import { ShadowIsland } from './shadow-observer/shadow.island.js'

export const shadowObserver: StoryObj = {
  template: ShadowIsland,
  play: async ({ assert, findByAttribute, findByText, fireEvent }) => {
    let button = await findByAttribute('p-trigger', 'click:start')
    button && (await fireEvent(button, 'click'))
    let row = await findByAttribute('p-target', 'button-row')
    assert({
      given: 'clicking start',
      should: 'have add button in row',
      actual: row?.childElementCount,
      expected: 3,
    })

    button && (await fireEvent(button, 'click'))
    row = await findByAttribute('p-target', 'button-row')
    assert({
      given: 'clicking start again',
      should: 'not add another button to row',
      actual: row?.children.length,
      expected: 3,
    })

    button = await findByAttribute('p-trigger', 'click:addButton')
    button && (await fireEvent(button, 'click'))
    button = await findByText<HTMLButtonElement>('add svg')

    assert({
      given: 'request to append `add svg` button',
      should: 'new button should be in dom',
      actual: button?.innerText,
      expected: 'add svg',
    })

    button && (await fireEvent(button, 'click'))
    let zone = await findByAttribute('p-target', 'zone')
    assert({
      given: 'clicking add svg',
      should: 'adds a svg to zone',
      actual: zone?.children.length,
      expected: 1,
    })
    const svg = await findByAttribute('p-target', 'svg')
    assert({
      given: 'add-svg event',
      should: 'zone child is an svg',
      actual: svg?.tagName,
      expected: 'svg',
    })

    button = await findByText('add svg')
    button && (await fireEvent(button, 'click'))
    zone = await findByAttribute('p-target', 'zone')
    assert({
      given: 'clicking add svg again',
      should: 'not add another svg to zone',
      actual: zone?.children.length,
      expected: 1,
    })

    svg && (await fireEvent(svg, 'click'))
    button && (await fireEvent(button, 'click'))
    const h3 = await findByText('sub island')
    assert({
      given: 'removeSvg event triggered',
      should: 'still have children in zone appended in subsequent bThread step',
      actual: zone?.children.length,
      expected: 1,
    })
    assert({
      given: 'append of sub-island with declarative shadowdom ',
      should: `sub-island upgraded and thus it's content are queryable`,
      actual: h3?.tagName,
      expected: 'H3',
    })
  },
}
