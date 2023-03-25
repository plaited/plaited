import { Assertion } from '$assert'
import { symbols } from './constants.ts'

export default {
  page: 'woo/shadow',
}

export const shadowObserverTest = async (t: Assertion) => {
  const wrapper = document.getElementById(
    'shadow-observer-test',
  ) as HTMLDetailsElement
  let button = await t.findByAttribute(
    'data-trigger',
    'click->start',
    wrapper,
  )
  button && await t.fireEvent(button, 'click')
  let row = await t.findByAttribute('data-target', 'button-row', wrapper)
  t({
    given: 'clicking start',
    should: 'have add button in row',
    actual: row?.children.length,
    expected: 2,
  })
  button && await t.fireEvent(button, 'click')
  row = await t.findByAttribute('data-target', 'button-row', wrapper)
  t({
    given: 'clicking start again',
    should: 'not add another button to row',
    actual: row?.children.length,
    expected: 2,
  })
  send('shadow-island', { type: 'addButton' })
  button = await t.findByText('add svg', wrapper)
  button && await t.fireEvent(button, 'click')
  let zone = await t.findByAttribute('data-target', 'zone', wrapper)
  t({
    given: 'clicking add svg',
    should: 'adds a svg to zone',
    actual: zone?.children.length,
    expected: 1,
  })
  button = await t.findByText('add svg', wrapper)
  button && await t.fireEvent(button, 'click')
  zone = await t.findByAttribute('data-target', 'zone', wrapper)
  const svg = await t.findByAttribute('data-target', 'svg', wrapper)
  t({
    given: 'clicking add svg again',
    should: 'not add another svg to zone',
    actual: zone?.children.length,
    expected: 1,
  })
  t({
    given: 'start action',
    should: 'zone child is an svg',
    actual: svg?.tagName,
    expected: 'svg',
  })
  svg && await t.fireEvent(svg, 'click')
  button && await t.fireEvent(button, 'click')
  const h3 = await t.findByText('sub island', wrapper)
  t({
    given: 'removing svg',
    should: 'should should still have children',
    actual: zone?.children.length,
    expected: 1,
  })
  t({
    given: 'after svg removal',
    should: 'child should be a h3',
    actual: h3?.tagName,
    expected: 'H3',
  })
}
